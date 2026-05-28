import { supabase } from './supabase';

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
};

export const hrmApi = {
  logCall: async (d: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/hrm/calls', {
      method: 'POST',
      headers,
      body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getCalls: async (cid: string, page = 1) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/calls?candidateId=${cid}&page=${page}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  moveStage: async (id: string, stage: string, reason?: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/candidates/${id}/stage`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ stage, reason }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  saveScreening: async (cid: string, d: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/screening/${cid}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getScreening: async (cid: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/screening/${cid}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getFeed: async (cid: string, referrerView = false) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/feed/${cid}?referrerView=${referrerView}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getQueue: async (p: any) => {
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  assignHr: async (ids: string[], hrId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/hrm/candidates/assign', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ candidateIds: ids, hrUserId: hrId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  createLetter: async (type: string, candidateId?: string, employeeId?: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/hrm/letters', {
      method: 'POST',
      headers,
      body: JSON.stringify({ letter_type: type, candidate_id: candidateId, employee_id: employeeId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getLetter: async (id: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/letters/${id}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getLetters: async (p: any) => {
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  issueLetter: async (id: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/letters/${id}/issue`, {
      method: 'PATCH',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  updateLetterDraft: async (id: string, templateSnapshot: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/letters/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ template_snapshot: templateSnapshot }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  approveLetter: async (id: string, note: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/letters/${id}/approve`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ approved: true, note }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  revokeLetter: async (id: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/letters/${id}/revoke`, {
      method: 'PATCH',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getTemplates: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/hrm/letters/templates', {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  updateTemplate: async (type: string, bodyHtml: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/letters/templates/${type}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ body_html: bodyHtml }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getFunnel: async (from: string, to: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/reports/funnel?from=${from}&to=${to}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getLeaderboard: async (from: string, to: string, metric: 'count' | 'joined') => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/reports/leaderboard?from=${from}&to=${to}&metric=${metric}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getKpis: async (from: string, to: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/hrm/reports/kpis?from=${from}&to=${to}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
