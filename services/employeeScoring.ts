/**
 * Employee Scoring Service
 * 
 * Calculates Performance, Attendance, and Response scores using existing
 * attendance_events and tasks data. Scores are 0–100 and stored monthly.
 * 
 * Formulas:
 *   Performance = (completedTasks/assignedTasks)*40 + (onTimeCompletion%)*40 + 20 (quality placeholder)
 *   Attendance  = (presentDays/workingDays)*100 - (lateDays*5)   [clamped 0–100]
 *   Response    = (taskAcceptanceSpeed)*50 + (checkInCompliance)*50
 *   Overall     = weighted sum based on role
 */

import { supabase } from './supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, differenceInMinutes, differenceInDays } from 'date-fns';
import type { EmployeeScore, RoleCategory, RoleWeights, Task, AttendanceEvent } from '../types';
import { isLateCheckIn } from '../utils/attendanceCalculations';

// Role-based weight configuration
const ROLE_WEIGHTS: Record<RoleCategory, RoleWeights> = {
  office_staff: { performance: 0.5, attendance: 0.3, response: 0.2 },
  field_staff:  { performance: 0.4, attendance: 0.4, response: 0.2 },
  support:      { performance: 0.4, attendance: 0.2, response: 0.4 },
};

/**
 * Map a user role string to a RoleCategory for weight selection
 */
function getRoleCategory(role: string): RoleCategory {
  const r = (role || '').toLowerCase();
  if (r.includes('field') || r.includes('site') || r.includes('operation')) {
    return 'field_staff';
  }
  if (r.includes('support') || r.includes('help')) {
    return 'support';
  }
  return 'office_staff';
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Normalize an attendance event type string for comparison.
 * The DB stores values like 'check in', 'check-in', 'Check In', etc.
 * We normalize to lowercase with no separators: 'checkin', 'checkout', 'breakin', 'breakout'
 */
function isCheckInEvent(type: string): boolean {
  // Only match actual check-in / punch-in events (NOT checkout/punchout)
  const normalized = (type || '').toLowerCase().replace(/[-_\s]/g, '');
  return normalized === 'checkin' || normalized === 'punchin' || normalized === 'signin';
}

function isCheckOutEvent(type: string): boolean {
  const normalized = (type || '').toLowerCase().replace(/[-_\s]/g, '');
  return normalized === 'checkout' || normalized === 'punchout' || normalized === 'signout' || type === 'punch-out';
}

// ─── Performance Score ──────────────────────────────────────────────

async function calculatePerformanceScore(
  userId: string,
  monthStart: string,
  monthEnd: string
): Promise<number> {
  // Fetch tasks assigned to this user within the month
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to_id', userId)
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd);

  if (error || !tasks || tasks.length === 0) {
    // No tasks assigned → return neutral score (don't reward or penalize)
    return 50;
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status === 'Done').length;
  
  // Task completion rate (40%)
  const completionRate = (completedTasks / totalTasks) * 40;

  // On-time completion (40%) — tasks completed before or on due date
  const tasksWithDueDate = tasks.filter((t: any) => t.due_date && t.status === 'Done');
  let onTimeRate = 40; // Default full marks if no due dates set
  if (tasksWithDueDate.length > 0) {
    const onTimeTasks = tasksWithDueDate.filter((t: any) => {
      const completedAt = t.updated_at || t.created_at;
      return completedAt <= t.due_date;
    });
    onTimeRate = (onTimeTasks.length / tasksWithDueDate.length) * 40;
  }

  // Quality placeholder (20%) — fixed at 80% until rating system exists
  const qualityScore = 16; // 80% of 20

  return clamp(completionRate + onTimeRate + qualityScore, 0, 100);
}

// ─── Attendance Score ───────────────────────────────────────────────

async function calculateAttendanceScore(
  userId: string,
  monthStart: Date,
  monthEnd: Date,
  configuredStartTime: string = '09:30'
): Promise<{ score: number; tiebreakerScore: number }> {
  // Get all attendance events for the month
  const { data: events, error } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', monthStart.toISOString())
    .lte('timestamp', monthEnd.toISOString())
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('[Scoring] Error fetching attendance events:', error);
    return { score: 0, tiebreakerScore: 0 };
  }

  // Dynamically calculate working days (Mon-Sat, exclude Sundays)
  const today = new Date();
  // If current month, only count days up to today; otherwise count entire month
  const effectiveEnd = monthEnd > today ? today : monthEnd;
  const allDays = eachDayOfInterval({ start: monthStart, end: effectiveEnd });
  const workingDays = allDays.filter(d => getDay(d) !== 0).length; // Exclude Sundays

  if (workingDays === 0) return { score: 100, tiebreakerScore: 0 };

  // Group events by UTC date to count present days & late days (matches SQL behavior)
  const eventsByDate = new Map<string, any[]>();
  (events || []).forEach((e: any) => {
    // Extract date part from ISO string "YYYY-MM-DD..."
    const dateKey = e.timestamp.split('T')[0];
    if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, []);
    eventsByDate.get(dateKey)!.push(e);
  });

  let totalMinutesWorked = 0;

  // Count present days (days with at least one check-in)
  const presentDays = Array.from(eventsByDate.entries()).filter(([_, dayEvents]) =>
    dayEvents.some((e: any) => isCheckInEvent(e.type))
  ).length;

  // Count late days and calculate total time worked (tiebreaker)
  let lateDays = 0;
  eventsByDate.forEach((dayEvents) => {
    const firstCheckIn = dayEvents.find((e: any) => isCheckInEvent(e.type));
    
    if (firstCheckIn) {
      const checkInTime = format(parseISO(firstCheckIn.timestamp), 'HH:mm');
      const { isLate } = isLateCheckIn(checkInTime, configuredStartTime);
      if (isLate) lateDays++;

      // Tiebreaker calculation: Find last checkout
      // We sort the day's events by timestamp to ensure chronological order.
      // Easiest metric: Difference between first check-in and last check-out for the day.
      const lastCheckOut = [...dayEvents].reverse().find((e: any) => isCheckOutEvent(e.type));
      if (lastCheckOut) {
         const diff = differenceInMinutes(parseISO(lastCheckOut.timestamp), parseISO(firstCheckIn.timestamp));
         if (diff > 0) totalMinutesWorked += diff;
      }
    }
  });

  // Formula: (presentDays / workingDays) * 100
  // Reduced late penalty impact for now as requested by user's 'proper' expectation
  const score = (presentDays / workingDays) * 100 - (lateDays * 1);
  return {
    score: clamp(score, 0, 100),
    tiebreakerScore: totalMinutesWorked
  };
}

// ─── Response Score ─────────────────────────────────────────────────

async function calculateResponseScore(
  userId: string,
  monthStart: string,
  monthEnd: string
): Promise<number> {
  // Fetch tasks assigned to this user within the month
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to_id', userId)
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd);

  let taskAcceptance = 50; // Default full marks for acceptance if no tasks assigned

  if (!error && tasks && tasks.length > 0) {
    // Task acceptance speed (50%) — how quickly tasks moved from 'To Do' to 'In Progress'
    // Since we don't have a detailed activity log, we use escalation as a proxy:
    // No escalation = fast response (100), Level 1 = moderate (60), Level 2+ = slow (30)
    const escalationScores = tasks.map((t: any) => {
      switch (t.escalation_status) {
        case 'None': return 100;
        case 'Level 1': return 60;
        case 'Level 2': return 30;
        case 'Email Sent': return 20;
        default: return 80;
      }
    });
    const avgEscalation = escalationScores.reduce((a: number, b: number) => a + b, 0) / escalationScores.length;
    taskAcceptance = (avgEscalation / 100) * 50;
  }

  // Check-in compliance (50%) — based on attendance consistency
  // Uses the ratio of present days to working days as a proxy for responsiveness
  const { data: events } = await supabase
    .from('attendance_events')
    .select('timestamp, type')
    .eq('user_id', userId)
    .gte('timestamp', monthStart)
    .lte('timestamp', monthEnd);

  const uniqueDays = new Set(
    (events || [])
      .filter((e: any) => isCheckInEvent(e.type))
      .map((e: any) => e.timestamp.split('T')[0]) // Use UTC date string
  );

  // Dynamically calculate working days (Mon-Sat, exclude Sundays)
  const mStart = parseISO(monthStart);
  const mEnd = parseISO(monthEnd);
  const responseToday = new Date();
  const effectiveEnd2 = mEnd > responseToday ? responseToday : mEnd;
  const allDays2 = eachDayOfInterval({ start: mStart, end: effectiveEnd2 });
  const workingDays = allDays2.filter(d => getDay(d) !== 0).length;
  const compliance = workingDays > 0 ? (uniqueDays.size / workingDays) * 50 : 25;

  return clamp(taskAcceptance + compliance, 0, 100);
}

// ─── Main Calculator ────────────────────────────────────────────────

export async function calculateEmployeeScores(
  userId: string,
  userRole: string,
  monthDate?: Date
): Promise<EmployeeScore> {
  const targetMonth = monthDate || new Date();
  const monthStart = startOfMonth(targetMonth);
  // Ensure we get the absolute end of the month (23:59:59) so we don't accidentally cut off events
  const monthEnd = new Date(endOfMonth(targetMonth));
  monthEnd.setHours(23, 59, 59, 999);
  
  const monthKey = format(monthStart, 'yyyy-MM-01');
  const monthStartISO = monthStart.toISOString();
  const monthEndISO = monthEnd.toISOString();

  const roleCategory = getRoleCategory(userRole);
  const weights = ROLE_WEIGHTS[roleCategory];

  // Calculate all three scores in parallel
  const [performanceScore, { score: attendanceScore, tiebreakerScore }, responseScore] = await Promise.all([
    calculatePerformanceScore(userId, monthStartISO, monthEndISO),
    calculateAttendanceScore(userId, monthStart, monthEnd),
    calculateResponseScore(userId, monthStartISO, monthEndISO),
  ]);

  // Weighted overall score (exact match to SQL sync script)
  const overallScore = clamp(
    roleCategory === 'field_staff' 
      ? (performanceScore * 0.4 + attendanceScore * 0.4 + responseScore * 0.2)
      : (performanceScore * 0.3 + attendanceScore * 0.4 + responseScore * 0.3),
    0, 100
  );

  const now = new Date().toISOString();

  // Upsert into employee_scores table
  const scoreData = {
    user_id: userId,
    month: monthKey,
    performance_score: performanceScore,
    attendance_score: attendanceScore,
    response_score: responseScore,
    overall_score: overallScore,
    tiebreaker_score: tiebreakerScore,
    role_category: roleCategory,
    calculated_at: now,
  };

  const { data, error } = await supabase
    .from('employee_scores')
    .upsert(scoreData, { onConflict: 'user_id,month' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting employee score:', error);
    // Return calculated values even if storage fails
    return {
      id: '',
      userId,
      month: monthKey,
      performanceScore,
      attendanceScore,
      responseScore,
      overallScore,
      tiebreakerScore,
      roleCategory,
      calculatedAt: now,
      createdAt: now,
    };
  }

  return {
    id: data.id,
    userId: data.user_id,
    month: data.month,
    performanceScore: data.performance_score,
    attendanceScore: data.attendance_score,
    responseScore: data.response_score,
    overallScore: data.overall_score,
    tiebreakerScore: data.tiebreaker_score || tiebreakerScore,
    roleCategory: data.role_category,
    calculatedAt: data.calculated_at,
    createdAt: data.created_at,
  };
}

/**
 * Fetch existing score for a user/month (without recalculating)
 */
export async function getEmployeeScore(
  userId: string,
  monthDate?: Date
): Promise<EmployeeScore | null> {
  const targetMonth = monthDate || new Date();
  const monthKey = format(startOfMonth(targetMonth), 'yyyy-MM-01');

  const { data, error } = await supabase
    .from('employee_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('month', monthKey)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    month: data.month,
    performanceScore: data.performance_score,
    attendanceScore: data.attendance_score,
    responseScore: data.response_score,
    overallScore: data.overall_score,
    tiebreakerScore: data.tiebreaker_score || 0,
    roleCategory: data.role_category,
    calculatedAt: data.calculated_at,
    createdAt: data.created_at,
  };
}

/**
 * Fetch score history for a user (multiple months)
 */
export async function getEmployeeScoreHistory(
  userId: string,
  limit: number = 6
): Promise<EmployeeScore[]> {
  const { data, error } = await supabase
    .from('employee_scores')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    userId: d.user_id,
    month: d.month,
    performanceScore: d.performance_score,
    attendanceScore: d.attendance_score,
    responseScore: d.response_score,
    overallScore: d.overall_score,
    tiebreakerScore: d.tiebreaker_score || 0,
    roleCategory: d.role_category,
    calculatedAt: d.calculated_at,
    createdAt: d.created_at,
  }));
}

// ─── Fast Pre-Computed Score Loader ─────────────────────────────────

/**
 * Load pre-computed scores from the employee_scores table in a SINGLE query.
 * This is the fast path used for instant dashboard loading.
 * Falls back to full calculation if no cached scores exist.
 */
export async function getAllPreComputedScores(
  monthDate?: Date
): Promise<EmployeeScoreWithUser[]> {
  const targetMonth = monthDate || new Date();
  const monthKey = format(startOfMonth(targetMonth), 'yyyy-MM-01');

  // Attempt the fast, secure RPC path first (which bypasses users table RLS)
  const { data: rpcScores, error: rpcError } = await supabase
    .rpc('get_employee_scores_with_users', { p_month: monthKey });

  if (!rpcError && rpcScores && rpcScores.length > 0) {
    return rpcScores.map((s: any) => ({
      userId: s.user_id,
      userName: s.user_name || 'Unknown',
      userRole: s.user_role || 'unknown',
      userPhotoUrl: s.user_photo_url || undefined,
      scores: {
        id: s.score_id,
        userId: s.user_id,
        month: monthKey,
        performanceScore: s.performance_score,
        attendanceScore: s.attendance_score,
        responseScore: s.response_score,
        overallScore: s.overall_score,
        tiebreakerScore: s.tiebreaker_score || 0,
        roleCategory: s.role_category,
        calculatedAt: s.calculated_at,
        createdAt: s.created_at,
      }
    }));
  }

  // Fallback if RPC doesn't exist yet (migration not run)
  // Single query: get all scores for this month
  const { data: scores, error } = await supabase
    .from('employee_scores')
    .select('*')
    .eq('month', monthKey)
    .order('overall_score', { ascending: false })
    .order('tiebreaker_score', { ascending: false });

  if (error || !scores || scores.length === 0) {
    // No cached scores yet — fall back to full calculation
    return calculateAllEmployeeScores(monthDate);
  }

  // Fetch all users in one query for name/photo/role
  // NOTE: This will silently return 0 users for non-admins due to RLS,
  // which is why the RPC above is the primary solution.
  const userIds = scores.map((s: any) => s.user_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, name, role_id, photo_url')
    .in('id', userIds);

  const userMap = new Map<string, any>();
  (users || []).forEach((u: any) => userMap.set(u.id, u));

  const results: EmployeeScoreWithUser[] = scores
    .map((s: any) => {
      const u = userMap.get(s.user_id);
      if (!u) return null; // If RLS blocks user fetch, they get stripped here
      return {
        userId: s.user_id,
        userName: u.name || 'Unknown',
        userRole: u.role_id || 'unknown',
        userPhotoUrl: u.photo_url || undefined,
        scores: {
          id: s.id,
          userId: s.user_id,
          month: s.month,
          performanceScore: s.performance_score,
          attendanceScore: s.attendance_score,
          responseScore: s.response_score,
          overallScore: s.overall_score,
          tiebreakerScore: s.tiebreaker_score || 0,
          roleCategory: s.role_category,
          calculatedAt: s.calculated_at,
          createdAt: s.created_at,
        },
      };
    })
    .filter((r: any): r is EmployeeScoreWithUser => r !== null);

  return results;
}

// ─── Batch Score Calculator ─────────────────────────────────────────

export interface EmployeeScoreWithUser {
  userId: string;
  userName: string;
  userRole: string;
  userPhotoUrl?: string;
  scores: EmployeeScore;
}

/**
 * Calculate scores for ALL employees. Returns an array sorted by overallScore (desc).
 */
export async function calculateAllEmployeeScores(
  monthDate?: Date
): Promise<EmployeeScoreWithUser[]> {
  // First, check who is running this to avoid RLS issues zeroing out other users' scores
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;
  
  let canCalculateAll = false;
  if (currentUserId) {
    const { data: uInfo } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', currentUserId)
      .single();
    if (uInfo && ['admin', 'super_admin', 'hr', 'hr_ops', 'management', 'developer'].includes(uInfo.role_id)) {
      canCalculateAll = true;
    }
  }

  // Fetch users to calculate scores for
  let query = supabase
    .from('users')
    .select('id, name, role_id, photo_url')
    .not('role_id', 'is', null);

  // CRITICAL FIX: Non-admins MUST NOT recalculate scores for everyone,
  // as their RLS blocks fetching others' attendance, which would overwrite scores to 0.
  if (!canCalculateAll && currentUserId) {
    query = query.eq('id', currentUserId);
  } else if (!canCalculateAll) {
    return []; // Not logged in and not admin
  }

  const { data: users, error } = await query;

  if (error || !users || users.length === 0) {
    console.error('[Scoring] Error fetching users:', error);
    return [];
  }

  // Calculate scores for each user in parallel (batched in groups of 10)
  const results: EmployeeScoreWithUser[] = [];
  const batchSize = 10;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (u: any): Promise<EmployeeScoreWithUser | null> => {
        try {
          const scores = await calculateEmployeeScores(u.id, u.role_id || 'office', monthDate);
          return {
            userId: u.id,
            userName: u.name || 'Unknown',
            userRole: u.role_id || 'unknown',
            userPhotoUrl: u.photo_url || undefined,
            scores,
          };
        } catch (err) {
          console.error(`[Scoring] Failed for user ${u.id}:`, err);
          return null;
        }
      })
    );
    results.push(...batchResults.filter((r): r is EmployeeScoreWithUser => r !== null));
  }

  // Sort by overall score descending, then by tiebreaker
  results.sort((a, b) => {
    if (b.scores.overallScore !== a.scores.overallScore) {
      return b.scores.overallScore - a.scores.overallScore;
    }
    return (b.scores.tiebreakerScore || 0) - (a.scores.tiebreakerScore || 0);
  });

  // Auto-detect zero-score employees and notify admin/HR (fire-and-forget, don't block display)
  notifyZeroScoreEmployees(results).catch(err => console.error('[Scoring] Zero-score notify failed:', err));

  return results;
}

// ─── Zero-Score Employee Detection ──────────────────────────────────

/**
 * Detect employees with all scores = 0 and send notifications to admin/HR/HR-ops.
 * If denied, the next day's calculation will re-trigger the notification (daily reminder).
 */
async function notifyZeroScoreEmployees(allScores: EmployeeScoreWithUser[]): Promise<void> {
  const zeroScoreEmployees = allScores.filter(
    emp => emp.scores.performanceScore === 0 &&
           emp.scores.attendanceScore === 0 &&
           emp.scores.responseScore === 0
  );

  if (zeroScoreEmployees.length === 0) return;

  // Fetch admin/HR/HR-ops users to notify
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .in('role_id', ['admin', 'hr', 'hr_ops']);

  if (!admins || admins.length === 0) return;

  for (const emp of zeroScoreEmployees) {
    // Check if we already sent a notification today for this employee
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'approval_request')
      .gte('created_at', `${today}T00:00:00`)
      .like('message', `%${emp.userName}%zero%`)
      .limit(1);

    if (existingNotifs && existingNotifs.length > 0) continue; // Already notified today

    // Send notification to each admin/HR
    for (const admin of admins) {
      await supabase.from('notifications').insert({
        user_id: admin.id,
        message: `${emp.userName} (${emp.userRole.replace(/_/g, ' ')}) has zero activity scores this month. They may have left the organization. Please review and approve removal or deny.`,
        type: 'approval_request',
        link_to: '/support',
        metadata: {
          action: 'remove_inactive_employee',
          targetUserId: emp.userId,
          targetUserName: emp.userName,
          targetUserRole: emp.userRole,
        },
      });
    }
  }
}
