import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 1. SLA Check (48 hours overdue candidates)
async function checkCallsSla() {
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
  const slaThresholdStr = fortyEightHoursAgo.toISOString();

  // Query active candidates in 'new' or 'contacted' stage created more than 48 hours ago
  const { data: candidates, error } = await supabase
    .from('candidate_referrals')
    .select('*')
    .in('current_stage', ['new', 'contacted'])
    .lt('created_at', slaThresholdStr);

  if (error) {
    console.error('[HRM SLA Check] Error fetching candidates:', error.message);
    return;
  }

  console.log(`[HRM SLA Check] Found ${candidates?.length || 0} candidate leads older than 48 hours.`);

  for (const cand of (candidates || [])) {
    // Check if there are call logs
    const { count, error: countError } = await supabase
      .from('hrm_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('candidate_id', cand.id);

    if (countError) {
      console.error(`[HRM SLA Check] Error counting calls for candidate ${cand.id}:`, countError.message);
      continue;
    }

    if (count === 0) {
      // SLA Violation: No calls logged. Notify the assignee or creator.
      const notifyUserId = cand.assigned_hr_id || cand.created_by;
      if (!notifyUserId) continue;

      const message = `SLA Alert: Candidate ${cand.candidate_name} has been in the queue for over 48 hours without any logged calls. Please log contact.`;
      const linkTo = `/hrm/candidate/${cand.id}`;

      // Check if unread alert already exists to prevent duplication
      const { count: existingNotif, error: notifError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', notifyUserId)
        .eq('type', 'warning')
        .eq('is_read', false)
        .like('message', '%SLA Alert%')
        .like('message', `%${cand.candidate_name}%`);

      if (notifError) {
        console.error('[HRM SLA Check] Error checking existing notification:', notifError.message);
        continue;
      }

      if (existingNotif === 0) {
        console.log(`[HRM SLA Check] Dispatching warning notification for candidate ${cand.candidate_name} to user ${notifyUserId}`);
        await supabase.from('notifications').insert({
          user_id: notifyUserId,
          message,
          type: 'warning',
          is_read: false
        });
      }
    }
  }
}

// 2. Probation Alert (7 days prior notification to manager)
async function checkProbationAlerts() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  const { data: candidates, error } = await supabase
    .from('candidate_referrals')
    .select('*')
    .eq('current_stage', 'joined')
    .eq('probation_end_date', targetDateStr);

  if (error) {
    console.error('[HRM Probation Check] Error fetching candidates:', error.message);
    return;
  }

  console.log(`[HRM Probation Check] Found ${candidates?.length || 0} candidates completing probation on ${targetDateStr}.`);

  for (const cand of (candidates || [])) {
    if (!cand.employee_id) continue;

    // Fetch employee details to locate manager
    const { data: employee, error: empError } = await supabase
      .from('users')
      .select('name, reporting_manager_id')
      .eq('id', cand.employee_id)
      .maybeSingle();

    if (empError || !employee) {
      console.error(`[HRM Probation Check] Error fetching employee ${cand.employee_id}:`, empError?.message);
      continue;
    }

    const notifyUserId = employee.reporting_manager_id;
    if (!notifyUserId) continue;

    const message = `Probation Review: Employee ${employee.name}'s probation ends in 7 days on ${targetDate.toLocaleDateString('en-IN')}. Please prepare evaluation reports.`;

    // Check if notification already exists
    const { count: existingNotif } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', notifyUserId)
      .eq('is_read', false)
      .like('message', `%${employee.name}%probation%`);

    if (existingNotif === 0) {
      console.log(`[HRM Probation Check] Dispatching probation alert for ${employee.name} to manager ${notifyUserId}`);
      await supabase.from('notifications').insert({
        user_id: notifyUserId,
        message,
        type: 'task_assigned',
        is_read: false
      });
    }
  }
}

// 3. Bonus Eligibility Check (90-day completed validation)
async function checkBonusEligibility() {
  const todayStr = new Date().toISOString().split('T')[0];

  // Candidates in joined stage whose probation has ended, and bonus is not processed
  const { data: candidates, error } = await supabase
    .from('candidate_referrals')
    .select('*')
    .eq('current_stage', 'joined')
    .lte('probation_end_date', todayStr)
    .or('bonus_eligible.is.null,bonus_eligible.eq.false');

  if (error) {
    console.error('[HRM Bonus Check] Error fetching candidates:', error.message);
    return;
  }

  console.log(`[HRM Bonus Check] Found ${candidates?.length || 0} candidates eligible for bonus checks.`);

  for (const cand of (candidates || [])) {
    console.log(`[HRM Bonus Check] Confirming bonus eligibility for candidate ${cand.candidate_name}`);

    // Update referral details
    const { error: updateError } = await supabase
      .from('candidate_referrals')
      .update({
        bonus_eligible: true,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', cand.id);

    if (updateError) {
      console.error(`[HRM Bonus Check] Failed to update candidate ${cand.id}:`, updateError.message);
      continue;
    }

    // Insert feed log
    await supabase.from('hrm_activity_feed').insert({
      candidate_id: cand.id,
      actor_id: cand.assigned_hr_id || cand.created_by,
      type: 'joined',
      payload: { note: 'Completed 90-day probation. Referral bonus confirmed.' }
    });

    // Notify Referrer
    if (cand.created_by) {
      const message = `Referral Complete: Candidate ${cand.candidate_name} has successfully completed their 90-day probation! Your referral bonus has been approved.`;
      await supabase.from('notifications').insert({
        user_id: cand.created_by,
        message,
        type: 'info',
        is_read: false
      });
    }
  }
}

// Helper to send emails asynchronously in the background (non-blocking)
async function sendHrmEmailAsync(payload: any) {
  try {
    const { sendEmailLogic } = await import('../../api/send-email.js');
    console.log(`[HRM Email Async Automation] Triggering background email to ${payload.to}...`);
    sendEmailLogic(payload, SUPABASE_URL, SUPABASE_SERVICE_KEY)
      .then((res) => {
        console.log(`[HRM Email Async Automation] Successful dispatch to ${payload.to}:`, res);
      })
      .catch((err) => {
        console.error(`[HRM Email Async Automation] Failed to send email to ${payload.to}:`, err.message);
      });
  } catch (error: any) {
    console.error('[HRM Email Async Automation] Trigger error:', error.message);
  }
}

// 4. Call Follow-up Reminder Check
async function checkCallFollowUps() {
  // Query all active candidate referrals (not joined, not rejected)
  const { data: candidates, error } = await supabase
    .from('candidate_referrals')
    .select('*')
    .not('current_stage', 'in', '("joined","rejected")');

  if (error) {
    console.error('[HRM Call Follow-up] Error fetching candidates:', error.message);
    return;
  }

  console.log(`[HRM Call Follow-up] Checking follow-up reminders for ${candidates?.length || 0} active candidate leads.`);

  for (const cand of (candidates || [])) {
    // Find the latest call log for this candidate
    const { data: calls, error: callError } = await supabase
      .from('hrm_call_logs')
      .select('*')
      .eq('candidate_id', cand.id)
      .order('called_at', { ascending: false })
      .limit(1);

    if (callError) {
      console.error(`[HRM Call Follow-up] Error fetching latest call for candidate ${cand.id}:`, callError.message);
      continue;
    }

    const latestCall = calls && calls.length > 0 ? calls[0] : null;
    
    // If the latest call has next_call_at set, and that time is in the past (due or overdue)
    if (latestCall && latestCall.next_call_at && new Date(latestCall.next_call_at) <= new Date()) {
      const notifyUserId = cand.assigned_hr_id || latestCall.called_by;
      if (!notifyUserId) continue;

      // Check if we already sent a reminder notification for this specific next_call_at date
      // to avoid spamming multiple notifications
      const reminderTag = `[Follow-up Call Alert]`;
      const targetTimeStr = new Date(latestCall.next_call_at).toLocaleString('en-IN');
      const message = `${reminderTag} Call reminder for candidate ${cand.candidate_name} (${cand.candidate_role}) scheduled for ${targetTimeStr} is now due. Notes: "${latestCall.notes || 'No notes'}"`;

      const { count: existingNotif, error: notifError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', notifyUserId)
        .eq('is_read', false)
        .like('message', `%${reminderTag}%`)
        .like('message', `%${cand.candidate_name}%`);

      if (notifError) {
        console.error('[HRM Call Follow-up] Error checking existing notification:', notifError.message);
        continue;
      }

      if (existingNotif === 0) {
        console.log(`[HRM Call Follow-up] Triggering reminder for candidate ${cand.candidate_name} to user ${notifyUserId}`);
        
        // 1. In-app notification
        await supabase.from('notifications').insert({
          user_id: notifyUserId,
          message,
          type: 'task_assigned',
          is_read: false
        });

        // 2. Email notification to the assigned HR recruiter
        const { data: hrUser } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', notifyUserId)
          .single();

        if (hrUser && hrUser.email) {
          sendHrmEmailAsync({
            to: hrUser.email,
            subject: `HRM Reminder: Callback Due for Candidate - ${cand.candidate_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #006B3F; border-bottom: 2px solid #006B3F; padding-bottom: 10px;">Callback Follow-Up Reminder</h2>
                <p>Dear <strong>${hrUser.name || 'HR Recruiter'}</strong>,</p>
                <p>This is a reminder that a follow-up callback is now due for candidate <strong>${cand.candidate_name}</strong> (referred for the role of <strong>${cand.candidate_role}</strong>).</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #006B3F; padding: 15px; margin: 15px 0; border-radius: 4px;">
                  <p style="margin: 0 0 8px 0;"><strong>Scheduled Time:</strong> ${new Date(latestCall.next_call_at).toLocaleString('en-IN')}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Previous Call Outcome:</strong> ${latestCall.outcome.replace('_', ' ').toUpperCase()}</p>
                  <p style="margin: 0;"><strong>Recruiter Notes:</strong> "${latestCall.notes || 'N/A'}"</p>
                </div>
                <p>Please contact the candidate as requested and log the new call outcome in the HRM Portal.</p>
                <br>
                <p>Best regards,</p>
                <p><strong>HR Operations System</strong><br>Paradigm Office</p>
              </div>
            `
          });
        }
      }
    }
  }
}

// Master execution launcher
export async function runHrmAutomation() {
  console.log('[HRM Automation] Launching background daemon...');
  await checkCallsSla();
  await checkProbationAlerts();
  await checkBonusEligibility();
  await checkCallFollowUps();
}
