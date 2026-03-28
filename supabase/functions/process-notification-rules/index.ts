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
    const body = await _req.json().catch(() => ({}));
    const { rule_id, test_mode } = body;
    const isTestMode = !!test_mode;

    console.log(`[DEBUG] Request Params: rule_id=${rule_id}, test_mode=${isTestMode}`);

    const [rulesRes, settingsRes] = await Promise.all([
      rule_id 
        ? supabase.from('automated_notification_rules').select('*').eq('id', rule_id)
        : supabase.from('automated_notification_rules').select('*').eq('is_active', true),
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single()
    ]);

    if (rulesRes.error) throw rulesRes.error;
    const allRules = rulesRes.data;
    const attendanceSettings = settingsRes.data ? toCamelCase(settingsRes.data.attendance_settings) : {};
    
    console.log(`[DEBUG] Found ${allRules.length} rules to process`);
    allRules.forEach((r: any) => console.log(`[DEBUG]   Rule: "${r.name}" | trigger=${r.trigger_type} | time=${r.config?.time} | category=${r.target_category}`));
    
    // Map roles to categories (office, field, site)
    const roleMapping = attendanceSettings.missedCheckoutConfig?.roleMapping || {};
    console.log(`[DEBUG] roleMapping from settings: ${JSON.stringify(roleMapping)}`);
    
    const categoryByRoleId = new Map<string, string>();
    Object.entries(roleMapping).forEach(([category, roleIds]) => {
      if (Array.isArray(roleIds)) {
        roleIds.forEach(id => categoryByRoleId.set(id, category));
      }
    });
    console.log(`[DEBUG] categoryByRoleId map has ${categoryByRoleId.size} entries`);

    const results: Array<{user: string, rule: string}> = [];
    const now = new Date(); // Original UTC Time
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    
    console.log(`[DEBUG] Current IST: ${nowIST.getUTCHours()}:${String(nowIST.getUTCMinutes()).padStart(2, '0')}`);
    
    // Day/Month variables need to be evaluated based on the IST date
    const dayOfWeek = nowIST.getUTCDay();
    const dayOfMonth = nowIST.getUTCDate();
    const monthOfYear = nowIST.getUTCMonth() + 1;

    for (const rule of allRules) {
      const shouldProcess = isTestMode || shouldProcessRule(rule, nowIST, dayOfWeek, dayOfMonth, monthOfYear);
      console.log(`[DEBUG] Rule "${rule.name}" shouldProcess=${shouldProcess}`);
      if (!shouldProcess) continue;

      const targets = await getTargetsForRule(supabase, rule, attendanceSettings, categoryByRoleId, now, nowIST, istOffset, isTestMode);
      console.log(`[DEBUG] Rule "${rule.name}" found ${targets.length} targets`);
      
      if (targets.length > 0) {
        await processNotifications(supabase, rule, targets, rule.config?.time || '', results, isTestMode);
        
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

    console.log(`[DEBUG] Final results: ${results.length} notifications sent`);
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

async function getTargetsForRule(supabase: any, rule: any, attendanceSettings: any, categoryByRoleId: Map<string, string>, _nowUTC: Date, nowIST: Date, istOffset: number, isTestMode: boolean) {
  // Proper IST Midnight converted back to actual UTC string for database queries
  const midnightIST = new Date(nowIST);
  midnightIST.setUTCHours(0, 0, 0, 0);
  const startOfTodayUTC = new Date(midnightIST.getTime() - istOffset);
  
  const targetCategory = rule.target_category || rule.targetCategory || 'all';
  const targets = [];
  
  // Duration offset in minutes (e.g. late by 30 mins)
  const durationOffset = rule.config?.durationMinutes || 0;

  if (rule.trigger_type === 'missed_punch_out') {
    // Has a user punched in but not punched out?
    const { data: latestEvents } = await supabase.from('attendance_events').select('user_id, type, location_name').gt('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: false });
    
    console.log(`[DEBUG] missed_punch_out: Found ${latestEvents?.length || 0} events today (since ${startOfTodayUTC.toISOString()})`);
    
    // Get unique latest event per user
    const userLatest = new Map();
    latestEvents?.forEach((e: any) => { if(!userLatest.has(e.user_id)) userLatest.set(e.user_id, e); });
    
    console.log(`[DEBUG] missed_punch_out: ${userLatest.size} unique users with events today`);
    
    // Fetch user details for category filtering
    const userIds = Array.from(userLatest.keys());
    const { data: userData } = await supabase.from('users').select('id, name, role_id').in('id', userIds);
    const userCategoryMap = new Map();
    userData?.forEach((u: any) => {
      const cat = categoryByRoleId.get(u.role_id) || 'office';
      userCategoryMap.set(u.id, cat);
      console.log(`[DEBUG]   User "${u.name}" role=${u.role_id} → category=${cat}`);
    });

    for (const [userId, event] of userLatest.entries()) {
      const userCat = userCategoryMap.get(userId);
      console.log(`[DEBUG]   Checking user ${userId}: lastEvent=${event.type}, category=${userCat}, targetCategory=${targetCategory}`);
      
      if (event.type === 'punch-in') {
        // Filter by category if not 'all'
        if (targetCategory !== 'all' && userCat !== targetCategory) {
          console.log(`[DEBUG]   SKIPPED: category mismatch (user=${userCat}, target=${targetCategory})`);
          continue;
        }

        const shouldNotify = await shouldNotifyUser(supabase, rule, userId, startOfTodayUTC.toISOString(), isTestMode);
        console.log(`[DEBUG]   shouldNotifyUser=${shouldNotify}`);
        if (shouldNotify) {
          targets.push({ userId, site: event.location_name });
          console.log(`[DEBUG]   TARGET ADDED: ${userId}`);
        }
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
        
        // Filter by category if not 'all'
        if (targetCategory !== 'all' && category !== targetCategory) continue;

        const ruleSet = attendanceSettings[category];
        const expectedCheckInStr = ruleSet?.fixedOfficeHours?.checkInTime || '09:00';
        
        const [shiftHour, shiftMin] = expectedCheckInStr.split(':').map(Number);
        
        // Calculate Shift Start in IST
        const shiftStartIST = new Date(midnightIST);
        shiftStartIST.setUTCHours(shiftHour, shiftMin + durationOffset, 0, 0); // Add duration offset here
        
        // If current time is past their allowed window
        if (nowIST.getTime() >= shiftStartIST.getTime()) {
            if (await shouldNotifyUser(supabase, rule, user.id, startOfTodayUTC.toISOString(), isTestMode)) {
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
        if (await shouldNotifyUser(supabase, rule, m.id, startOfTodayUTC.toISOString(), isTestMode)) {
            targets.push({ userId: m.id, site: 'System Approvals' });
        }
      }
    }
  } else if (rule.trigger_type === 'daily_summary') {
    // Proactive system-wide messages (like Daily Summaries)
    const { data: users } = await supabase.from('users').select('id, role_id').eq('is_active', true);
      for (const user of users || []) {
         const category = categoryByRoleId.get(user.role_id) || 'office';
         if (targetCategory !== 'all' && category !== targetCategory) continue;

         if (await shouldNotifyUser(supabase, rule, user.id, startOfTodayUTC.toISOString(), isTestMode)) {
           targets.push({ userId: user.id });
         }
      }
    } else {
      // Unrecognized event-driven rules should not blast everyone blindly.
      // Event-driven rules (e.g. 'check_in') must be triggered by actual application events, not the cron schedule.
      console.log(`[Warning] Automated Edge Function skipped rule '${rule.name}' with event-driven trigger '${rule.trigger_type}'.`);
    }
  return targets;
}

// Ensure we respect max alerts and cooldowns
async function shouldNotifyUser(supabase: any, rule: any, userId: string, startOfTodayUTCStr: string, isTestMode: boolean) {
  if (isTestMode) return true;

  const maxAlerts = rule.max_alerts || 1;
  const cooldownMinutes = rule.cooldown_minutes || 0;

  const { data: logs, error } = await supabase.from('automated_notification_logs')
    .select('created_at')
    .eq('rule_id', rule.id)
    .eq('user_id', userId)
    .gt('created_at', startOfTodayUTCStr)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`[shouldNotifyUser] Error fetching logs:`, error.message);
    return false;
  }

  // 1. Max Alerts check
  if (logs && logs.length >= maxAlerts) {
    console.log(`[shouldNotifyUser] User ${userId} reached max alerts (${maxAlerts}) for rule ${rule.id}`);
    return false;
  }

  // 2. Cooldown check
  if (logs && logs.length > 0 && cooldownMinutes > 0) {
    const lastLogTime = new Date(logs[0].created_at).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastLogTime) / (1000 * 60);
    
    if (diffMinutes < cooldownMinutes) {
      console.log(`[shouldNotifyUser] Cooldown active for user ${userId} (diff=${diffMinutes.toFixed(1)}m, cooldown=${cooldownMinutes}m)`);
      return false;
    }
  }

  return true;
}

async function processNotifications(supabase: any, rule: any, targets: any[], checkTime: string, results: any[], isTestMode: boolean = false) {
  if (targets.length === 0) return;
  
  // Pre-fetch template if email is enabled
  let emailTemplate: any = null;
  if (rule.enable_email && rule.email_template_id) {
    const { data: temp } = await supabase.from('email_templates').select('*').eq('id', rule.email_template_id).single();
    emailTemplate = temp;
  }
  
  for (const target of targets) {
    const { data: user } = await supabase.from('users').select('name, email, reporting_manager_id').eq('id', target.userId).single();
    const userName = user?.name || 'User';
    const userEmail = user?.email;
    const title = rule.push_title_template || 'System Alert';
    const body = (rule.push_body_template || '').replace('{name}', userName).replace('{site}', target.site || 'System').replace('{time}', checkTime);
    const smsMsg = (rule.sms_template || '').replace('{name}', userName).replace('{site}', target.site || 'System').replace('{time}', checkTime);
    
    // Step 1: Insert into notifications table so the alert is visible in-app
    try {
      await supabase.from('notifications').insert({
        user_id: target.userId,
        message: `${title}: ${body}`,
        type: 'warning',
        is_read: false,
        link_to: '/attendance',
        metadata: { rule_id: rule.id, source: 'automation_engine', trigger_type: rule.trigger_type }
      });
      console.log(`[ProcessRules] DB notification inserted for user ${userName}`);
    } catch (dbErr: any) {
      console.error(`[ProcessRules] Failed to insert DB notification for ${userName}:`, dbErr.message);
    }

    // Step 2: Send FCM push notification to web & Android
    const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ 
          userIds: [target.userId], 
          title: title, 
          message: body,
          enable_sms: rule.enable_sms,
          sms_message: smsMsg,
          metadata: { 
            rule_id: rule.id, 
            source: 'automation_engine',
            test_mode: isTestMode 
          }
      })
    });

    // Step 3: Send Email if enabled
    if (rule.enable_email && userEmail) {
      const subject = (emailTemplate?.subject_template || title).replace('{subject}', title);
      let html = emailTemplate?.body_template || `<div><h2>${title}</h2><p>${body}</p></div>`;
      
      // Basic variable replacement
      html = html.replace(/{name}/g, userName)
                 .replace(/{message}/g, body)
                 .replace(/{subject}/g, title)
                 .replace(/{date}/g, new Date().toLocaleDateString('en-IN'))
                 .replace(/{time}/g, checkTime);

      fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          to: userEmail,
          subject,
          html,
          ruleId: rule.id,
          templateId: rule.email_template_id
        })
      }).catch(err => console.error(`[ProcessRules] Email failed for ${userName}:`, err.message));
    }

    // Step 4: Log result
    if (pushResp.ok) {
      await supabase.from('automated_notification_logs').insert({ 
          rule_id: rule.id, 
          user_id: target.userId, 
          trigger_type: rule.trigger_type, 
          channel: rule.enable_push ? 'push' : (rule.enable_email ? 'email' : 'sms'), 
          status: 'sent' 
      });
      results.push({ user: userName, rule: rule.name });
    } else {
        const errBody = await pushResp.text();
        console.error(`[ProcessRules] Push failed for ${userName}:`, errBody);
        await supabase.from('automated_notification_logs').insert({ 
          rule_id: rule.id, 
          user_id: target.userId, 
          trigger_type: rule.trigger_type, 
          channel: rule.enable_push ? 'push' : 'sms', 
          status: 'failed',
          metadata: { error: errBody }
      });
    }

    // Notify Manager
    if (rule.config?.notifyManager && user?.reporting_manager_id) {
       const managerBody = `Manager Copy [${userName}]: ${body}`;
       const managerSmsMsg = `Manager Copy [${userName}]: ${smsMsg}`;
       
       // Insert DB notification for manager
       try {
         await supabase.from('notifications').insert({
           user_id: user.reporting_manager_id,
           message: `${title}: ${managerBody}`,
           type: 'info',
           is_read: false,
           link_to: '/attendance',
           metadata: { rule_id: rule.id, source: 'automation_engine', is_manager_copy: true, original_user: userName }
         });
       } catch (e: any) {
         console.error(`[ProcessRules] Failed to insert manager DB notification:`, e.message);
       }

       const managerPushResp = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ 
              userIds: [user.reporting_manager_id], 
              title: title, 
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
