import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';

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

const TYPE_CODES: Record<string, string> = {
  offer: 'OFF',
  appointment: 'APT',
  increment: 'INC',
  confirmation: 'CNF',
  warning: 'WRN',
  termination: 'TRM',
  experience: 'EXP',
  relieving: 'REL',
};

const resolveTemplate = (bodyHtml: string, vars: Record<string, string>) => {
  let resolved = bodyHtml || '';
  for (const [k, v] of Object.entries(vars)) {
    const reg = new RegExp(`{{\\s*${k}\\s*}}`, 'gi');
    resolved = resolved.replace(reg, v || '');
  }
  return resolved;
};

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
};

const shouldBypassApi = () => {
  return Capacitor.isNativePlatform();
};

export const hrmApi = {
  logCall: async (d: any) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/hrm/calls', {
          method: 'POST',
          headers,
          body: JSON.stringify(d),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP /api/hrm/calls failed, falling back to direct Supabase:', err);
      }
    }

    // Direct Supabase implementation
    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;
    const dbPayload = toSnakeCase(d);
    dbPayload.called_by = actorId;

    const { data: callLog, error: callError } = await supabase
      .from('hrm_call_logs')
      .insert(dbPayload)
      .select()
      .single();

    if (callError) throw callError;

    // Check candidate details for auto-transition
    const { data: candidate } = await supabase
      .from('candidate_referrals')
      .select('current_stage, candidate_name')
      .eq('id', dbPayload.candidate_id)
      .single();

    if (dbPayload.outcome === 'reached' && candidate?.current_stage === 'new') {
      await supabase
        .from('candidate_referrals')
        .update({ current_stage: 'contacted' })
        .eq('id', dbPayload.candidate_id);

      await supabase.from('hrm_candidate_stages').insert({
        candidate_id: dbPayload.candidate_id,
        stage: 'contacted',
        changed_by: actorId,
        reason: 'Auto transitioned: Outcome was reached'
      });

      await supabase.from('hrm_activity_feed').insert({
        candidate_id: dbPayload.candidate_id,
        actor_id: actorId,
        type: 'stage_changed',
        payload: { from_stage: 'new', to_stage: 'contacted', reason: 'Auto transitioned: Outcome was reached' }
      });
    }

    return toCamelCase(callLog);
  },

  getCalls: async (cid: string, page = 1) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/calls?candidateId=${cid}&page=${page}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP /api/hrm/calls failed, falling back to direct Supabase:', err);
      }
    }

    const limit = 20;
    const fromIndex = (Number(page) - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    const { data: calls, error } = await supabase
      .from('hrm_call_logs')
      .select('*, called_by_user:users!hrm_call_logs_called_by_fkey(name)')
      .eq('candidate_id', cid)
      .order('called_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (error) {
      const { data: fallbackCalls, error: fbError } = await supabase
        .from('hrm_call_logs')
        .select('*')
        .eq('candidate_id', cid)
        .order('called_at', { ascending: false })
        .range(fromIndex, toIndex);
      if (fbError) throw fbError;
      return toCamelCase(fallbackCalls || []);
    }
    return toCamelCase(calls || []);
  },

  moveStage: async (id: string, stage: string, reason?: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/candidates/${id}/stage`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ stage, reason }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP stage transition failed, falling back to direct Supabase:', err);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;

    const { data: candidate, error: candError } = await supabase
      .from('candidate_referrals')
      .select('current_stage, candidate_name, candidate_mobile, candidate_email, candidate_role, created_by')
      .eq('id', id)
      .single();

    if (candError) throw candError;

    const fromStage = candidate.current_stage || 'new';

    const { error: updateError } = await supabase
      .from('candidate_referrals')
      .update({ current_stage: stage })
      .eq('id', id);

    if (updateError) throw updateError;

    await supabase.from('hrm_candidate_stages').insert({
      candidate_id: id,
      stage,
      changed_by: actorId,
      reason
    });

    await supabase.from('hrm_activity_feed').insert({
      candidate_id: id,
      actor_id: actorId,
      type: 'stage_changed',
      payload: { from_stage: fromStage, to_stage: stage, reason }
    });

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

    if (stage === 'joined') {
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

    return { success: true, fromStage, toStage: stage };
  },

  saveScreening: async (cid: string, d: any) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/screening/${cid}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(d),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP saveScreening failed, falling back to direct Supabase:', err);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;
    const formFields = toSnakeCase(d);

    formFields.candidate_id = cid;
    formFields.screened_by = actorId;
    formFields.screened_at = new Date().toISOString();

    const { data: form, error } = await supabase
      .from('hrm_screening_forms')
      .upsert(formFields, { onConflict: 'candidate_id' })
      .select()
      .single();

    if (error) throw error;

    const { data: candidate } = await supabase
      .from('candidate_referrals')
      .select('current_stage')
      .eq('id', cid)
      .single();

    if (candidate && (candidate.current_stage === 'new' || candidate.current_stage === 'contacted')) {
      await supabase
        .from('candidate_referrals')
        .update({ current_stage: 'screened' })
        .eq('id', cid);

      await supabase.from('hrm_candidate_stages').insert({
        candidate_id: cid,
        stage: 'screened',
        changed_by: actorId,
        reason: 'Auto transitioned: Screening form submitted'
      });

      await supabase.from('hrm_activity_feed').insert({
        candidate_id: cid,
        actor_id: actorId,
        type: 'stage_changed',
        payload: { from_stage: candidate.current_stage, to_stage: 'screened', reason: 'Screening Completed' }
      });
    }

    return toCamelCase(form);
  },

  getScreening: async (cid: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/screening/${cid}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getScreening failed, falling back to direct Supabase:', err);
      }
    }

    const { data: form, error } = await supabase
      .from('hrm_screening_forms')
      .select('*')
      .eq('candidate_id', cid)
      .maybeSingle();

    if (error) throw error;
    return form ? toCamelCase(form) : null;
  },

  getFeed: async (cid: string, referrerView = false) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/feed/${cid}?referrerView=${referrerView}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getFeed failed, falling back to direct Supabase:', err);
      }
    }

    const { data: feed, error } = await supabase
      .from('hrm_activity_feed')
      .select('*, actor:users!hrm_activity_feed_actor_id_fkey(name)')
      .eq('candidate_id', cid)
      .order('created_at', { ascending: false });

    if (error) {
      const { data: fallbackFeed, error: fbError } = await supabase
        .from('hrm_activity_feed')
        .select('*')
        .eq('candidate_id', cid)
        .order('created_at', { ascending: false });
      if (fbError) throw fbError;
      return toCamelCase(fallbackFeed || []);
    }
    return toCamelCase(feed || []);
  },

  getQueue: async (p: any) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams();
        Object.entries(p || {}).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            params.append(k, String(v));
          }
        });
        const res = await fetch(`/api/hrm/queue?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getQueue failed, falling back to direct Supabase:', err);
      }
    }

    // Direct Supabase Queue logic
    const { assignedTo, status = 'all', page = 1 } = p || {};
    const limit = 20;
    const fromIndex = (Number(page) - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    let query = supabase
      .from('candidate_referrals')
      .select('*, assigned_hr:users!candidate_referrals_assigned_hr_id_fkey(name)')
      .in('current_stage', ['new', 'contacted']);

    if (status === 'mine' && currentUserId) {
      query = query.eq('assigned_hr_id', currentUserId);
    } else if (assignedTo && assignedTo !== 'all') {
      query = query.eq('assigned_hr_id', assignedTo);
    }

    const { data: candidates, error } = await query;
    if (error) throw error;

    const enrichedRows: any[] = [];
    const now = new Date();
    const fortyEightHrsAgo = new Date();
    fortyEightHrsAgo.setHours(fortyEightHrsAgo.getHours() - 48);

    for (const cand of candidates || []) {
      const { data: calls } = await supabase
        .from('hrm_call_logs')
        .select('*')
        .eq('candidate_id', cand.id)
        .order('called_at', { ascending: false })
        .limit(1);

      const lastCall = calls && calls.length > 0 ? calls[0] : null;
      let isOverdue = false;

      if (!lastCall) {
        const createdDate = new Date(cand.created_at);
        if (createdDate < fortyEightHrsAgo) {
          isOverdue = true;
        }
      } else {
        if (lastCall.next_call_at && new Date(lastCall.next_call_at) < now) {
          isOverdue = true;
        }
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

      if (status === 'overdue' && !isOverdue) continue;
      if (status === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        const nextCallStr = lastCall?.next_call_at ? new Date(lastCall.next_call_at).toISOString().split('T')[0] : '';
        const createdTodayStr = new Date(cand.created_at).toISOString().split('T')[0];
        if (nextCallStr !== todayStr && createdTodayStr !== todayStr) continue;
      }

      enrichedRows.push(row);
    }

    const paginated = enrichedRows.slice(fromIndex, toIndex + 1);
    return paginated;
  },

  assignHr: async (ids: string[], hrId: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/hrm/candidates/assign', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ candidateIds: ids, hrUserId: hrId }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP assignHr failed, falling back to direct Supabase:', err);
      }
    }

    const { error } = await supabase
      .from('candidate_referrals')
      .update({ assigned_hr_id: hrId })
      .in('id', ids);

    if (error) throw error;

    if (hrId && ids && ids.length > 0) {
      try {
        const title = 'New Candidates Assigned';
        const msg = `You have been assigned ${ids.length} new candidate(s) to follow up on.`;
        await supabase.from('notifications').insert({
          user_id: hrId,
          message: msg,
          type: 'task_assigned',
          is_read: false
        });
      } catch (e) {
        console.warn('Failed to send assignment notification:', e);
      }
    }
    return { success: true };
  },

  createLetter: async (type: string, candidateId?: string, employeeId?: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/hrm/letters', {
          method: 'POST',
          headers,
          body: JSON.stringify({ letter_type: type, candidate_id: candidateId, employee_id: employeeId }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP createLetter failed, falling back to direct Supabase:', err);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;

    const { data: template, error: tempErr } = await supabase
      .from('hrm_letter_templates')
      .select('*')
      .eq('letter_type', type)
      .single();

    if (tempErr) throw tempErr;

    let name = '';
    let designation = '';
    const department = '';
    let ctcAnnual = '0.00';
    let ctcMonthly = '0.00';
    let joiningDate = new Date().toLocaleDateString('en-IN');
    let probationDays = '90';
    let reportingManager = 'HR Department';
    const location = 'Head Office';

    if (candidateId) {
      const { data: cand } = await supabase
        .from('candidate_referrals')
        .select('*')
        .eq('id', candidateId)
        .single();
      if (cand) {
        name = cand.candidate_name;
        designation = cand.candidate_role;
        joiningDate = cand.joining_date ? new Date(cand.joining_date).toLocaleDateString('en-IN') : joiningDate;
      }

      const { data: screening } = await supabase
        .from('hrm_screening_forms')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();

      if (screening) {
        ctcAnnual = (Number(screening.expected_ctc) * 12).toFixed(2);
        ctcMonthly = Number(screening.expected_ctc).toFixed(2);
        probationDays = String(screening.notice_period_days || 90);
      }
    } else if (employeeId) {
      const { data: emp } = await supabase
        .from('users')
        .select('*, reporting_manager:reporting_manager_id(name)')
        .eq('id', employeeId)
        .single();
      if (emp) {
        name = emp.name;
        designation = emp.role_id || '';
        reportingManager = (emp as any).reporting_manager?.name || reportingManager;
      }
    }

    const typeCode = TYPE_CODES[type] || 'LT';
    const year = new Date().getFullYear();

    const { count } = await supabase
      .from('hrm_letters')
      .select('*', { count: 'exact', head: true })
      .eq('letter_type', type);

    const seq = String((count || 0) + 1).padStart(4, '0');
    const refNumber = `${typeCode}/${year}/${seq}`;

    const { data: hr } = await supabase
      .from('users')
      .select('name, role_id')
      .eq('id', actorId)
      .single();

    const placeholderVars: Record<string, string> = {
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

    const resolvedBody = resolveTemplate(template.body_html, placeholderVars);

    const { data: letter, error: insertErr } = await supabase
      .from('hrm_letters')
      .insert({
        candidate_id: candidateId || null,
        employee_id: employeeId || null,
        letter_type: type,
        template_snapshot: resolvedBody,
        variables_used: placeholderVars,
        ref_number: refNumber,
        status: 'draft',
        version: 1
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    return toCamelCase(letter);
  },

  getLetter: async (id: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/letters/${id}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getLetter failed, falling back to direct Supabase:', err);
      }
    }

    const { data: letter, error } = await supabase
      .from('hrm_letters')
      .select('*, candidate:candidate_id(candidate_name), employee:employee_id(name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return toCamelCase(letter);
  },

  getLetters: async (p: any) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams();
        Object.entries(p || {}).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            params.append(k, String(v));
          }
        });
        const res = await fetch(`/api/hrm/letters?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getLetters failed, falling back to direct Supabase:', err);
      }
    }

    const { candidateId, type, status, page = 1 } = p || {};
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
    return toCamelCase(letters || []);
  },

  issueLetter: async (id: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/letters/${id}/issue`, {
          method: 'PATCH',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP issueLetter failed, falling back to direct Supabase:', err);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;

    const { data: updated, error: updateErr } = await supabase
      .from('hrm_letters')
      .update({
        status: 'issued',
        issued_by: actorId,
        issued_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (updated.candidate_id) {
      await supabase.from('hrm_activity_feed').insert({
        candidate_id: updated.candidate_id,
        actor_id: actorId,
        type: 'letter_issued',
        payload: { letter_id: id, ref_number: updated.ref_number, letter_type: updated.letter_type }
      });
    }

    return toCamelCase(updated);
  },

  updateLetterDraft: async (id: string, templateSnapshot: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/letters/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ template_snapshot: templateSnapshot }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP updateLetterDraft failed, falling back to direct Supabase:', err);
      }
    }

    const { data: updated, error } = await supabase
      .from('hrm_letters')
      .update({ template_snapshot: templateSnapshot })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(updated);
  },

  approveLetter: async (id: string, note: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/letters/${id}/approve`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ approved: true, note }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP approveLetter failed, falling back to direct Supabase:', err);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;

    const { data: updated, error } = await supabase
      .from('hrm_letters')
      .update({
        status: 'issued',
        approved_by: actorId,
        approval_note: note
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(updated);
  },

  revokeLetter: async (id: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/letters/${id}/revoke`, {
          method: 'PATCH',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP revokeLetter failed, falling back to direct Supabase:', err);
      }
    }

    const { data: updated, error } = await supabase
      .from('hrm_letters')
      .update({ status: 'revoked' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(updated);
  },

  getTemplates: async () => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/hrm/letters/templates', {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getTemplates failed, falling back to direct Supabase:', err);
      }
    }

    const { data: templates, error } = await supabase
      .from('hrm_letter_templates')
      .select('*')
      .order('name');
    if (error) throw error;
    return toCamelCase(templates || []);
  },

  updateTemplate: async (type: string, bodyHtml: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/letters/templates/${type}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ body_html: bodyHtml }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP updateTemplate failed, falling back to direct Supabase:', err);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;

    const { data: updated, error } = await supabase
      .from('hrm_letter_templates')
      .update({ body_html: bodyHtml, updated_by: actorId, updated_at: new Date().toISOString() })
      .eq('letter_type', type)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(updated);
  },

  getFunnel: async (from: string, to: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/reports/funnel?from=${from}&to=${to}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getFunnel failed, falling back to direct Supabase:', err);
      }
    }

    let query = supabase.from('candidate_referrals').select('current_stage, created_at');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: candidates, error } = await query;
    if (error) throw error;

    const stages = ['new', 'contacted', 'screened', 'interview', 'offer', 'joined', 'rejected'];
    const funnelCounts: Record<string, number> = {};
    stages.forEach(s => { funnelCounts[s] = 0; });

    (candidates || []).forEach(cand => {
      const stage = cand.current_stage || 'new';
      if (funnelCounts[stage] !== undefined) {
        funnelCounts[stage]++;
      }
    });

    return funnelCounts;
  },

  getLeaderboard: async (from: string, to: string, metric: 'count' | 'joined') => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/reports/leaderboard?from=${from}&to=${to}&metric=${metric}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getLeaderboard failed, falling back to direct Supabase:', err);
      }
    }

    let query = supabase.from('candidate_referrals').select('*');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: referrals, error } = await query;
    if (error) throw error;

    const board: Record<string, { name: string; count: number; joined: number }> = {};
    (referrals || []).forEach(r => {
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

    return list;
  },

  getKpis: async (from: string, to: string) => {
    if (!shouldBypassApi()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/hrm/reports/kpis?from=${from}&to=${to}`, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[hrmApi] HTTP getKpis failed, falling back to direct Supabase:', err);
      }
    }

    let query = supabase.from('candidate_referrals').select('*');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: referrals, error } = await query;
    if (error) throw error;

    const total = referrals?.length || 0;
    const joined = referrals?.filter(r => r.current_stage === 'joined').length || 0;
    const conversionPct = total > 0 ? Number(((joined / total) * 100).toFixed(1)) : 0;

    let totalDays = 0;
    let hireCount = 0;
    (referrals || []).forEach(r => {
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

    return {
      total,
      joined,
      conversionPct,
      avgDaysToHire,
      callSlaPct
    };
  },
};
