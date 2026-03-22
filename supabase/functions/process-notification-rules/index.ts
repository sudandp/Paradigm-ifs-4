// deno-lint-ignore-file no-explicit-any
// @ts-ignore - Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno environment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore - Deno global
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore - Deno global
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

serve(async (_req: Request) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const [rulesRes, settingsRes] = await Promise.all([
      supabase.from('automated_notification_rules').select('*').eq('is_active', true),
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single()
    ]);

    if (rulesRes.error) throw rulesRes.error;
    const allRules = rulesRes.data;
    const attendanceSettings = settingsRes.data ? toCamelCase(settingsRes.data.attendance_settings) : {};
    
    // Map roles to categories (office, field, site)
    const roleMapping = attendanceSettings.missedCheckoutConfig?.roleMapping || {};
    const categoryByRoleId = new Map<string, string>();
    Object.entries(roleMapping).forEach(([category, roleIds]) => {
      if (Array.isArray(roleIds)) {
        roleIds.forEach(id => categoryByRoleId.set(id, category));
      }
    });

    const results: Array<{user: string, rule: string}> = [];
    const now = new Date(); // Original UTC Time
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    
    // Day/Month variables need to be evaluated based on the IST date
    const dayOfWeek = nowIST.getUTCDay();
    const dayOfMonth = nowIST.getUTCDate();
    const monthOfYear = nowIST.getUTCMonth() + 1;

    for (const rule of allRules) {
      if (!shouldProcessRule(rule, nowIST, dayOfWeek, dayOfMonth, monthOfYear)) continue;

      const targets = await getTargetsForRule(supabase, rule, attendanceSettings, categoryByRoleId, now, nowIST, istOffset);
      
      if (targets.length > 0) {
        await processNotifications(supabase, rule, targets, rule.config?.time || '', results);
        
        // Handle Chaining
        if (rule.config?.chained_rule_id || rule.config?.chainedRuleId) {
          const chainedRuleId = rule.config.chained_rule_id || rule.config.chainedRuleId;
          const chainedRule = allRules.find((r: any) => r.id === chainedRuleId);
          if (chainedRule) {
             console.log(`[Chain] Rule ${rule.name} triggered follow-up: ${chainedRule.name}`);
             await processNotifications(supabase, chainedRule, targets, rule.config?.time || '', results);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processedCount: results.length }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
  }
});

function shouldProcessRule(rule: any, nowIST: Date, dow: number, dom: number, moy: number) {
  const config = rule.config || {};
  const [hour, minute] = (config.time || '09:00').split(':').map(Number);
  
  // targetTime object pretending to be IST midnight so we can just set hours/minutes
  const targetTimeIST = new Date(nowIST);
  targetTimeIST.setUTCHours(hour, minute, 0, 0);

  // If the current IST time is earlier than the targeted IST time
  if (nowIST.getTime() < targetTimeIST.getTime()) return false;

  const freq = config.frequency || 'daily';
  if (freq === 'weekly' && config.dayOfWeek !== undefined && config.dayOfWeek !== dow) return false;
  if (freq === 'monthly' && config.dayOfMonth !== undefined && config.dayOfMonth !== dom) return false;
  if (freq === 'yearly' && config.monthOfYear !== undefined && config.monthOfYear !== moy) return false;

  return true;
}

async function getTargetsForRule(supabase: any, rule: any, attendanceSettings: any, categoryByRoleId: Map<string, string>, _nowUTC: Date, nowIST: Date, istOffset: number) {
  // Proper IST Midnight converted back to actual UTC string for database queries
  const midnightIST = new Date(nowIST);
  midnightIST.setUTCHours(0, 0, 0, 0);
  const startOfTodayUTC = new Date(midnightIST.getTime() - istOffset);
  
  const targets = [];
  

  // Duration offset in minutes (e.g. late by 30 mins)
  const durationOffset = rule.config?.durationMinutes || 0;

  if (rule.trigger_type === 'missed_punch_out') {
    // Has a user punched in but not punched out?
    const { data: latestEvents } = await supabase.from('attendance_events').select('user_id, type, location_name').gt('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: false });
    const userLatest = new Map();
    latestEvents?.forEach((e: any) => { if(!userLatest.has(e.user_id)) userLatest.set(e.user_id, e); });
    for (const [userId, event] of userLatest.entries()) {
      if (event.type === 'punch-in') {
        if (await isNotLoggedToday(supabase, rule.id, userId, startOfTodayUTC.toISOString())) targets.push({ userId, site: event.location_name });
      }
    }
  } else if (rule.trigger_type === 'late_arrival') {
    // Has a user not punched in after their expected shift time + durationOffset?
    const { data: users } = await supabase.from('users').select('id, name, role_id').eq('is_active', true);
    const { data: punches } = await supabase.from('attendance_events').select('user_id').gt('timestamp', startOfTodayUTC.toISOString()).eq('type', 'punch-in');
    const punchedIds = new Set(punches?.map((p: any) => p.user_id));
    
    for (const user of users || []) {
      if (!punchedIds.has(user.id)) {
        // Calculate expected shift time based on user role
        const category = categoryByRoleId.get(user.role_id) || 'office';
        const ruleSet = attendanceSettings[category];
        const expectedCheckInStr = ruleSet?.fixedOfficeHours?.checkInTime || '09:00';
        
        const [shiftHour, shiftMin] = expectedCheckInStr.split(':').map(Number);
        
        // Calculate Shift Start in IST
        const shiftStartIST = new Date(midnightIST);
        shiftStartIST.setUTCHours(shiftHour, shiftMin + durationOffset, 0, 0); // Add duration offset here
        
        // If current time is past their allowed window
        if (nowIST.getTime() >= shiftStartIST.getTime()) {
            if (await isNotLoggedToday(supabase, rule.id, user.id, startOfTodayUTC.toISOString())) {
                targets.push({ userId: user.id, site: 'Scheduled Shift (Late)' });
            }
        }
      }
    }
  } else if (rule.trigger_type === 'pending_approval_check') {
    const [leaves, salary] = await Promise.all([
      supabase.from('leaves').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('salary_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ]);
    if ((leaves.count || 0) + (salary.count || 0) > 0) {
      const { data: managers } = await supabase.from('users').select('id').in('role_id', ['admin_id', 'management_id']);
      for (const m of managers || []) {
        if (await isNotLoggedToday(supabase, rule.id, m.id, startOfTodayUTC.toISOString())) {
            targets.push({ userId: m.id, site: 'System Approvals' });
        }
      }
    }
  } else if (rule.trigger_type === 'daily_summary') {
    // Proactive system-wide messages (like Daily Summaries)
    const { data: users } = await supabase.from('users').select('id').eq('is_active', true);
      for (const user of users || []) {
         if (await isNotLoggedToday(supabase, rule.id, user.id, startOfTodayUTC.toISOString())) targets.push({ userId: user.id });
      }
    } else {
      // Unrecognized event-driven rules should not blast everyone blindly.
      // Event-driven rules (e.g. 'check_in') must be triggered by actual application events, not the cron schedule.
      console.log(`[Warning] Automated Edge Function skipped rule '${rule.name}' with event-driven trigger '${rule.trigger_type}'.`);
    }
  return targets;
}

// Ensure we only log once per day per rule per user.
async function isNotLoggedToday(supabase: any, ruleId: string, userId: string, startOfTodayUTCStr: string) {
  const { count } = await supabase.from('automated_notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('rule_id', ruleId)
    .eq('user_id', userId)
    .gt('created_at', startOfTodayUTCStr);
  return count === 0;
}

async function processNotifications(supabase: any, rule: any, targets: any[], checkTime: string, results: any[]) {
  if (targets.length === 0) return;
  
  for (const target of targets) {
    const { data: user } = await supabase.from('users').select('name, reporting_manager_id').eq('id', target.userId).single();
    const userName = user?.name || 'User';
    const body = (rule.push_body_template || '').replace('{name}', userName).replace('{site}', target.site || 'System').replace('{time}', checkTime);
    const smsMsg = (rule.sms_template || '').replace('{name}', userName).replace('{site}', target.site || 'System').replace('{time}', checkTime);
    
    // Notify Employee
    const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ 
          userIds: [target.userId], 
          title: rule.push_title_template || 'System Alert', 
          message: body,
          enable_sms: rule.enable_sms,
          sms_message: smsMsg,
          metadata: { rule_id: rule.id, source: 'automation_engine' }
      })
    });

    if (pushResp.ok) {
      await supabase.from('automated_notification_logs').insert({ 
          rule_id: rule.id, 
          user_id: target.userId, 
          trigger_type: rule.trigger_type, 
          channel: rule.enable_push ? 'push' : 'sms', 
          status: 'sent' 
      });
      results.push({ user: userName, rule: rule.name });
    } else {
        await supabase.from('automated_notification_logs').insert({ 
          rule_id: rule.id, 
          user_id: target.userId, 
          trigger_type: rule.trigger_type, 
          channel: rule.enable_push ? 'push' : 'sms', 
          status: 'failed',
          metadata: { error: await pushResp.text() }
      });
    }

    // Notify Manager
    if (rule.config?.notifyManager && user?.reporting_manager_id) {
       const managerBody = `Manager Copy [${userName}]: ${body}`;
       const managerSmsMsg = `Manager Copy [${userName}]: ${smsMsg}`;
       
       const managerPushResp = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ 
              userIds: [user.reporting_manager_id], 
              title: (rule.push_title_template || 'System Alert'), 
              message: managerBody,
              enable_sms: rule.enable_sms,
              sms_message: managerSmsMsg,
              metadata: { rule_id: rule.id, source: 'automation_engine', original_target: target.userId }
          })
       });

       if (managerPushResp.ok) {
           await supabase.from('automated_notification_logs').insert({ 
              rule_id: rule.id, 
              user_id: user.reporting_manager_id, 
              trigger_type: rule.trigger_type, 
              channel: rule.enable_push ? 'push' : 'sms', 
              status: 'sent',
              metadata: { is_manager_copy: true, original_user: userName }
          });
          results.push({ user: `Manager of ${userName}`, rule: rule.name });
       }
    }
  }
}
