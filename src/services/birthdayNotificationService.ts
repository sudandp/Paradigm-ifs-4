import { SupabaseClient } from '@supabase/supabase-js';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function getISTDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + IST_OFFSET);
}

function formatDateMMDD(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function formatDateDisplay(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

export interface BirthdayMatch {
  userId?: string;
  name: string;
  dob: string; // YYYY-MM-DD
  isTomorrow: boolean;
  isToday: boolean;
  reportingManagerId?: string | null;
  roleId?: string;
  email?: string;
  phone?: string;
  source: 'users' | 'onboarding';
}

/**
 * Dispatches Push Notifications via the Supabase send-notification Edge Function
 */
async function dispatchFCMNotification(
  supabaseUrl: string,
  serviceKey: string,
  recipientUserIds: string[],
  title: string,
  message: string,
  metadata: any
) {
  if (!supabaseUrl || !serviceKey || recipientUserIds.length === 0) return;

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        userIds: recipientUserIds,
        title,
        message,
        metadata
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`[BirthdayService] FCM Edge Function returned status ${resp.status}:`, errText);
    } else {
      console.log(`[BirthdayService] 📲 FCM Push sent to ${recipientUserIds.length} recipient(s) for "${title}"`);
    }
  } catch (err: any) {
    console.error('[BirthdayService] Failed to dispatch FCM notification:', err.message);
  }
}

/**
 * Finds all active HR Ops and HR Recruitment users who should receive birthday alerts
 */
async function getHROpsAndRecruitmentUserIds(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data: hrUsers, error } = await supabase
      .from('users')
      .select('id, name, role_id, status, is_blocked, left_date')
      .in('role_id', ['hr_ops', 'hr_recruitment', 'hr', 'hr_onboaring', 'hr_onboarding'])
      .eq('status', 'active');

    if (error) {
      console.warn('[BirthdayService] Failed to fetch HR users:', error.message);
      return [];
    }

    return (hrUsers || [])
      .filter(u => u.status === 'active' && !u.is_blocked && !u.left_date)
      .map(u => u.id);
  } catch (err: any) {
    console.error('[BirthdayService] Error fetching HR user IDs:', err.message);
    return [];
  }
}

/**
 * Retrieves today's and tomorrow's birthday candidates across active employees
 * Rule: If employee is NOT active (status !== 'active' or has left), consider as left and DO NOT send reminder!
 */
export async function getUpcomingBirthdays(
  supabase: SupabaseClient,
  targetDateIST: Date = getISTDate()
): Promise<{ today: BirthdayMatch[]; tomorrow: BirthdayMatch[] }> {
  const todayMMDD = formatDateMMDD(targetDateIST);
  
  const tomorrowDate = new Date(targetDateIST.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowMMDD = formatDateMMDD(tomorrowDate);

  const todayMatches: BirthdayMatch[] = [];
  const tomorrowMatches: BirthdayMatch[] = [];

  // 1. Scan public.users (STRICTLY ACTIVE EMPLOYEES ONLY)
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, date_of_birth, reporting_manager_id, reporting_manager_2_id, role_id, email, phone, status, is_blocked, left_date')
      .not('date_of_birth', 'is', null)
      .eq('status', 'active');

    if (!error && users) {
      for (const u of users) {
        if (!u.date_of_birth) continue;

        // RULE: If employee is not active, consider as left and DO NOT send reminder
        const isUserActive = u.status === 'active' && !u.is_blocked && !u.left_date;
        if (!isUserActive) {
          continue;
        }

        const dobStr = String(u.date_of_birth);
        const dobMMDD = dobStr.substring(5, 10); // MM-DD

        if (dobMMDD === todayMMDD) {
          todayMatches.push({
            userId: u.id,
            name: u.name,
            dob: dobStr,
            isToday: true,
            isTomorrow: false,
            reportingManagerId: u.reporting_manager_id || u.reporting_manager_2_id || null,
            roleId: u.role_id,
            email: u.email,
            phone: u.phone,
            source: 'users'
          });
        } else if (dobMMDD === tomorrowMMDD) {
          tomorrowMatches.push({
            userId: u.id,
            name: u.name,
            dob: dobStr,
            isToday: false,
            isTomorrow: true,
            reportingManagerId: u.reporting_manager_id || u.reporting_manager_2_id || null,
            roleId: u.role_id,
            email: u.email,
            phone: u.phone,
            source: 'users'
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[BirthdayService] Error scanning users table:', err.message);
  }

  // 2. Scan onboarding_submissions (Only verified, active candidates)
  try {
    const { data: submissions, error } = await supabase
      .from('onboarding_submissions')
      .select('id, employee_id, user_id, personal, status')
      .in('status', ['verified', 'approved']);

    if (!error && submissions) {
      for (const sub of submissions) {
        const dob = sub.personal?.dob;
        if (!dob || typeof dob !== 'string' || dob.length < 10) continue;

        // Verify that the candidate is not marked as left / rejected / terminated
        if (sub.personal?.employment_status === 'left' || sub.personal?.employment_status === 'terminated') {
          continue;
        }

        const dobMMDD = dob.substring(5, 10);
        const candidateName = [sub.personal?.first_name, sub.personal?.last_name].filter(Boolean).join(' ') 
          || sub.personal?.preferred_name 
          || `Staff (${sub.employee_id || 'ID'})`;

        const matchObj: BirthdayMatch = {
          name: candidateName,
          dob,
          isToday: dobMMDD === todayMMDD,
          isTomorrow: dobMMDD === tomorrowMMDD,
          reportingManagerId: sub.user_id || null,
          email: sub.personal?.email,
          phone: sub.personal?.mobile,
          source: 'onboarding'
        };

        if (dobMMDD === todayMMDD) {
          todayMatches.push(matchObj);
        } else if (dobMMDD === tomorrowMMDD) {
          tomorrowMatches.push(matchObj);
        }
      }
    }
  } catch (err: any) {
    console.error('[BirthdayService] Error scanning onboarding submissions:', err.message);
  }

  return { today: todayMatches, tomorrow: tomorrowMatches };
}

/**
 * Core Birthday Notification & FCM Dispatcher
 *
 * Rules:
 * 1. 1 Day Before (Tomorrow's Birthdays):
 *    - Send reminder notification to user's Reporting Manager, HR Ops, and HR Recruitment.
 *    - EXCEPT the user themselves (so it remains a complete surprise!).
 * 2. On the Birthday (Today's Birthdays):
 *    - Send alert to Reporting Manager + HR Ops + HR Recruitment to wish the user.
 *    - Send warm celebratory greeting directly to the celebrant user.
 * 3. Inactive Rule:
 *    - If an employee is NOT active (status !== 'active' or left), consider as left and DO NOT send any reminder!
 */
export async function checkAndDispatchBirthdayNotifications(
  supabase: SupabaseClient,
  supabaseUrl: string = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  serviceKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
): Promise<{
  advanceSent: number;
  todaySent: number;
  details: string[];
}> {
  const nowIST = getISTDate();
  const currentYear = nowIST.getUTCFullYear();
  const tomorrowDate = new Date(nowIST.getTime() + 24 * 60 * 60 * 1000);
  const formattedTomorrow = formatDateDisplay(tomorrowDate);

  console.log(`[BirthdayService] 🎂 Running Birthday Check for IST Date: ${formatDateDisplay(nowIST)} (Tomorrow: ${formattedTomorrow})`);

  const { today, tomorrow } = await getUpcomingBirthdays(supabase, nowIST);
  const hrUserIds = await getHROpsAndRecruitmentUserIds(supabase);

  const details: string[] = [];
  let advanceSent = 0;
  let todaySent = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: 1 DAY BEFORE REMINDER (Birthday Tomorrow)
  // Recipients: Reporting Manager + HR Ops + HR Recruitment (EXCEPT the user!)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const celebrant of tomorrow) {
    const dedupKey = `bday_advance_${celebrant.userId || celebrant.name}_${currentYear}`;

    // Target recipient pool: Reporting Manager + HR Ops + HR Recruitment
    const recipientSet = new Set<string>(hrUserIds);

    // Verify reporting manager is active before adding
    if (celebrant.reportingManagerId) {
      try {
        const { data: mgrUser } = await supabase
          .from('users')
          .select('id, status, is_blocked, left_date')
          .eq('id', celebrant.reportingManagerId)
          .single();

        if (mgrUser && mgrUser.status === 'active' && !mgrUser.is_blocked && !mgrUser.left_date) {
          recipientSet.add(mgrUser.id);
        }
      } catch (_) {}
    }

    // STRICT RULE: EXCEPT that user! Celebrant must NOT receive the advance reminder (Keep it a surprise!)
    if (celebrant.userId) {
      recipientSet.delete(celebrant.userId);
    }

    const recipients = Array.from(recipientSet);
    if (recipients.length === 0) continue;

    // Check if advance notification already dispatched today to prevent duplicates
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('id')
      .contains('metadata', { dedup_key: dedupKey })
      .limit(1);

    if (existingNotifs && existingNotifs.length > 0) {
      console.log(`[BirthdayService] Advance notification for ${celebrant.name} already dispatched this year. Skipping.`);
      continue;
    }

    const title = `🎂 Birthday Reminder: Tomorrow!`;
    const message = `Tomorrow (${formattedTomorrow}) is ${celebrant.name}'s birthday! Please ensure wishes and celebration plans are prepared.`;

    const inAppNotifications = recipients.map(rId => ({
      user_id: rId,
      message: `${title}: ${message}`,
      type: 'info',
      severity: 'normal',
      is_read: false,
      link_to: '/admin/employees',
      metadata: {
        source: 'birthday_engine',
        bday_type: 'advance_1day',
        celebrant_name: celebrant.name,
        celebrant_user_id: celebrant.userId || null,
        dedup_key: dedupKey
      }
    }));

    try {
      const { error: insertErr } = await supabase.from('notifications').insert(inAppNotifications);
      if (insertErr) {
        console.warn(`[BirthdayService] Failed to insert advance notification for ${celebrant.name}:`, insertErr.message);
      } else {
        advanceSent += recipients.length;
        details.push(`1-Day Advance: Notified ${recipients.length} manager(s)/HR for ${celebrant.name}`);
        console.log(`[BirthdayService] ✅ Dispatched 1-day advance reminder for ${celebrant.name} to ${recipients.length} recipients`);

        // Send FCM push notification to devices
        await dispatchFCMNotification(
          supabaseUrl,
          serviceKey,
          recipients,
          title,
          message,
          { source: 'birthday_engine', dedup_key: dedupKey }
        );
      }
    } catch (e: any) {
      console.error(`[BirthdayService] Error in advance notification dispatch for ${celebrant.name}:`, e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: TODAY'S BIRTHDAY NOTIFICATION (Presented Today)
  // Recipients: Reporting Manager + HR Ops + HR Recruitment + Celebrant Greeting
  // ═══════════════════════════════════════════════════════════════════════════
  for (const celebrant of today) {
    const dedupKey = `bday_today_${celebrant.userId || celebrant.name}_${currentYear}`;

    // Check if today's notification already dispatched
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('id')
      .contains('metadata', { dedup_key: dedupKey })
      .limit(1);

    if (existingNotifs && existingNotifs.length > 0) {
      console.log(`[BirthdayService] Today's notification for ${celebrant.name} already dispatched. Skipping.`);
      continue;
    }

    // 1. Notify Managers & HR (to wish the employee)
    const mgrRecipientSet = new Set<string>(hrUserIds);
    if (celebrant.reportingManagerId) {
      try {
        const { data: mgrUser } = await supabase
          .from('users')
          .select('id, status, is_blocked, left_date')
          .eq('id', celebrant.reportingManagerId)
          .single();

        if (mgrUser && mgrUser.status === 'active' && !mgrUser.is_blocked && !mgrUser.left_date) {
          mgrRecipientSet.add(mgrUser.id);
        }
      } catch (_) {}
    }
    if (celebrant.userId) {
      mgrRecipientSet.delete(celebrant.userId);
    }

    const mgrRecipients = Array.from(mgrRecipientSet);
    const mgrTitle = `🎉 Birthday Today: ${celebrant.name}!`;
    const mgrMessage = `Today is ${celebrant.name}'s birthday! Wish them a fantastic day and happy year ahead!`;

    const notificationsToInsert: any[] = mgrRecipients.map(rId => ({
      user_id: rId,
      message: `${mgrTitle}: ${mgrMessage}`,
      type: 'info',
      severity: 'normal',
      is_read: false,
      link_to: '/admin/employees',
      metadata: {
        source: 'birthday_engine',
        bday_type: 'today_manager_alert',
        celebrant_name: celebrant.name,
        celebrant_user_id: celebrant.userId || null,
        dedup_key: dedupKey
      }
    }));

    // 2. Celebrant greeting (sent to the user themselves!)
    if (celebrant.userId) {
      notificationsToInsert.push({
        user_id: celebrant.userId,
        message: `🎉 Happy Birthday, ${celebrant.name}! Wishing you a wonderful year filled with joy and success from all of us at Paradigm!`,
        type: 'celebration',
        severity: 'normal',
        is_read: false,
        link_to: '/profile',
        metadata: {
          source: 'birthday_engine',
          bday_type: 'today_celebrant_greeting',
          celebrant_name: celebrant.name,
          dedup_key: `${dedupKey}_celebrant`
        }
      });
    }

    try {
      const { error: insertErr } = await supabase.from('notifications').insert(notificationsToInsert);
      if (insertErr) {
        console.warn(`[BirthdayService] Failed to insert today's notification for ${celebrant.name}:`, insertErr.message);
      } else {
        todaySent += notificationsToInsert.length;
        details.push(`Today Birthday: Dispatched ${notificationsToInsert.length} alerts for ${celebrant.name}`);
        console.log(`[BirthdayService] 🎂 Sent today's birthday notifications for ${celebrant.name}`);

        // FCM push to managers
        if (mgrRecipients.length > 0) {
          await dispatchFCMNotification(supabaseUrl, serviceKey, mgrRecipients, mgrTitle, mgrMessage, {
            source: 'birthday_engine',
            dedup_key: dedupKey
          });
        }

        // FCM push to celebrant
        if (celebrant.userId) {
          await dispatchFCMNotification(
            supabaseUrl,
            serviceKey,
            [celebrant.userId],
            `🎉 Happy Birthday, ${celebrant.name}!`,
            `Wishing you a joyful and wonderful birthday from everyone at Paradigm!`,
            { source: 'birthday_engine', dedup_key: `${dedupKey}_celebrant` }
          );
        }
      }
    } catch (e: any) {
      console.error(`[BirthdayService] Error in today's notification dispatch for ${celebrant.name}:`, e.message);
    }
  }

  return { advanceSent, todaySent, details };
}
