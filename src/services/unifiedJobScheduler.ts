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
}

/**
 * Manual trigger execution on-demand
 */
export async function executeJobNow(
  supabase: SupabaseClient,
  jobType: 'broadcast' | 'automated' | 'email',
  jobId: string
) {
  console.log(`[UnifiedScheduler] Manual 'Run Now' triggered for ${jobType} ID: ${jobId}`);

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
        test_mode: true 
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
