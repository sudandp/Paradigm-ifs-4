
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 0. Parse Request Body
    let isManualOverride = false;
    let manualSettings = null;
    try {
      const body = await req.json();
      isManualOverride = !!body.manual;
      manualSettings = body.settings;
    } catch {
      // No body or invalid body is fine, defaults to false
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Resolve Settings (DB or Manual Override)
    let attendanceSettings = manualSettings;
    
    if (attendanceSettings) {
      console.log('Using manual settings override from request body');
    } else {
      console.log('Fetching settings from database...');
      const { data: globalSettings, error: settingsError } = await supabaseClient
        .from('settings')
        .select('attendance_settings')
        .eq('id', 'singleton')
        .single();

      if (settingsError) throw new Error(`Failed to fetch settings: ${settingsError.message}`);
      attendanceSettings = globalSettings?.attendance_settings || {};
    }
    
    const config = attendanceSettings.missedCheckoutConfig;
    const enabledGroups = config?.enabledGroups || ['office'];
    const roleMapping = config?.roleMapping || {};

    console.log(`Enabled groups for processing: ${enabledGroups.join(', ')}`);
    console.log(`Role mapping: ${JSON.stringify(roleMapping)}`);

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const currentHour = istDate.getUTCHours();
    const currentMinute = istDate.getUTCMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute;

    interface GroupResult {
      status: 'skipped' | 'completed' | 'error';
      reason?: string;
      configuredTime?: string;
      currentTime?: string;
      usersProcessed?: number;
      processedSummary?: string;
    }

    interface ProcessReport {
      executionTime: string;
      groups: Record<string, GroupResult>;
    }

    const report: ProcessReport = {
      executionTime: istDate.toISOString(),
      groups: {}
    };

    // 2. Process Each Staff Category Independently
    const staffCategories = ['office', 'field', 'site'] as const;
    
    for (const group of staffCategories) {
      if (!enabledGroups.includes(group)) {
        report.groups[group] = { status: 'skipped', reason: 'group not enabled' };
        continue;
      }

      const rules = attendanceSettings[group];
      if (!rules) {
        report.groups[group] = { status: 'skipped', reason: 'rules not found' };
        continue;
      }

      // Site staff with shift management enabled punch out manually — skip auto-checkout.
      // Admin can still force-checkout via the manual override button.
      if (group === 'site' && rules.enableShiftManagement && !isManualOverride) {
        report.groups[group] = { status: 'skipped', reason: 'shift management enabled — site staff punch out manually' };
        console.log(`[site] Skipped: enableShiftManagement is ON, site staff handle their own punch-out.`);
        continue;
      }

      // Check Timing for this specific group
      const checkoutTime = rules.fixedOfficeHours?.checkOutTime || '19:30';
      // Handle both ':' and '.' as separators
      const timeParts = checkoutTime.includes('.') ? checkoutTime.split('.') : checkoutTime.split(':');
      const [confHour, confMinute] = timeParts.map(Number);
      const configuredTimeVal = confHour * 60 + (confMinute || 0);
      const isPastTime = currentTimeVal >= configuredTimeVal;

      if (!isPastTime && !isManualOverride) {
        report.groups[group] = { 
          status: 'skipped', 
          reason: 'before checkout time', 
          configuredTime: checkoutTime,
          currentTime: `${currentHour}:${currentMinute}`
        };
        continue;
      }

      // Get Roles for this group
      const rolesToProcessSet = new Set<string>();
      const mappedRoles = roleMapping[group];
      
      if (mappedRoles && mappedRoles.length > 0) {
        mappedRoles.forEach((r: string) => rolesToProcessSet.add(r.toLowerCase()));
      } else {
        // Default Role Logic (with robust fallbacks)
        if (group === 'office') {
          ['admin', 'hr', 'finance', 'developer', 'operation_manager', 'super_admin', 'superadmin', 'back_office_staff', 'hr_ops', 'management'].forEach(r => rolesToProcessSet.add(r));
        } else if (group === 'field') {
          ['field_staff', 'field_officer', 'technical_reliever', 'supervisor', 'site_supervisor', 'operation_manager', 'operations_manager'].forEach(r => rolesToProcessSet.add(r));
        } else if (group === 'site') {
          ['site_manager', 'security_guard', 'supervisor', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter', 'afm_-_soft', 'associate_facility_manager', 'afm_-_technical', 'asst_facility_manager_operations', 'asst_facility_manager', 'asst_manager_civil_engineer'].forEach(r => rolesToProcessSet.add(r));
        }
      }

      const roles = Array.from(rolesToProcessSet);
      if (roles.length === 0) {
        report.groups[group] = { status: 'skipped', reason: 'no roles configured' };
        continue;
      }

      // Fetch Users in these roles
      const { data: rawUsers, error: userError } = await supabaseClient
        .from('users')
        .select('id, name, role_id');

      if (userError) {
        report.groups[group] = { status: 'error', reason: userError.message };
        continue;
      }

      // Manual filtering for case-insensitive role matching
      const users = rawUsers.filter(u => {
        const role = u.role_id?.toLowerCase();
        return roles && roles.includes(role);
      });

      // Process Users
      let processed = 0;
      const groupProcessedUsers = [];

      for (const user of users) {
        const { data: events, error: eventError } = await supabaseClient
            .from('attendance_events')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
            .limit(1);

        if (eventError || !events || events.length === 0) continue;
        
        const lastEvent = events[0];
        
        // Robust check: Is the user still active? (i.e., not checked out)
        if (lastEvent.type !== 'punch-out') {
            const eventDate = new Date(lastEvent.timestamp);
            const hoursDiff = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);

            // TECHNICAL RELIEVER: Skip auto-checkout entirely.
            // They work extended/cross-day OT shifts and must close sessions manually.
            // If they forget, they must apply for correction via the app.
            const userRole = user.role_id?.toLowerCase();
            if (userRole === 'technical_reliever') {
                console.log(`[${group}] Skipped auto-checkout for ${user.name} (technical_reliever) — session left open for manual close or correction.`);
                
                // Notify employee about open session
                await supabaseClient.from('notifications').insert({
                    user_id: user.id,
                    message: `⚠️ You have an open attendance session from ${new Date(lastEvent.timestamp).toLocaleDateString('en-IN')}. Please close it (Site OT Out → Punch Out) or apply for a correction.`,
                    type: 'warning',
                    is_read: false
                });

                // Notify reporting manager
                const { data: userData } = await supabaseClient
                    .from('users')
                    .select('reporting_manager_id, name')
                    .eq('id', user.id)
                    .single();

                if (userData?.reporting_manager_id) {
                    await supabaseClient.from('notifications').insert({
                        user_id: userData.reporting_manager_id,
                        message: `⚠️ ${userData.name} (Technical Reliever) has an unclosed attendance session from ${new Date(lastEvent.timestamp).toLocaleDateString('en-IN')}. They need to close it or submit a correction.`,
                        type: 'warning',
                        is_read: false
                    });
                }

                // Audit log
                await supabaseClient.from('attendance_audit_logs').insert({
                    action: 'TECHNICAL_RELIEVER_OPEN_SESSION',
                    performed_by: null,
                    target_user_id: user.id,
                    details: {
                        message: `Auto-checkout skipped for ${user.name} (technical_reliever). Session still open.`,
                        original_event: lastEvent.type,
                        original_timestamp: lastEvent.timestamp,
                        hours_open: hoursDiff.toFixed(1)
                    }
                });

                groupProcessedUsers.push(`${user.name} (SKIPPED - technical_reliever)`);
                continue; // Skip auto-checkout for this user
            }

            // If checked in within last 24 hours
            if (hoursDiff < 24) {
                // Calculate punch-out timestamp
                let punchOutTimestamp;
                if (isManualOverride) {
                    punchOutTimestamp = now.toISOString();
                } else {
                    const targetIST = new Date(istDate);
                    targetIST.setUTCHours(confHour, confMinute, 0, 0);
                    const targetUTC = new Date(targetIST.getTime() - istOffset);
                    punchOutTimestamp = targetUTC.toISOString();
                }
                
                // 1. Insert Check-out
                const { error: insertError } = await supabaseClient
                    .from('attendance_events')
                    .insert({
                        user_id: user.id,
                        timestamp: punchOutTimestamp,
                        type: 'punch-out',
                        location_name: isManualOverride ? 'Manual Force Check-out' : 'Auto Check-out',
                        reason: isManualOverride ? 'Force Punch-out: Admin Trigger' : 'Auto-checkout: Shift End',
                        is_manual: true,
                        device_info: { device: 'System', os: 'Cron', browser: 'EdgeFunction' },
                        work_type: lastEvent.work_type // Inherit work type
                    });
                
                if (!insertError) {
                    processed++;
                    groupProcessedUsers.push(user.name);
                    
                    // 2. Log to Audit
                    await supabaseClient.from('attendance_audit_logs').insert({
                        action: isManualOverride ? 'MANUAL_FORCE_CHECKOUT' : 'AUTO_MISSED_CHECKOUT',
                        performed_by: '00000000-0000-0000-0000-000000000000',
                        target_user_id: user.id,
                        details: { 
                            message: isManualOverride 
                                ? `Manual force check-out triggered at ${istDate.toLocaleTimeString()} (${group} staff)` 
                                : `Auto check-out triggered at ${checkoutTime} (${group} staff)`,
                            original_event: lastEvent.type,
                            original_timestamp: lastEvent.timestamp
                        }
                    });
                
                    // 3. Notification
                    await supabaseClient.from('notifications').insert({
                        user_id: user.id,
                        message: isManualOverride 
                            ? `Notice: You were manually checked out by an administrator at ${istDate.toLocaleTimeString()}.` 
                            : `Notice: You were automatically checked out at ${checkoutTime} as per ${group} hours.`,
                        type: 'info',
                        is_read: false
                    });
                }
            }
        }
      }

      report.groups[group] = { 
        status: 'completed', 
        usersProcessed: processed,
        processedSummary: groupProcessedUsers.join(', ')
      };
      
      console.log(`[${group}] Completed: Processed ${processed} users: ${groupProcessedUsers.join(', ')}`);
    }

    console.log('Final Report:', JSON.stringify(report, null, 2));

    return new Response(JSON.stringify(report), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
