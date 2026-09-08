import { SupabaseClient } from '@supabase/supabase-js';
import { processSchedules } from '../../api/process-email-schedules.js';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function getISTDateString(date: Date = new Date()): string {
  const istDate = new Date(date.getTime() + IST_OFFSET);
  return istDate.toISOString().substring(0, 10);
}

function getISTTimeString(date: Date = new Date()): string {
  const istDate = new Date(date.getTime() + IST_OFFSET);
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const dailyExecutionLocks = new Set<string>();

const FIXED_HOLIDAYS = [
  { name: 'Republic Day', date: '01-26' },
  { name: 'May Day', date: '05-01' },
  { name: 'Independence Day', date: '08-15' },
  { name: 'Gandhi Jayanti', date: '10-02' },
  { name: 'Karnataka Rajyotsava', date: '11-01' },
];

const OFFICE_ROLES = new Set([
  'admin', 'super_admin', 'director', 'management', 'developer',
  'hr', 'hr_ops', 'hr_onboaring', 'hr_recruitment',
  'finance', 'finance_manager', 'senior_accountant', 'senior_accountant_southwall',
  'accountant', 'accounts_executive', 'accounts_excitative', 'accounts_excitative_invoice', 'accounts_excitative_southwall',
  'auditor', 'operation_manager', 'business_developer', 'pantry_boy', 'back_office_staff', 'facility_executive'
]);

export function isOfficeRole(roleId?: string | null): boolean {
  if (!roleId) return false;
  const r = roleId.toLowerCase().trim();
  // Strictly exclude field, site, technician, guard, reliever
  if (r.includes('field') || r.includes('site') || r.includes('technician') || r.includes('guard') || r.includes('reliever') || r.includes('plumber') || r.includes('electrician')) {
    return false;
  }
  if (OFFICE_ROLES.has(r)) return true;
  return r.includes('account') || r.includes('finance') || r.includes('audit') ||
         r.includes('billing') || r.includes('director') || r === 'office' || r.startsWith('office_') || r.endsWith('_office') ||
         r.includes('admin') || r.includes('management') || r.includes('developer') ||
         r.includes('pantry') || r.includes('hr_') || r === 'hr';
}

export async function isOfficeWorkingDay(supabase: SupabaseClient, dateIST: Date): Promise<{ isWorking: boolean; reason?: string }> {
  const dayOfWeek = dateIST.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  if (dayOfWeek === 0) {
    return { isWorking: false, reason: 'Sunday (Weekly Off)' };
  }

  // If Saturday, check recurring holiday in recurring_holidays table (e.g. 3rd Saturday)
  if (dayOfWeek === 6) {
    const dayOfMonth = dateIST.getUTCDate();
    const occurrence = Math.ceil(dayOfMonth / 7);
    try {
      const { data: recHolidays } = await supabase
        .from('recurring_holidays')
        .select('*')
        .eq('role_type', 'office')
        .eq('day', 'Saturday');

      if (recHolidays?.some((rh: any) => rh.occurrence === occurrence)) {
        return { isWorking: false, reason: `Recurring Holiday (${occurrence}th Saturday of the month)` };
      }
    } catch (err: any) {
      console.warn('[UnifiedScheduler] Warning fetching recurring_holidays:', err.message);
    }
  }

  const mm = String(dateIST.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateIST.getUTCDate()).padStart(2, '0');
  const curMD = `${mm}-${dd}`;
  const curMinusMD = `-${curMD}`;

  // Check Fixed Holidays
  const fixed = FIXED_HOLIDAYS.find(h => h.date === curMD);
  if (fixed) {
    return { isWorking: false, reason: `Fixed Holiday: ${fixed.name}` };
  }

  // Check Settings Holiday Pool
  try {
    const { data: globalSettings } = await supabase
      .from('settings')
      .select('attendance_settings')
      .eq('id', 'singleton')
      .single();

    const holidayPool = globalSettings?.attendance_settings?.office?.holiday_pool || [];
    const poolHoliday = holidayPool.find((h: any) => h.date === curMinusMD || h.date === curMD);
    if (poolHoliday) {
      return { isWorking: false, reason: `Company Holiday: ${poolHoliday.name}` };
    }
  } catch (err: any) {
    console.warn('[UnifiedScheduler] Warning fetching settings holiday_pool:', err.message);
  }

  return { isWorking: true };
}

export async function executeOfficeAutoPunchOut830(supabase: SupabaseClient, force: boolean = false): Promise<{ success: boolean; processed: number; reason?: string; users?: string[] }> {
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);

  // 1. Holiday & Working Day Guard
  if (!force) {
    const workingCheck = await isOfficeWorkingDay(supabase, nowIST);
    if (!workingCheck.isWorking) {
      console.log(`[OfficeAutoPunchOut830] Skipped: Today is not a working office day (${workingCheck.reason}).`);
      return { success: true, processed: 0, reason: workingCheck.reason };
    }
  }

  // 2. Determine time boundaries
  const midnightIST = new Date(nowIST);
  midnightIST.setUTCHours(0, 0, 0, 0);
  const startOfTodayUTC = new Date(midnightIST.getTime() - IST_OFFSET);

  // Punch out timestamp: Sharp 8:30:00 PM IST (20:30:00 IST) converted to UTC
  const punchOutIST = new Date(nowIST);
  punchOutIST.setUTCHours(20, 30, 0, 0);
  const punchOutUTC = new Date(punchOutIST.getTime() - IST_OFFSET);
  const punchOutTimestamp = punchOutUTC.toISOString();

  // Strict Time Guard: NEVER auto punch out before 8:30 PM (20:30 IST) unless forced
  if (!force && now.getTime() < punchOutUTC.getTime()) {
    console.log(`[OfficeAutoPunchOut830] Skipped: Current time is before 8:30 PM IST. Shift is still active.`);
    return { success: true, processed: 0, reason: 'Shift still in progress (before 8:30 PM IST)' };
  }

  // 3. Fetch latest attendance events today
  const { data: latestEvents, error: evErr } = await supabase
    .from('attendance_events')
    .select('id, user_id, type, timestamp, location_name, latitude, longitude, work_type')
    .gte('timestamp', startOfTodayUTC.toISOString())
    .order('timestamp', { ascending: false });

  if (evErr) {
    console.error('[OfficeAutoPunchOut830] Error fetching attendance events:', evErr.message);
    throw evErr;
  }

  const userLatest = new Map<string, any>();
  latestEvents?.forEach((e: any) => {
    if (!userLatest.has(e.user_id)) {
      userLatest.set(e.user_id, e);
    }
  });

  // Find all users whose latest event today is 'punch-in'
  const punchedInUserIds = Array.from(userLatest.entries())
    .filter(([_, ev]) => ev.type === 'punch-in')
    .map(([uid]) => uid);

  if (punchedInUserIds.length === 0) {
    console.log('[OfficeAutoPunchOut830] No active punched-in sessions found today. Nothing to punch out.');
    return { success: true, processed: 0, reason: 'No active punch-ins' };
  }

  // 4. Fetch user details
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, email, role_id, reporting_manager_id')
    .in('id', punchedInUserIds);

  if (uErr) {
    console.error('[OfficeAutoPunchOut830] Error fetching users:', uErr.message);
    throw uErr;
  }

  const targetOfficeUsers = (users || []).filter(u => isOfficeRole(u.role_id));
  console.log(`[OfficeAutoPunchOut830] Processing auto punch-out for ${targetOfficeUsers.length} office employees...`);

  const processedUserNames: string[] = [];

  for (const user of targetOfficeUsers) {
    const lastEvent = userLatest.get(user.id);
    const punchInTime = new Date(lastEvent.timestamp).getTime();

    // Skip if punched in after 8:30 PM (e.g. late login or night shift)
    if (!force && punchInTime >= punchOutUTC.getTime()) {
      console.log(`[OfficeAutoPunchOut830] User ${user.name} punched in after 8:30 PM. Skipping.`);
      continue;
    }

    try {
      // 1. Insert punch-out event
      await supabase.from('attendance_events').insert({
        user_id: user.id,
        timestamp: punchOutTimestamp,
        type: 'punch-out',
        work_type: 'office',
        source: 'auto_system',
        location_name: lastEvent.location_name || 'Paradigm Head Office',
        latitude: lastEvent.latitude || null,
        longitude: lastEvent.longitude || null,
        checkout_note: 'User was working - Auto punched out by AI as per work hour policy',
        is_manual: false,
        device_info: { device: 'System', os: 'Scheduler', service: 'OfficeAutoPunchOut830' }
      });

      // 2. Insert notification for the employee
      await supabase.from('notifications').insert({
        user_id: user.id,
        message: `Hi ${user.name}, you have been automatically punched out at 8:30 PM as per office working hours policy.`,
        type: 'info',
        is_read: false,
        link_to: '/attendance',
        metadata: { source: 'auto_system', policy: '830_pm_shift_close', execute_at: punchOutTimestamp }
      });

      // 3. Notify reporting manager if present
      if (user.reporting_manager_id) {
        await supabase.from('notifications').insert({
          user_id: user.reporting_manager_id,
          message: `${user.name} was automatically punched out at 8:30 PM (Office work hour policy).`,
          type: 'info',
          is_read: false,
          link_to: '/attendance',
          metadata: { source: 'auto_system', target_user: user.id }
        });
      }

      // 4. Audit log
      await supabase.from('attendance_audit_logs').insert({
        action: 'AUTO_PUNCH_OUT_830',
        performed_by: null,
        target_user_id: user.id,
        details: {
          policy: 'office_830_sharp',
          punch_in_time: lastEvent.timestamp,
          punch_out_time: punchOutTimestamp,
          role: user.role_id,
          location: lastEvent.location_name
        }
      });

      processedUserNames.push(user.name);
      console.log(`[OfficeAutoPunchOut830] ✅ Auto punched out ${user.name} (${user.role_id})`);
    } catch (userErr: any) {
      console.error(`[OfficeAutoPunchOut830] Failed to punch out ${user.name}:`, userErr.message);
    }
  }

  return {
    success: true,
    processed: processedUserNames.length,
    users: processedUserNames
  };
}

/**
 * Dispatches a due scheduled broadcast notification (push/in-app)
 */
async function dispatchScheduledBroadcast(supabase: SupabaseClient, broadcast: any) {
  try {
    const isBroadcast = broadcast.target_role?.toLowerCase() === 'all' || !broadcast.target_role;
    const broadcastTitle = broadcast.title || 'Scheduled Announcement';

    if (isBroadcast) {
      console.log(`[UnifiedScheduler] Broadcasting to ALL: "${broadcastTitle}"`);
      await supabase.rpc('broadcast_notification', {
        p_message: broadcast.message,
        p_type: broadcast.type || 'info',
        p_severity: 'Low',
        p_metadata: {
          title: broadcastTitle,
          isBroadcast: true,
          scheduled_id: broadcast.id,
          sentAt: new Date().toISOString()
        }
      });
    } else {
      console.log(`[UnifiedScheduler] Targeting role "${broadcast.target_role}": "${broadcastTitle}"`);
      const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', broadcast.target_role)
        .neq('status', 'left');

      if (!error && users && users.length > 0) {
        const notifs = users.map(u => ({
          user_id: u.id,
          title: broadcastTitle,
          message: broadcast.message,
          type: broadcast.type || 'info',
          severity: 'Low',
          is_read: false,
          metadata: {
            scheduled_id: broadcast.id,
            target_role: broadcast.target_role,
            sentAt: new Date().toISOString()
          }
        }));

        await supabase.from('notifications').insert(notifs);
      }
    }

    // Mark as sent
    await supabase
      .from('scheduled_notifications')
      .update({
        is_sent: true,
        processed_at: new Date().toISOString()
      })
      .eq('id', broadcast.id);

    console.log(`[UnifiedScheduler] Successfully completed broadcast ${broadcast.id}`);
  } catch (err: any) {
    console.error(`[UnifiedScheduler] Failed to dispatch broadcast ${broadcast.id}:`, err.message);
  }
}

/**
 * Evaluates and dispatches an automated rule check (e.g. Missed Punch Out, Late Check)
 */
async function dispatchAutomatedRule(supabase: SupabaseClient, rule: any) {
  try {
    console.log(`[UnifiedScheduler] Evaluating automated rule "${rule.name}" (${rule.trigger_type})...`);
    
    // Invoke Supabase Edge Function with rule_id
    const targetId = (typeof rule.id === 'string' && !rule.id.includes('-')) ? parseInt(rule.id) : rule.id;
    const { error } = await supabase.functions.invoke('process-notification-rules', {
      body: { 
        rule_id: targetId,
        test_mode: false 
      }
    });

    if (error) {
      console.warn(`[UnifiedScheduler] Edge function invoke returned error for rule ${rule.name}:`, error.message);
    } else {
      console.log(`[UnifiedScheduler] Successfully processed automated rule "${rule.name}"`);
    }

    // Record last run
    await supabase
      .from('automated_notification_rules')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', rule.id);
  } catch (err: any) {
    console.error(`[UnifiedScheduler] Error executing automated rule ${rule.id}:`, err.message);
  }
}

/**
 * Evaluates and dispatches an email schedule report
 */
async function dispatchEmailSchedule(supabase: SupabaseClient, rule: any, force: boolean = false) {
  try {
    console.log(`[UnifiedScheduler] Generating & sending email schedule "${rule.name}" (${rule.report_type})...`);
    const result = await processSchedules({
      query: {
        ruleId: rule.id,
        force: force ? 'true' : 'false'
      }
    });
    console.log(`[UnifiedScheduler] Completed email schedule "${rule.name}":`, result);
    return result;
  } catch (err: any) {
    console.error(`[UnifiedScheduler] Error executing email schedule ${rule.id}:`, err.message);
    throw err;
  }
}

/**
 * Runs a 60-second tick across all planned jobs
 */
export async function runSchedulerTick(supabase: SupabaseClient) {
  const nowIso = new Date().toISOString();
  const currentIstTime = getISTTimeString();
  const currentIstDate = getISTDateString();

  // 1. Process Due Scheduled Broadcasts
  try {
    const { data: dueBroadcasts } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('is_sent', false)
      .lte('scheduled_at', nowIso);

    if (dueBroadcasts && dueBroadcasts.length > 0) {
      console.log(`[UnifiedScheduler] Found ${dueBroadcasts.length} due broadcast(s)`);
      for (const b of dueBroadcasts) {
        await dispatchScheduledBroadcast(supabase, b);
      }
    }
  } catch (err: any) {
    console.error('[UnifiedScheduler] Error fetching due broadcasts:', err.message);
  }

  // 2. Process Due Proactive Automated Rules matching current IST minute
  try {
    const { data: activeAutoRules } = await supabase
      .from('automated_notification_rules')
      .select('*')
      .eq('is_active', true);

    if (activeAutoRules && activeAutoRules.length > 0) {
      for (const rule of activeAutoRules) {
        const ruleTime = rule.config?.time;
        if (ruleTime && ruleTime === currentIstTime) {
          await dispatchAutomatedRule(supabase, rule);
        }
      }
    }
  } catch (err: any) {
    console.error('[UnifiedScheduler] Error checking automated rules:', err.message);
  }

  // 3. Process Due Email Schedules matching current IST minute
  try {
    const { data: activeEmailRules } = await supabase
      .from('email_schedule_rules')
      .select('*')
      .eq('is_active', true);

    if (activeEmailRules && activeEmailRules.length > 0) {
      for (const rule of activeEmailRules) {
        const targetTime = rule.schedule_config?.time || '09:00';
        if (targetTime === currentIstTime) {
          const lastSent = rule.last_sent_at ? getISTDateString(new Date(rule.last_sent_at)) : null;
          if (lastSent !== currentIstDate) {
            await dispatchEmailSchedule(supabase, rule, false);
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[UnifiedScheduler] Error checking email schedules:', err.message);
  }

  // 4. Sharp 8:30 PM (20:30 IST) Office Staff Auto Punch-Out (Monday to Saturday)
  try {
    if (currentIstTime === '20:30') {
      const lockKey = `office_punchout_${currentIstDate}`;
      if (!dailyExecutionLocks.has(lockKey)) {
        dailyExecutionLocks.add(lockKey);
        console.log(`[UnifiedScheduler] ⏰ Sharp 8:30 PM reached. Executing Office Staff Auto Punch-Out for ${currentIstDate}...`);
        executeOfficeAutoPunchOut830(supabase).catch(err => {
          console.error('[UnifiedScheduler] Error executing 8:30 PM Office Auto Punch-Out:', err);
        });
      }
    }
  } catch (err: any) {
    console.error('[UnifiedScheduler] Error checking 8:30 PM auto punch-out:', err.message);
  }
}

/**
 * Manual trigger execution on-demand
 */
export async function executeJobNow(
  supabase: SupabaseClient,
  jobType: 'broadcast' | 'automated' | 'email' | 'office_auto_punchout',
  jobId: string
) {
  console.log(`[UnifiedScheduler] Manual 'Run Now' triggered for ${jobType} ID: ${jobId}`);

  if (jobType === 'office_auto_punchout' || (jobType as string) === 'office' || jobId === 'office-auto-punchout-830') {
    const result = await executeOfficeAutoPunchOut830(supabase, true);
    return {
      success: true,
      message: `Office Auto Punch-Out executed. Punched out: ${result.processed}${result.reason ? ` (${result.reason})` : ''}`,
      details: result
    };
  }

  if (jobType === 'broadcast') {
    const { data: broadcast, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('id', jobId)
      .single();
    if (error || !broadcast) throw new Error(`Broadcast ${jobId} not found`);
    await dispatchScheduledBroadcast(supabase, broadcast);
    return { success: true, message: `Broadcast "${broadcast.title || broadcast.id}" dispatched successfully.` };
  }

  if (jobType === 'automated') {
    const targetId = (!jobId.includes('-')) ? parseInt(jobId) : jobId;
    const { error } = await supabase.functions.invoke('process-notification-rules', {
      body: { 
        rule_id: targetId,
        test_mode: false 
      }
    });
    if (error) throw error;
    return { success: true, message: `Automated rule evaluated successfully.` };
  }

  if (jobType === 'email') {
    const result = await dispatchEmailSchedule(supabase, { id: jobId, name: 'Manual Trigger' }, true);
    return { success: true, message: `Email schedule executed. Sent: ${result?.processed || 0}`, details: result };
  }

  throw new Error(`Unknown jobType: ${jobType}`);
}

/**
 * Returns a consolidated overview of all planned jobs across the system
 */
export async function getUnifiedJobsOverview(supabase: SupabaseClient) {
  const [scheduledRes, autoRes, emailRes] = await Promise.all([
    supabase.from('scheduled_notifications').select('*').order('scheduled_at', { ascending: true }),
    supabase.from('automated_notification_rules').select('*').order('created_at', { ascending: false }),
    supabase.from('email_schedule_rules').select('*').order('created_at', { ascending: false })
  ]);

  const scheduled = scheduledRes.data || [];
  const autoRules = autoRes.data || [];
  const emailRules = emailRes.data || [];

  return {
    scheduledBroadcasts: scheduled,
    automatedRules: autoRules,
    emailSchedules: emailRules,
    stats: {
      totalUpcomingBroadcasts: scheduled.filter((s: any) => !s.is_sent).length,
      totalActiveAutoRules: autoRules.filter((r: any) => r.is_active).length,
      totalActiveEmailSchedules: emailRules.filter((e: any) => e.is_active).length,
      totalProcessedToday: scheduled.filter((s: any) => s.is_sent).length
    }
  };
}

/**
 * Initializes the background timer on server startup
 */
export function startUnifiedJobScheduler(supabase: SupabaseClient) {
  console.log('[UnifiedScheduler] Initializing 60-second cron heartbeat daemon...');

  // Run initial check after 5 seconds
  setTimeout(() => {
    runSchedulerTick(supabase).catch(err => console.error('[UnifiedScheduler] Initial tick error:', err));
  }, 5000);

  // Heartbeat every 60 seconds (60,000 ms)
  const timer = setInterval(() => {
    runSchedulerTick(supabase).catch(err => console.error('[UnifiedScheduler] Interval tick error:', err));
  }, 60000);

  return timer;
}
