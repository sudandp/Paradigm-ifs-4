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
      .select('*, assigned_hr:users!candidate_referrals_assigned_hr_id_fkey(id, name, role_id, reporting_manager_id)')
      .in('current_stage', ['new', 'contacted']);

    if (status === 'mine' && currentUserId) {
      query = query.eq('assigned_hr_id', currentUserId);
    } else if (assignedTo && assignedTo !== 'all') {
      query = query.eq('assigned_hr_id', assignedTo);
    }

    const { data: candidates, error } = await query;
    if (error) throw error;

    // Batch fetch reporting managers for assigned recruiters
    const managerIds = Array.from(
      new Set(
        (candidates || [])
          .map((c: any) => c.assigned_hr?.reporting_manager_id)
          .filter(Boolean)
      )
    );

    const managersMap: Record<string, { id: string; name: string; role_id?: string }> = {};
    if (managerIds.length > 0) {
      try {
        const { data: managers } = await supabase
          .from('users')
          .select('id, name, role_id')
          .in('id', managerIds);
        if (managers) {
          managers.forEach((m: any) => {
            managersMap[m.id] = m;
          });
        }
      } catch (mErr) {
        console.warn('[hrmApi] Failed to batch load reporting managers:', mErr);
      }
    }

    const enrichedRows: any[] = [];
    const now = new Date();
    const fortyEightHrsAgo = new Date();
    fortyEightHrsAgo.setHours(fortyEightHrsAgo.getHours() - 48);

    for (const cand of candidates || []) {
      const { data: calls } = await supabase
        .from('hrm_call_logs')
        .select('*, called_by_user:users!hrm_call_logs_called_by_fkey(name, role_id)')
        .eq('candidate_id', cand.id)
        .order('called_at', { ascending: false })
        .limit(1);

      const { data: stages } = await supabase
        .from('hrm_candidate_stages')
        .select('stage, changed_at, reason, changed_by_user:users!hrm_candidate_stages_changed_by_fkey(name, role_id)')
        .eq('candidate_id', cand.id)
        .order('changed_at', { ascending: false })
        .limit(1);

      const lastCall = calls && calls.length > 0 ? calls[0] : null;
      const lastStage = stages && stages.length > 0 ? stages[0] : null;

      const changedByUser: any = Array.isArray((lastStage as any)?.changed_by_user)
        ? (lastStage as any)?.changed_by_user[0]
        : (lastStage as any)?.changed_by_user;
      const calledByUser: any = Array.isArray((lastCall as any)?.called_by_user)
        ? (lastCall as any)?.called_by_user[0]
        : (lastCall as any)?.called_by_user;
      const assignedHr: any = Array.isArray((cand as any).assigned_hr)
        ? (cand as any).assigned_hr[0]
        : (cand as any).assigned_hr;

      // Follow-up information: Who is following up with this lead, user name & contact details
      const latestFollowup = lastStage ? {
        stage: lastStage.stage,
        changedAt: lastStage.changed_at,
        changedBy: changedByUser?.name || assignedHr?.name,
        changedByRole: changedByUser?.role_id || assignedHr?.role_id,
        reason: lastStage.reason
      } : (assignedHr ? {
        stage: cand.current_stage || 'new',
        changedAt: cand.assigned_at || cand.created_at,
        changedBy: assignedHr.name,
        changedByRole: assignedHr.role_id,
        reason: null
      } : null);

      // Synthesize last contact: either from call log or from stage transition
      let contactSummary: any = null;
      if (lastCall) {
        contactSummary = {
          outcome: lastCall.outcome,
          calledAt: lastCall.called_at,
          calledBy: calledByUser?.name || assignedHr?.name,
          nextCallAt: lastCall.next_call_at
        };
      } else if (lastStage && lastStage.stage !== 'new') {
        contactSummary = {
          outcome: lastStage.reason || lastStage.stage,
          calledAt: lastStage.changed_at,
          calledBy: changedByUser?.name || assignedHr?.name,
          nextCallAt: null
        };
      }

      // SLA & Overdue calculation (48 hours threshold)
      let isOverdue = false;
      let overdueHours = 0;
      let overdueDays = 0;
      let remainingHours = 0;

      const refDate = contactSummary?.calledAt
        ? new Date(contactSummary.calledAt)
        : (cand.assigned_at ? new Date(cand.assigned_at) : new Date(cand.created_at));

      const elapsedMs = now.getTime() - refDate.getTime();
      const slaLimitMs = 48 * 60 * 60 * 1000;

      if (contactSummary?.nextCallAt && new Date(contactSummary.nextCallAt) < now) {
        isOverdue = true;
        const diffMs = now.getTime() - new Date(contactSummary.nextCallAt).getTime();
        overdueHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
        overdueDays = Math.floor(overdueHours / 24);
      } else if (elapsedMs > slaLimitMs) {
        isOverdue = true;
        const overdueMs = elapsedMs - slaLimitMs;
        overdueHours = Math.max(1, Math.round(overdueMs / (1000 * 60 * 60)));
        overdueDays = Math.floor(overdueHours / 24);
      } else {
        isOverdue = false;
        const remainingMs = Math.max(0, slaLimitMs - elapsedMs);
        remainingHours = Math.round(remainingMs / (1000 * 60 * 60));
      }

      const reportingMgrId = cand.assigned_hr?.reporting_manager_id;
      const reportingManager = reportingMgrId ? (managersMap[reportingMgrId] || null) : null;
      const responsibleName = cand.assigned_hr?.name || 'Unassigned';
      const responsibleRoleId = cand.assigned_hr?.role_id;
      const reportingManagerName = reportingManager?.name;

      const statusText = isOverdue
        ? (overdueDays >= 1 ? `Overdue by ${overdueDays}d` : `Overdue by ${overdueHours}h`)
        : `${remainingHours}h remaining`;

      const slaDetails = {
        isOverdue,
        overdueDays,
        overdueHours,
        remainingHours,
        responsibleName,
        responsibleRoleId,
        reportingManagerName,
        reportingManagerId: reportingMgrId,
        statusText
      };

      const locationCluster = ((loc?: string | null) => {
        if (!loc) return 'Bangalore';
        const l = loc.toLowerCase().trim();
        if (l.includes('hyd') || l.includes('secunderabad') || l.includes('telangana')) return 'Hyderabad';
        return 'Bangalore';
      })(cand.site_location);

      const row = {
        ...toCamelCase(cand),
        siteLocation: cand.site_location || 'Bangalore',
        locationCluster,
        assignedAt: cand.assigned_at || (cand.assigned_hr_id ? cand.created_at : null),
        lastCall: contactSummary ? toCamelCase(contactSummary) : null,
        latestFollowup: latestFollowup ? toCamelCase(latestFollowup) : null,
        reportingManager: reportingManager ? toCamelCase(reportingManager) : null,
        slaDetails,
        isOverdue
      };

      if (status === 'overdue' && !isOverdue) continue;
      if (status === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        const nextCallStr = contactSummary?.nextCallAt ? new Date(contactSummary.nextCallAt).toISOString().split('T')[0] : '';
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

    const nowIso = new Date().toISOString();
    let assignError: any = null;
    try {
      const { error } = await supabase
        .from('candidate_referrals')
        .update({ assigned_hr_id: hrId, assigned_at: nowIso })
        .in('id', ids);
      assignError = error;
    } catch (e) {
      assignError = e;
    }

    if (assignError) {
      const { error: fallbackErr } = await supabase
        .from('candidate_referrals')
        .update({ assigned_hr_id: hrId })
        .in('id', ids);
      if (fallbackErr) throw fallbackErr;
    }

    // Activity feed
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const currentUserId = currentSession?.user?.id;
      const feedEntries = ids.map(cid => ({
        candidate_id: cid,
        actor_id: currentUserId || hrId,
        type: 'candidate_assigned',
        payload: { assigned_to: hrId, assigned_at: nowIso },
        visible_to_referrer: false
      }));
      await supabase.from('hrm_activity_feed').insert(feedEntries);
    } catch (fErr) {
      console.warn('Failed to record activity feed for assignment:', fErr);
    }

    // In-app Notifications: Assigned Recruiter & Reporting Manager
    if (hrId && ids && ids.length > 0) {
      try {
        const { data: hrUser } = await supabase
          .from('users')
          .select('id, name, reporting_manager_id')
          .eq('id', hrId)
          .single();

        const candidateCount = ids.length;
        const recruiterMsg = `You have been assigned ${candidateCount} new candidate(s) to follow up on. SLA policy is 48 hours.`;

        // 1. In-app notification to assigned recruiter
        await supabase.from('notifications').insert({
          user_id: hrId,
          message: recruiterMsg,
          type: 'task_assigned',
          severity: 'Medium',
          link_to: '/hrm/calls/queue',
          is_read: false
        });

        // 2. In-app notification to recruiter's reporting manager
        if (hrUser?.reporting_manager_id) {
          const mgrMsg = `Lead Allocation: ${hrUser.name || 'Recruiter'} has been assigned ${candidateCount} new candidate(s) (SLA: 48h).`;
          await supabase.from('notifications').insert({
            user_id: hrUser.reporting_manager_id,
            message: mgrMsg,
            type: 'task_assigned',
            severity: 'Medium',
            link_to: '/hrm/calls/queue',
            is_read: false
          });
        }
      } catch (e) {
        console.warn('Failed to send assignment notifications:', e);
      }
    }
    return { success: true };
  },

  autoAssignCandidates: async (candidateIds: string[]) => {
    if (!candidateIds || candidateIds.length === 0) {
      throw new Error('Please select at least one candidate to auto-assign');
    }

    // 1. Fetch candidate records to detect their locations
    const { data: candidates, error: candError } = await supabase
      .from('candidate_referrals')
      .select('id, candidate_name, site_location')
      .in('id', candidateIds);

    if (candError) throw candError;

    // Helper: Normalize location to 'Hyderabad' or 'Bangalore'
    const normalizeLocation = (loc?: string | null): 'Hyderabad' | 'Bangalore' => {
      if (!loc) return 'Bangalore';
      const l = loc.toLowerCase().trim();
      if (l.includes('hyd') || l.includes('secunderabad') || l.includes('telangana')) {
        return 'Hyderabad';
      }
      return 'Bangalore';
    };

    // 2. Fetch active recruiters with role 'hr_recruitment' (or broader HR roles if needed)
    const { data: recruiters, error: recError } = await supabase
      .from('users')
      .select('id, name, role_id, email, society_id, reporting_manager_id')
      .in('role_id', ['hr_recruitment', 'hr', 'hr_ops'])
      .order('name');

    if (recError || !recruiters || recruiters.length === 0) {
      throw new Error('No active recruiters found to auto-assign candidates to');
    }

    // Prefer recruiters strictly with role 'hr_recruitment'
    const coreRecruiters = recruiters.filter(r => r.role_id === 'hr_recruitment');
    const effectiveRecruiterPool = coreRecruiters.length > 0 ? coreRecruiters : recruiters;

    // Partition recruiters by location
    // Hyderabad: email includes 'hyd' OR society_id = 'comp_1775122124670' (PIFS Hyderabad)
    const hydRecruiters = effectiveRecruiterPool.filter(r => 
      (r.email && r.email.toLowerCase().includes('hyd')) || 
      r.society_id === 'comp_1775122124670'
    );
    // Bangalore: all other recruiters in pool
    const blrRecruiters = effectiveRecruiterPool.filter(r => !hydRecruiters.some(hr => hr.id === r.id));

    // Fallbacks if any regional pool is empty
    const finalHydRecruiters = hydRecruiters.length > 0 ? hydRecruiters : effectiveRecruiterPool;
    const finalBlrRecruiters = blrRecruiters.length > 0 ? blrRecruiters : effectiveRecruiterPool;

    // Group selected candidates by location
    const blrCandidates: any[] = [];
    const hydCandidates: any[] = [];

    (candidates || []).forEach(c => {
      if (normalizeLocation(c.site_location) === 'Hyderabad') {
        hydCandidates.push(c);
      } else {
        blrCandidates.push(c);
      }
    });

    // 3. Balanced Round-Robin distribution per region
    const assignmentsByHr: Record<string, { 
      hr: { id: string; name: string; role_id: string; reporting_manager_id?: string }; 
      candidateIds: string[];
      locationHub: 'Bangalore' | 'Hyderabad';
    }> = {};

    finalBlrRecruiters.forEach(r => {
      assignmentsByHr[r.id] = { hr: r, candidateIds: [], locationHub: 'Bangalore' };
    });
    finalHydRecruiters.forEach(r => {
      if (!assignmentsByHr[r.id]) {
        assignmentsByHr[r.id] = { hr: r, candidateIds: [], locationHub: 'Hyderabad' };
      }
    });

    // Distribute Bangalore candidates among Bangalore recruiters
    blrCandidates.forEach((cand, index) => {
      const target = finalBlrRecruiters[index % finalBlrRecruiters.length];
      assignmentsByHr[target.id].candidateIds.push(cand.id);
    });

    // Distribute Hyderabad candidates among Hyderabad recruiters
    hydCandidates.forEach((cand, index) => {
      const target = finalHydRecruiters[index % finalHydRecruiters.length];
      assignmentsByHr[target.id].candidateIds.push(cand.id);
    });

    // 4. Batch updates and notifications
    const nowIso = new Date().toISOString();
    const distribution: { hrName: string; count: number; hub: string }[] = [];

    for (const hrId of Object.keys(assignmentsByHr)) {
      const item = assignmentsByHr[hrId];
      if (item.candidateIds.length === 0) continue;

      let updateError: any = null;
      try {
        const { error } = await supabase
          .from('candidate_referrals')
          .update({ assigned_hr_id: hrId, assigned_at: nowIso })
          .in('id', item.candidateIds);
        updateError = error;
      } catch (e) {
        updateError = e;
      }

      if (updateError) {
        const { error: fbErr } = await supabase
          .from('candidate_referrals')
          .update({ assigned_hr_id: hrId })
          .in('id', item.candidateIds);
        if (fbErr) throw fbErr;
      }

      // In-app Notification to recruiter
      try {
        await supabase.from('notifications').insert({
          user_id: hrId,
          message: `You have been auto-assigned ${item.candidateIds.length} ${item.locationHub} candidate(s) to follow up on. SLA policy is 48 hours.`,
          type: 'task_assigned',
          severity: 'Medium',
          link_to: '/hrm/calls/queue',
          is_read: false
        });

        // In-app Notification to recruiter's reporting manager
        if (item.hr.reporting_manager_id) {
          await supabase.from('notifications').insert({
            user_id: item.hr.reporting_manager_id,
            message: `Lead Allocation (${item.locationHub}): ${item.hr.name} has been auto-assigned ${item.candidateIds.length} candidate(s) (SLA: 48h).`,
            type: 'task_assigned',
            severity: 'Medium',
            link_to: '/hrm/calls/queue',
            is_read: false
          });
        }
      } catch (nErr) {
        console.warn('Failed to send auto-assign notifications:', nErr);
      }

      // Activity Feed
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const currentUserId = currentSession?.user?.id;
        const feedEntries = item.candidateIds.map(cid => ({
          candidate_id: cid,
          actor_id: currentUserId || hrId,
          type: 'candidate_assigned',
          payload: { assigned_to: hrId, assigned_at: nowIso, auto_assigned: true, hub: item.locationHub },
          visible_to_referrer: false
        }));
        await supabase.from('hrm_activity_feed').insert(feedEntries);
      } catch (fErr) {
        console.warn('Failed to record auto-assign feed:', fErr);
      }

      distribution.push({ hrName: item.hr.name, count: item.candidateIds.length, hub: item.locationHub });
    }

    return {
      success: true,
      totalAssigned: candidateIds.length,
      bangaloreCount: blrCandidates.length,
      hyderabadCount: hydCandidates.length,
      distribution
    };
  },

  // Daily SLA Reminders: Alerts recruiters & managers for candidates past 48h SLA without follow-up
  checkAndSendSlaDailyReminders: async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const storageKey = `hrm_sla_daily_reminders_${todayStr}`;
      if (typeof window !== 'undefined' && window.localStorage) {
        if (window.localStorage.getItem(storageKey)) {
          return { skipped: true, reason: 'Already sent today' };
        }
      }

      const fortyEightHrsAgo = new Date();
      fortyEightHrsAgo.setHours(fortyEightHrsAgo.getHours() - 48);

      const { data: candidates, error } = await supabase
        .from('candidate_referrals')
        .select('id, candidate_name, assigned_hr_id, created_at, assigned_at, current_stage, assigned_hr:users!candidate_referrals_assigned_hr_id_fkey(id, name, role_id, reporting_manager_id)')
        .in('current_stage', ['new', 'contacted'])
        .not('assigned_hr_id', 'is', null);

      if (error || !candidates || candidates.length === 0) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, 'true');
        }
        return { sent: 0 };
      }

      // Group overdue candidates by recruiter
      const overdueByRecruiter: Record<string, { recruiter: any; count: number; candidates: string[] }> = {};

      for (const cand of candidates as any[]) {
        const refDate = cand.assigned_at ? new Date(cand.assigned_at) : new Date(cand.created_at);
        if (refDate < fortyEightHrsAgo) {
          const { data: recentCalls } = await supabase
            .from('hrm_call_logs')
            .select('id')
            .eq('candidate_id', cand.id)
            .gte('called_at', fortyEightHrsAgo.toISOString())
            .limit(1);

          if (!recentCalls || recentCalls.length === 0) {
            const hrId = cand.assigned_hr_id;
            if (!overdueByRecruiter[hrId]) {
              overdueByRecruiter[hrId] = {
                recruiter: cand.assigned_hr,
                count: 0,
                candidates: []
              };
            }
            overdueByRecruiter[hrId].count += 1;
            if (overdueByRecruiter[hrId].candidates.length < 3) {
              overdueByRecruiter[hrId].candidates.push(cand.candidate_name);
            }
          }
        }
      }

      let sentCount = 0;
      for (const hrId of Object.keys(overdueByRecruiter)) {
        const info = overdueByRecruiter[hrId];
        const sampleNames = info.candidates.join(', ');
        const count = info.count;

        // In-app daily reminder to Recruiter
        await supabase.from('notifications').insert({
          user_id: hrId,
          message: `⚠️ SLA Daily Reminder: You have ${count} candidate(s) (${sampleNames}${count > 3 ? '...' : ''}) pending follow-up past the 48h SLA. Please contact them today to close the process.`,
          type: 'sla_reminder',
          severity: 'High',
          link_to: '/hrm/calls/queue',
          is_read: false
        });
        sentCount++;

        // In-app daily escalation to Reporting Manager
        if (info.recruiter?.reporting_manager_id) {
          await supabase.from('notifications').insert({
            user_id: info.recruiter.reporting_manager_id,
            message: `🚨 SLA Escalation: ${info.recruiter.name} has ${count} candidate(s) (${sampleNames}${count > 3 ? '...' : ''}) pending past the 48h SLA without follow-up.`,
            type: 'sla_escalation',
            severity: 'High',
            link_to: '/hrm/calls/queue',
            is_read: false
          });
          sentCount++;
        }
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, new Date().toISOString());
      }

      return { sent: sentCount };
    } catch (err) {
      console.warn('[hrmApi] checkAndSendSlaDailyReminders error:', err);
      return { sent: 0, error: err };
    }
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
