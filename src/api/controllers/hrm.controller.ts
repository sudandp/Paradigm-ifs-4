import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import { sendEmailLogic } from '../../../api/send-email.js';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper to send emails asynchronously in the background (non-blocking)
async function sendHrmEmailAsync(payload: any) {
  try {
    console.log(`[HRM Email Async] Triggering background email to ${payload.to}...`);
    sendEmailLogic(payload, SUPABASE_URL, SUPABASE_SERVICE_KEY)
      .then((res) => {
        console.log(`[HRM Email Async] Successful dispatch to ${payload.to}:`, res);
      })
      .catch((err) => {
        console.error(`[HRM Email Async] Failed to send email to ${payload.to}:`, err.message);
      });
  } catch (error: any) {
    console.error('[HRM Email Async] Trigger error:', error.message);
  }
}

// Helper to simulate SMS/WhatsApp dispatch
async function triggerHrmSmsAsync(mobile: string, message: string) {
  try {
    console.log(`[HRM SMS Async] Mock dispatch to ${mobile}: "${message}"`);
  } catch (error: any) {
    console.error('[HRM SMS Async] SMS trigger error:', error.message);
  }
}

// Helper: Convert snake_case db keys to camelCase API response keys
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

// Helper: Convert camelCase request keys to snake_case db keys
const toSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

// Allowed stage transition map
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  'new': ['contacted'],
  'contacted': ['screened', 'rejected'],
  'screened': ['interview', 'rejected'],
  'interview': ['shortlisted', 'offer', 'rejected'],
  'shortlisted': ['offer', 'rejected'],
  'offer': ['joined', 'rejected'],
  'joined': [],
  'rejected': []
};

// Validates whether the stage change is permitted
function isValidTransition(fromStage: string, toStage: string): boolean {
  const allowed = LEGAL_TRANSITIONS[fromStage] || [];
  return allowed.includes(toStage);
}

// Letter Type codes for ref number formatting
const TYPE_CODES: Record<string, string> = {
  offer: 'OL',
  appointment: 'AL',
  confirmation: 'CL',
  promotion: 'PR',
  increment: 'IN',
  transfer: 'TR',
  warning: 'WL',
  show_cause: 'SC',
  experience: 'EL',
  termination: 'TL'
};

// Resolves template variables within HTML string
function resolveTemplate(html: string, vars: Record<string, string>): string {
  let resolved = html;
  Object.entries(vars).forEach(([key, val]) => {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
  });
  return resolved;
}

// Render HTML content to PDF using Puppeteer
async function generatePdf(htmlContent: string, refNumber: string): Promise<string> {
  const lettersDir = path.resolve('public/letters');
  if (!fs.existsSync(lettersDir)) {
    fs.mkdirSync(lettersDir, { recursive: true });
  }

  const safeRef = refNumber.replace(/[/\\]/g, '_');
  const pdfPath = path.join(lettersDir, `${safeRef}.pdf`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const completeHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; line-height: 1.6; }
            .letter-container { padding: 20px; }
          </style>
        </head>
        <body>
          <div class="letter-container">
            ${htmlContent}
          </div>
        </body>
      </html>
    `;
    await page.setContent(completeHtml, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      printBackground: true
    });
  } finally {
    await browser.close();
  }

  return `/letters/${safeRef}.pdf`;
}

// ─── ENDPOINTS IMPLEMENTATION ───────────────────────────────────────────────

// 1. POST /hrm/calls - Log candidate call
export const logCall = async (req: Request, res: Response) => {
  try {
    const dbPayload = toSnakeCase(req.body);
    const actorId = (req as any).user.id;
    
    dbPayload.called_by = actorId;

    // Log the call
    const { data: callLog, error: callError } = await supabase
      .from('hrm_call_logs')
      .insert(dbPayload)
      .select()
      .single();

    if (callError) throw callError;

    // Query candidate details
    const { data: candidate, error: candidateError } = await supabase
      .from('candidate_referrals')
      .select('current_stage, candidate_name')
      .eq('id', dbPayload.candidate_id)
      .single();

    if (candidateError) throw candidateError;

    // Auto stage transition logic
    if (dbPayload.outcome === 'reached' && candidate.current_stage === 'new') {
      // Move to contacted
      await supabase
        .from('candidate_referrals')
        .update({ current_stage: 'contacted' })
        .eq('id', dbPayload.candidate_id);

      // Insert stage history
      await supabase.from('hrm_candidate_stages').insert({
        candidate_id: dbPayload.candidate_id,
        stage: 'contacted',
        changed_by: actorId,
        reason: 'Auto transitioned: Outcome was reached'
      });

      // Insert stage changed activity
      await supabase.from('hrm_activity_feed').insert({
        candidate_id: dbPayload.candidate_id,
        actor_id: actorId,
        type: 'stage_changed',
        payload: { from_stage: 'new', to_stage: 'contacted', reason: 'Reached via call' }
      });
    }

    // Insert call activity feed entry
    await supabase.from('hrm_activity_feed').insert({
      candidate_id: dbPayload.candidate_id,
      actor_id: actorId,
      type: 'call_logged',
      payload: { outcome: dbPayload.outcome, duration_mins: dbPayload.duration_mins, notes: dbPayload.notes }
    });

    res.status(201).json(toCamelCase(callLog));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. GET /hrm/calls - Retrieve call history paginated
export const getCalls = async (req: Request, res: Response) => {
  try {
    const { candidateId, page = 1, limit = 10 } = req.query;
    const fromIndex = (Number(page) - 1) * Number(limit);
    const toIndex = fromIndex + Number(limit) - 1;

    let query = supabase
      .from('hrm_call_logs')
      .select('*, caller:called_by(name)')
      .order('called_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (candidateId) {
      query = query.eq('candidate_id', candidateId);
    }

    const { data: calls, error } = await query;
    if (error) throw error;

    res.status(200).json(toCamelCase(calls));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. PATCH /hrm/candidates/:id/stage - Transition candidate stage
export const moveStage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stage, reason } = req.body;
    const actorId = (req as any).user.id;

    // Get current stage
    const { data: candidate, error: candError } = await supabase
      .from('candidate_referrals')
      .select('current_stage, candidate_name, candidate_mobile, candidate_email, candidate_role, created_by')
      .eq('id', id)
      .single();

    if (candError) throw candError;

    const fromStage = candidate.current_stage || 'new';

    if (!isValidTransition(fromStage, stage)) {
      return res.status(400).json({
        error: `Invalid stage transition from "${fromStage}" to "${stage}"`
      });
    }

    // Perform update
    const { error: updateError } = await supabase
      .from('candidate_referrals')
      .update({ current_stage: stage })
      .eq('id', id);

    if (updateError) throw updateError;

    // Write stage history
    await supabase.from('hrm_candidate_stages').insert({
      candidate_id: id,
      stage,
      changed_by: actorId,
      reason
    });

    // Write activity log
    await supabase.from('hrm_activity_feed').insert({
      candidate_id: id,
      actor_id: actorId,
      type: 'stage_changed',
      payload: { from_stage: fromStage, to_stage: stage, reason }
    });

    // Trigger Notification for the referrer
    if (candidate.created_by) {
      const isJoined = stage === 'joined';
      const notificationMsg = isJoined
        ? `${candidate.candidate_name} has joined. Bonus processing started.`
        : `Your referral ${candidate.candidate_name} moved to ${stage}`;

      await supabase.from('notifications').insert({
        user_id: candidate.created_by,
        message: notificationMsg,
        type: isJoined ? 'info' : 'task_assigned',
        is_read: false
      });
    }

    // Phase 5: Communication triggers
    const candEmail = candidate.candidate_email;
    const candMobile = candidate.candidate_mobile;
    const candRole = candidate.candidate_role || 'Position';
    
    if (stage === 'joined') {
      // 1. Email to Candidate
      if (candEmail) {
        sendHrmEmailAsync({
          to: candEmail,
          subject: `Welcome to Paradigm Office! - Enrollment Confirmed`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #006B3F; border-bottom: 2px solid #006B3F; padding-bottom: 10px;">Welcome to the Team!</h2>
              <p>Dear <strong>${candidate.candidate_name}</strong>,</p>
              <p>Congratulations! We are delighted to officially welcome you to <strong>Paradigm Office</strong> as a <strong>${candRole}</strong>.</p>
              <p>Your onboarding process has completed successfully. We are excited to have you join our team and look forward to your contributions.</p>
              <br>
              <p>Best regards,</p>
              <p><strong>HR Operations Team</strong><br>Paradigm Office</p>
            </div>
          `
        });
      }

      // 2. SMS to Candidate
      if (candMobile) {
        triggerHrmSmsAsync(candMobile, `Dear ${candidate.candidate_name}, welcome to Paradigm Office! Your onboarding is complete and your joining is confirmed.`);
      }

      // 3. Email to Referrer
      if (candidate.created_by) {
        const { data: referrer } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', candidate.created_by)
          .single();

        if (referrer && referrer.email) {
          sendHrmEmailAsync({
            to: referrer.email,
            subject: `Referral Milestone: ${candidate.candidate_name} has Hired & Joined!`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #006B3F; border-bottom: 2px solid #006B3F; padding-bottom: 10px;">Referral Hired & Joined!</h2>
                <p>Dear <strong>${referrer.name || 'Referrer'}</strong>,</p>
                <p>Great news! Your referred candidate, <strong>${candidate.candidate_name}</strong>, has officially completed onboarding and joined <strong>Paradigm Office</strong> as a <strong>${candRole}</strong>.</p>
                <p>As per our policy, your referral bonus processing has been officially initiated and will be credited to your account upon completion of their initial probation period.</p>
                <p>Thank you for helping us bring great talent to Paradigm Office!</p>
                <br>
                <p>Best regards,</p>
                <p><strong>HR Operations Team</strong><br>Paradigm Office</p>
              </div>
            `
          });
        }
      }
    } else if (stage === 'rejected') {
      // 1. Email to Candidate
      if (candEmail) {
        sendHrmEmailAsync({
          to: candEmail,
          subject: `Paradigm Office - Application Status Update`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #64748b; border-bottom: 2px solid #64748b; padding-bottom: 10px;">Application Status Update</h2>
              <p>Dear <strong>${candidate.candidate_name}</strong>,</p>
              <p>Thank you for your interest in employment opportunities with <strong>Paradigm Office</strong> and for taking the time to participate in our recruitment process for the <strong>${candRole}</strong> position.</p>
              <p>We appreciate the opportunity to review your qualifications. While we were impressed by your background, we have decided to proceed with other candidates whose profiles more closely match our current requirements.</p>
              <p>We will keep your details in our database for future opportunities that align with your skillset. We wish you the absolute best in your professional endeavors.</p>
              <br>
              <p>Best regards,</p>
              <p><strong>HR Operations Team</strong><br>Paradigm Office</p>
            </div>
          `
        });
      }

      // 2. SMS to Candidate
      if (candMobile) {
        triggerHrmSmsAsync(candMobile, `Dear ${candidate.candidate_name}, thank you for participating in Paradigm's recruitment process. We have updated your application status. Check your email for details.`);
      }
    }

    // Auto-drafting letters
    if (stage === 'shortlisted' || stage === 'offer') {
      // Check if an offer letter already exists for this candidate to prevent duplicates
      const { count: existingOfferCount } = await supabase
        .from('hrm_letters')
        .select('*', { count: 'exact', head: true })
        .eq('candidate_id', id)
        .eq('letter_type', 'offer');

      if (existingOfferCount === 0) {
        // Create Offer Letter Draft
        const template = await supabase
          .from('hrm_letter_templates')
          .select('*')
          .eq('letter_type', 'offer')
          .maybeSingle();

        if (template.data) {
          const refNumber = `OL/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
          await supabase.from('hrm_letters').insert({
            candidate_id: id,
            letter_type: 'offer',
            template_snapshot: template.data.body_html,
            ref_number: refNumber,
            status: 'draft',
            version: 1
          });
        }
      }
    } else if (stage === 'joined') {
      // Create Appointment Letter Draft
      const template = await supabase
        .from('hrm_letter_templates')
        .select('*')
        .eq('letter_type', 'appointment')
        .maybeSingle();

      if (template.data) {
        const refNumber = `AL/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
        await supabase.from('hrm_letters').insert({
          candidate_id: id,
          letter_type: 'appointment',
          template_snapshot: template.data.body_html,
          ref_number: refNumber,
          status: 'draft',
          version: 1
        });
      }

      // Update probation end date
      const joiningDate = new Date();
      const probationEnd = new Date();
      probationEnd.setDate(joiningDate.getDate() + 90);

      await supabase
        .from('candidate_referrals')
        .update({
          joining_date: joiningDate.toISOString().split('T')[0],
          probation_end_date: probationEnd.toISOString().split('T')[0]
        })
        .eq('id', id);
    }

    res.status(200).json({ success: true, from_stage: fromStage, to_stage: stage });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. POST /hrm/screening/:candidateId - Upsert Screening form
export const saveScreening = async (req: Request, res: Response) => {
  try {
    const { candidateId } = req.params;
    const formFields = toSnakeCase(req.body);
    const actorId = (req as any).user.id;

    formFields.candidate_id = candidateId;
    formFields.screened_by = actorId;
    formFields.screened_at = new Date().toISOString();

    const { data: form, error } = await supabase
      .from('hrm_screening_forms')
      .upsert(formFields, { onConflict: 'candidate_id' })
      .select()
      .single();

    if (error) throw error;

    // Get current stage of candidate
    const { data: candidate } = await supabase
      .from('candidate_referrals')
      .select('current_stage')
      .eq('id', candidateId)
      .single();

    if (candidate && (candidate.current_stage === 'new' || candidate.current_stage === 'contacted')) {
      // Auto move stage to screened
      await supabase
        .from('candidate_referrals')
        .update({ current_stage: 'screened' })
        .eq('id', candidateId);

      await supabase.from('hrm_candidate_stages').insert({
        candidate_id: candidateId,
        stage: 'screened',
        changed_by: actorId,
        reason: 'Auto transitioned: Screening form submitted'
      });

      await supabase.from('hrm_activity_feed').insert({
        candidate_id: candidateId,
        actor_id: actorId,
        type: 'stage_changed',
        payload: { from_stage: candidate.current_stage, to_stage: 'screened', reason: 'Screening Completed' }
      });
    }

    res.status(200).json(toCamelCase(form));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. GET /hrm/screening/:candidateId - Retrieve Screening details
export const getScreening = async (req: Request, res: Response) => {
  try {
    const { candidateId } = req.params;
    const { data: form, error } = await supabase
      .from('hrm_screening_forms')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (error) throw error;
    if (!form) return res.status(404).json({ error: 'Screening form not found' });

    res.status(200).json(toCamelCase(form));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 6. GET /hrm/feed/:candidateId - Candidate activity feed history
export const getFeed = async (req: Request, res: Response) => {
  try {
    const { candidateId } = req.params;
    const { referrerView = 'false' } = req.query;

    let query = supabase
      .from('hrm_activity_feed')
      .select('*, actor:actor_id(name)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (referrerView === 'true') {
      query = query.eq('visible_to_referrer', true);
    }

    const { data: feed, error } = await query;
    if (error) throw error;

    res.status(200).json(toCamelCase(feed));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 7. GET /hrm/queue - Call Queue & Overdue items list
// Only shows candidates that need HR action (excludes joined/rejected)
export const getQueue = async (req: Request, res: Response) => {
  try {
    const { assignedTo, status = 'all', page = 1 } = req.query;
    const limit = 20;
    const fromIndex = (Number(page) - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    // Call Queue = candidates needing HR follow-up (new + contacted stages)
    let query = supabase
      .from('candidate_referrals')
      .select('*, assigned_hr:users!candidate_referrals_assigned_hr_id_fkey(name)')
      .in('current_stage', ['new', 'contacted']);

    // Filter by assigned HR
    if (status === 'mine' && (req as any).user.id) {
      query = query.eq('assigned_hr_id', (req as any).user.id);
    } else if (assignedTo) {
      query = query.eq('assigned_hr_id', assignedTo);
    }

    const { data: candidates, error } = await query;
    if (error) throw error;

    const enrichedRows: any[] = [];
    const now = new Date();
    const fortyEightHrsAgo = new Date();
    fortyEightHrsAgo.setHours(fortyEightHrsAgo.getHours() - 48);

    for (const cand of candidates || []) {
      // Get last call summary
      const { data: calls } = await supabase
        .from('hrm_call_logs')
        .select('*')
        .eq('candidate_id', cand.id)
        .order('called_at', { ascending: false })
        .limit(1);

      const lastCall = calls && calls.length > 0 ? calls[0] : null;
      let isOverdue = false;

      if (!lastCall) {
        // No call ever made — overdue if created > 48hrs ago
        const createdDate = new Date(cand.created_at);
        if (createdDate < fortyEightHrsAgo) {
          isOverdue = true;
        }
      } else {
        // Has a call log — check if next_call_at is past due
        if (lastCall.next_call_at && new Date(lastCall.next_call_at) < now) {
          isOverdue = true;
        }
        // Also overdue if last call was > 48hrs ago and still not progressed
        const lastCallDate = new Date(lastCall.called_at);
        if (lastCallDate < fortyEightHrsAgo) {
          isOverdue = true;
        }
      }

      const row = {
        ...toCamelCase(cand),
        lastCall: lastCall ? toCamelCase(lastCall) : null,
        isOverdue
      };

      // Filter status
      if (status === 'overdue' && !isOverdue) continue;
      if (status === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        const nextCallStr = lastCall?.next_call_at ? new Date(lastCall.next_call_at).toISOString().split('T')[0] : '';
        const createdTodayStr = new Date(cand.created_at).toISOString().split('T')[0];
        if (nextCallStr !== todayStr && createdTodayStr !== todayStr) continue;
      }

      enrichedRows.push(row);
    }

    // Handle pagination locally on matched list
    const paginated = enrichedRows.slice(fromIndex, toIndex + 1);

    res.status(200).json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 8. PATCH /hrm/candidates/assign - Bulk HR task assignment
export const assignHr = async (req: Request, res: Response) => {
  try {
    const { candidateIds, hrUserId } = req.body;
    
    const { error } = await supabase
      .from('candidate_referrals')
      .update({ assigned_hr_id: hrUserId })
      .in('id', candidateIds);

    if (error) throw error;

    // Trigger in-app notification and FCM push for the newly assigned recruiter
    if (hrUserId && candidateIds && candidateIds.length > 0) {
      try {
        const title = 'New Candidates Assigned';
        const msg = `You have been assigned ${candidateIds.length} new candidate(s) to follow up on.`;

        // In-app Notification
        await supabase.from('notifications').insert({
          user_id: hrUserId,
          message: msg,
          type: 'task_assigned',
          is_read: false
        });

        // FCM Push Notification
        await supabase.functions.invoke('send-notification', {
          body: {
            userIds: [hrUserId],
            title: title,
            message: msg,
            data: { type: 'task_assigned' }
          }
        });
      } catch (e) {
        console.warn('Failed to send assignment notification:', e);
      }
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 9. POST /hrm/letters - Create letter draft with auto-fill logic
export const createLetter = async (req: Request, res: Response) => {
  try {
    const { letter_type, candidate_id, employee_id } = req.body;
    const actorId = (req as any).user.id;

    // 1. Fetch template
    const { data: template, error: tempErr } = await supabase
      .from('hrm_letter_templates')
      .select('*')
      .eq('letter_type', letter_type)
      .single();

    if (tempErr) throw tempErr;

    // 2. Fetch templates mapping data
    let name = '';
    let designation = '';
    const department = '';
    let ctcAnnual = '0.00';
    let ctcMonthly = '0.00';
    let joiningDate = new Date().toLocaleDateString('en-IN');
    let probationDays = '90';
    let reportingManager = 'HR Department';
    const location = 'Head Office';

    if (candidate_id) {
      const { data: cand } = await supabase
        .from('candidate_referrals')
        .select('*')
        .eq('id', candidate_id)
        .single();
      if (cand) {
        name = cand.candidate_name;
        designation = cand.candidate_role;
        joiningDate = cand.joining_date ? new Date(cand.joining_date).toLocaleDateString('en-IN') : joiningDate;
      }

      // Fetch screening data
      const { data: screening } = await supabase
        .from('hrm_screening_forms')
        .select('*')
        .eq('candidate_id', candidate_id)
        .maybeSingle();

      if (screening) {
        ctcAnnual = (Number(screening.expected_ctc) * 12).toFixed(2);
        ctcMonthly = Number(screening.expected_ctc).toFixed(2);
        probationDays = String(screening.notice_period_days || 90);
      }
    } else if (employee_id) {
      const { data: emp } = await supabase
        .from('users')
        .select('*, reporting_manager:reporting_manager_id(name)')
        .eq('id', employee_id)
        .single();
      if (emp) {
        name = emp.name;
        designation = emp.role_id || '';
        reportingManager = (emp as any).reporting_manager?.name || reportingManager;
      }
    }

    // 3. Generate Ref Number
    const typeCode = TYPE_CODES[letter_type] || 'LT';
    const year = new Date().getFullYear();
    
    // Count existing letters of this type to find sequence
    const { count } = await supabase
      .from('hrm_letters')
      .select('*', { count: 'exact', head: true })
      .eq('letter_type', letter_type);

    const seq = String((count || 0) + 1).padStart(4, '0');
    const refNumber = `${typeCode}/${year}/${seq}`;

    // HR Actor details
    const { data: hr } = await supabase
      .from('users')
      .select('name, role_id')
      .eq('id', actorId)
      .single();

    // Map all placeholders
    const placeholderVars = {
      candidate_name: name,
      designation: designation,
      department: department || 'Operations',
      joining_date: joiningDate,
      ctc_annual: ctcAnnual,
      ctc_monthly: ctcMonthly,
      probation_days: probationDays,
      reporting_manager: reportingManager,
      location: location,
      company_name: 'Paradigm Services',
      company_address: 'No. 259, Head Office, Bangalore',
      hr_name: hr?.name || 'HR Team',
      hr_designation: hr?.role_id || 'HR Head',
      issue_date: new Date().toLocaleDateString('en-IN'),
      ref_number: refNumber,
      last_working_day: new Date().toLocaleDateString('en-IN'),
      old_designation: designation,
      new_designation: designation,
      old_ctc: ctcMonthly,
      new_ctc: ctcMonthly,
      hike_percent: '0',
      incident_date: new Date().toLocaleDateString('en-IN'),
      warning_level: 'First Warning',
      tenure_years: '0',
      tenure_months: '0'
    };

    // Pre-fill HTML body
    const resolvedBody = resolveTemplate(template.body_html, placeholderVars);

    // Save Draft
    const { data: letter, error: insertErr } = await supabase
      .from('hrm_letters')
      .insert({
        candidate_id: candidate_id || null,
        employee_id: employee_id || null,
        letter_type,
        template_snapshot: resolvedBody,
        variables_used: placeholderVars,
        ref_number: refNumber,
        status: 'draft',
        version: 1
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    res.status(201).json(toCamelCase(letter));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 10. GET /hrm/letters/:id - Get resolved letter draft
export const getLetter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: letter, error } = await supabase
      .from('hrm_letters')
      .select('*, candidate:candidate_id(candidate_name), employee:employee_id(name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.status(200).json(toCamelCase(letter));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 11. GET /hrm/letters - Letters search logs
export const getLetters = async (req: Request, res: Response) => {
  try {
    const { candidateId, type, status, page = 1 } = req.query;
    const limit = 15;
    const fromIndex = (Number(page) - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    let query = supabase
      .from('hrm_letters')
      .select('*, candidate:candidate_id(candidate_name), employee:employee_id(name)')
      .order('issued_at', { ascending: false, nullsFirst: true })
      .range(fromIndex, toIndex);

    if (candidateId) query = query.eq('candidate_id', candidateId);
    if (type) query = query.eq('letter_type', type);
    if (status) query = query.eq('status', status);

    const { data: letters, error } = await query;
    if (error) throw error;

    res.status(200).json(toCamelCase(letters));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 12. PATCH /hrm/letters/:id/issue - Generate PDF and email to candidate
export const issueLetter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user.id;

    // Fetch draft details
    const { data: letter, error: fetchErr } = await supabase
      .from('hrm_letters')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;

    if (letter.status === 'revoked') {
      return res.status(400).json({ error: 'Cannot issue a revoked letter' });
    }

    // Verification check for terminations
    if (letter.letter_type === 'termination' && letter.status !== 'pending_approval' && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Termination letters require admin approval before issuing' });
    }

    // Generate PDF
    console.log('Generating server-side PDF with Puppeteer...');
    const pdfRelativePath = await generatePdf(letter.template_snapshot, letter.ref_number);

    // Update status to issued
    const { data: updated, error: updateErr } = await supabase
      .from('hrm_letters')
      .update({
        status: 'issued',
        pdf_path: pdfRelativePath,
        issued_by: actorId,
        issued_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Fetch candidate details for email delivery
    if (letter.candidate_id) {
      const { data: cand } = await supabase
        .from('candidate_referrals')
        .select('candidate_name, candidate_email, candidate_mobile')
        .eq('id', letter.candidate_id)
        .single();

      if (cand && cand.candidate_email) {
        const absolutePdfPath = path.join(path.resolve('public/letters'), `${letter.ref_number.replace(/[/\\]/g, '_')}.pdf`);
        const letterTypeFormatted = letter.letter_type.charAt(0).toUpperCase() + letter.letter_type.slice(1);
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #006B3F; border-bottom: 2px solid #006B3F; padding-bottom: 10px;">Official Letter Issued</h2>
            <p>Dear <strong>${cand.candidate_name}</strong>,</p>
            <p>We are pleased to inform you that your official <strong>${letterTypeFormatted} Letter</strong> (Reference: <strong>${letter.ref_number}</strong>) has been issued by the HR Department of <strong>Paradigm Office</strong>.</p>
            <p>Please find the document attached to this email for your review.</p>
            <p>Should you have any questions or require further clarification, please feel free to reach out to your HR coordinator.</p>
            <br>
            <p>Best regards,</p>
            <p><strong>HR Operations Team</strong><br>Paradigm Office</p>
          </div>
        `;

        sendHrmEmailAsync({
          to: cand.candidate_email,
          subject: `Paradigm Office: Issued ${letterTypeFormatted} Letter - ${letter.ref_number}`,
          html: emailHtml,
          attachments: [{
            filename: `${letter.letter_type.toUpperCase()}_LETTER_${letter.ref_number.replace(/[/\\]/g, '_')}.pdf`,
            path: absolutePdfPath
          }]
        });

        if (cand.candidate_mobile) {
          triggerHrmSmsAsync(cand.candidate_mobile, `Dear ${cand.candidate_name}, your ${letterTypeFormatted} Letter (${letter.ref_number}) has been issued. Please check your email for the PDF.`);
        }
      }
    }

    // Insert feed entry
    if (letter.candidate_id) {
      await supabase.from('hrm_activity_feed').insert({
        candidate_id: letter.candidate_id,
        actor_id: actorId,
        type: 'letter_issued',
        payload: { letter_id: id, ref_number: letter.ref_number, letter_type: letter.letter_type }
      });
    }

    res.status(200).json(toCamelCase(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 13. PATCH /hrm/letters/:id/approve - Approve template (admin only)
export const approveLetter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, note } = req.body;
    const actorId = (req as any).user.id;

    // Verify admin role
    const { data: user } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', actorId)
      .single();

    if (!user || !['admin', 'super_admin', 'management'].includes(user.role_id)) {
      return res.status(403).json({ error: 'Only admins can approve letters' });
    }

    const nextStatus = approved ? 'issued' : 'draft';

    const { data: updated, error } = await supabase
      .from('hrm_letters')
      .update({
        status: nextStatus,
        approved_by: actorId,
        approval_note: note
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json(toCamelCase(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 14. PATCH /hrm/letters/:id/revoke - Revoke issued letters
export const revokeLetter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: updated, error } = await supabase
      .from('hrm_letters')
      .update({ status: 'revoked' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json(toCamelCase(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 14b. PUT /hrm/letters/:id - Update draft letter snapshot
export const updateLetterDraft = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { template_snapshot } = req.body;
    const { data: updated, error } = await supabase
      .from('hrm_letters')
      .update({ template_snapshot })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json(toCamelCase(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 15. GET /hrm/letters/templates - Retrieve all seeded templates
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const { data: templates, error } = await supabase
      .from('hrm_letter_templates')
      .select('*')
      .order('name');
    if (error) throw error;
    res.status(200).json(toCamelCase(templates));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 16. PUT /hrm/letters/templates/:type - Update template body (admin only)
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { body_html } = req.body;
    const actorId = (req as any).user.id;

    // Check admin
    const { data: user } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', actorId)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role_id)) {
      return res.status(403).json({ error: 'Unauthorized: Template manager restricted to Admin' });
    }

    const { data: updated, error } = await supabase
      .from('hrm_letter_templates')
      .update({ body_html, updated_by: actorId, updated_at: new Date().toISOString() })
      .eq('letter_type', type)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json(toCamelCase(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 17. GET /hrm/reports/funnel - Funnel conversions count
export const getFunnelReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    let query = supabase.from('hrm_candidate_stages').select('*');
    if (from) query = query.gte('changed_at', from);
    if (to) query = query.lte('changed_at', to);

    const { data: history, error } = await query;
    if (error) throw error;

    const stages = ['new', 'contacted', 'screened', 'interview', 'offer', 'joined', 'rejected'];
    const funnelCounts: Record<string, number> = {};
    stages.forEach(s => { funnelCounts[s] = 0; });

    // Deduplicate to current active stages
    const { data: candidates } = await supabase.from('candidate_referrals').select('current_stage, created_at');
    (candidates || []).forEach(cand => {
      const stage = cand.current_stage || 'new';
      if (funnelCounts[stage] !== undefined) {
        funnelCounts[stage]++;
      }
    });

    res.status(200).json(funnelCounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 18. GET /hrm/reports/leaderboard - Top referrers count
export const getLeaderboardReport = async (req: Request, res: Response) => {
  try {
    const { from, to, metric = 'count' } = req.query;

    let query = supabase.from('candidate_referrals').select('*');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: referrals, error } = await query;
    if (error) throw error;

    const board: Record<string, { name: string; count: number; joined: number }> = {};
    referrals?.forEach(r => {
      const key = r.referrer_name || 'Anonymous';
      if (!board[key]) {
        board[key] = { name: key, count: 0, joined: 0 };
      }
      board[key].count++;
      if (r.current_stage === 'joined') {
        board[key].joined++;
      }
    });

    const list = Object.values(board).sort((a, b) => {
      if (metric === 'joined') return b.joined - a.joined;
      return b.count - a.count;
    });

    res.status(200).json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 19. GET /hrm/reports/kpis - Key performance stats
export const getKpisReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    let query = supabase.from('candidate_referrals').select('*');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: referrals, error } = await query;
    if (error) throw error;

    const total = referrals?.length || 0;
    const joined = referrals?.filter(r => r.current_stage === 'joined').length || 0;
    const conversionPct = total > 0 ? Number(((joined / total) * 100).toFixed(1)) : 0;

    // Avg days to hire calculation
    let totalDays = 0;
    let hireCount = 0;
    referrals?.forEach(r => {
      if (r.current_stage === 'joined' && r.joining_date) {
        const created = new Date(r.created_at);
        const joinedDate = new Date(r.joining_date);
        const diffTime = Math.abs(joinedDate.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDays += diffDays;
        hireCount++;
      }
    });
    const avgDaysToHire = hireCount > 0 ? Math.round(totalDays / hireCount) : 0;

    // Call SLA check (contacted within 48 hours)
    let callSlaCount = 0;
    let SLAEligibleCount = 0;

    for (const r of (referrals || [])) {
      const created = new Date(r.created_at);
      const { data: calls } = await supabase
        .from('hrm_call_logs')
        .select('called_at')
        .eq('candidate_id', r.id)
        .order('called_at', { ascending: true })
        .limit(1);

      if (calls && calls.length > 0) {
        SLAEligibleCount++;
        const firstCall = new Date(calls[0].called_at);
        const diffMins = (firstCall.getTime() - created.getTime()) / (1000 * 60);
        if (diffMins <= 48 * 60) {
          callSlaCount++;
        }
      }
    }

    const callSlaPct = SLAEligibleCount > 0 ? Number(((callSlaCount / SLAEligibleCount) * 100).toFixed(1)) : 0;

    res.status(200).json({
      total,
      joined,
      conversionPct,
      avgDaysToHire,
      callSlaPct
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
