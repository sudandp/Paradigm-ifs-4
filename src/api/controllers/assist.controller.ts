import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AccessScope, AskerProfile, AssistCtx, AssistDataReply } from '../assist/types.js';
import { resolveScope } from '../assist/scope.js';
import { handleDataQuestion, maybeWebAnswer } from '../assist/orchestrator.js';
import { makeAuditor } from '../assist/audit.js';
import { peopleDirectory } from '../assist/helpers.js';
import { callGemini } from '../assist/llm.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.VITE_API_KEY_1 || process.env.VITE_API_KEY_2 || process.env.VITE_API_KEY_3 || process.env.VITE_API_KEY_4 || process.env.VITE_API_KEY_5 || process.env.GEMINI_API_KEY || '';

/** Scope used when the asker's profile/scope cannot be resolved: no data access at all. */
function noAccessScope(): AccessScope {
  return {
    level: 'none', userIds: new Set(), siteIds: new Set(), siteNames: new Set(), financeSiteNames: new Set(),
    capabilities: new Set(), why: 'scope unavailable',
    can: () => false, canSeeUser: () => false, canSeeSiteId: () => false, canSeeSiteName: () => false, canSeeFinanceSite: () => false,
  };
}

/** Questions the general LLM handles better than a web search (drafting, maths, diagrams, SOPs). */
const NOT_FOR_WEB = /\b(draft|write|compose|rephrase|translate|summari[sz]e|email|whatsapp|message|letter|flow\s*chart|diagram|mermaid|calculate|sop|procedure|checklist|handover|remind)\b|^[\d\s+\-*/().=?x%]+$/i;

// Initialize elevated service-role Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ============================================================================
// HINGLISH & REGIONAL VOCABULARY NORMALIZATION
// ============================================================================
const REGIONAL_TERMS: Record<string, string[]> = {
  water: ['paani', 'neeru', 'neellu', 'water', 'wtp', 'stp', 'tanki', 'tank', 'borewell', 'sump', 'motor', 'pump'],
  fire: ['aag', 'benki', 'manta', 'fire', 'smoke', 'dhuan', 'blaze', 'extinguisher', 'flame'],
  electricity: ['bijli', 'current', 'power', 'dg', 'diesel generator', 'transformer', 'ups', 'mcb', 'breaker', 'shock'],
  lift: ['lift', 'elevator', 'athava', 'stuck', 'phas gaya', 'trap', 'trapped', 'emergency alarm'],
  housekeeping: ['safai', 'kachra', 'cleaning', 'dusting', 'mop', 'garbage', 'waste', 'housekeeping', 'hk'],
  leave: ['chutti', 'leave', 'hafta', 'weekly off', 'sick leave', 'earned leave', 'holiday', 'absent', 'comp off'],
  salary: ['vetan', 'tankhah', 'paisa', 'salary', 'payment', 'payslip', 'wages', 'overtime', 'ot'],
  roster: ['roster', 'duty', 'shift', 'timing', 'schedule', 'attendance', 'kaam', 'kelsa', 'panulu'],
  escalation: ['contact', 'phone', 'number', 'call', 'manager', 'supervisor', 'escalate', 'complaint', 'nodal', 'helpdesk']
};

export function expandRegionalQuery(query: string): string {
  const lower = query.toLowerCase();
  const tokens = lower.split(/[\s,?.!-]+/);
  const expansions: Set<string> = new Set();

  for (const token of tokens) {
    if (!token) continue;
    for (const [concept, aliases] of Object.entries(REGIONAL_TERMS)) {
      if (aliases.includes(token)) {
        expansions.add(concept);
      }
    }
  }

  if (expansions.size > 0) {
    return `${query} (Keywords: ${Array.from(expansions).join(', ')})`;
  }
  return query;
}

// ============================================================================
// DETERMINISTIC EMERGENCY CLASSIFIER (P0 ZERO-HALLUCINATION)
// ============================================================================
interface EmergencyMatch {
  isEmergency: boolean;
  type: 'FIRE' | 'GAS_LEAK' | 'LIFT_TRAP' | 'ELECTRICAL_SHOCK' | 'CHEMICAL_SPILL' | 'MEDICAL' | 'GENERAL' | null;
  title: string;
  immediateActions: string[];
}

export function detectEmergency(query: string): EmergencyMatch {
  const q = query.toLowerCase();

  // 1. Fire / Smoke
  if (/\b(fire|smoke|aag|benki|manta|flame|fire alarm|drench|sprinkler|burning smell)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'FIRE',
      title: '🚨 FIRE / SMOKE EMERGENCY PROTOCOL',
      immediateActions: [
        '1. Sound the manual call point / fire alarm immediately.',
        '2. Evacuate people through nearest fire staircase (NEVER use lifts).',
        '3. If safe and trained, deploy CO2 / ABC Dry Powder fire extinguisher.',
        '4. Dial Fire Emergency 101 and contact Site Facility Manager + Director on Duty.',
        '5. Cut off main electrical breaker and LPG supply lines to affected zone.'
      ]
    };
  }

  // 2. Gas Leak
  if (/\b(gas leak|lpg|gas smell|cylinder blast|gas pipe|pipeline leak|gas cylinder)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'GAS_LEAK',
      title: '⚠️ CRITICAL LPG / GAS LEAK PROTOCOL',
      immediateActions: [
        '1. DO NOT touch electrical switches, mobile phones, or matchsticks in the area.',
        '2. Open all doors and windows for maximum cross ventilation.',
        '3. Turn OFF the main gas bank cylinder manifold valves immediately.',
        '4. Evacuate all residents/staff 100 meters away upwind.',
        '5. Call Site MEP Supervisor and Gas Vendor Emergency Hotline immediately.'
      ]
    };
  }

  // 3. Lift / Elevator Trap
  if (/\b(lift stuck|lift trap|elevator stuck|lift not opening|person inside lift|trapped in lift|lift failure|stuck in elevator)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'LIFT_TRAP',
      title: '🛗 LIFT PASSENGER ENTRAPMENT PROTOCOL',
      immediateActions: [
        '1. Talk to trapped passengers through the intercom: assure them they are safe and ventilation is active.',
        '2. Locate the lift cabin position on the floor indicator / machine room.',
        '3. Turn OFF the main electrical isolator for that lift before manual rescue.',
        '4. Apply manual brake release tool slowly to level cabin with nearest floor.',
        '5. Use landing door key to open doors and safely extract passengers. Call Lift AMC vendor.'
      ]
    };
  }

  // 4. Electrical Shock / Arc Flash
  if (/\b(electric shock|electrocution|sparking|short circuit|transformer fire|panel fire|current shock|bijli shock|shock laga)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'ELECTRICAL_SHOCK',
      title: '⚡ ELECTRICAL SHOCK & HAZARD PROTOCOL',
      immediateActions: [
        '1. DO NOT touch the victim with bare hands if still in contact with electrical source.',
        '2. Trip the main incomer circuit breaker (ACB/MCCB) immediately.',
        '3. Separate victim using a dry non-conductive object (dry wooden stick, PVC pipe).',
        '4. Check breathing and pulse. If unconscious, initiate CPR immediately.',
        '5. Dial 108 / Ambulance and contact Site Technical Executive immediately.'
      ]
    };
  }

  // 5. Chemical / Chlorine / STP Hazard
  if (/\b(chemical spill|acid spill|chlorine leak|chlorine gas|stp overflow|wtp burst|sludge overflow)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'CHEMICAL_SPILL',
      title: '☣️ HAZARDOUS CHEMICAL / STP EMERGENCY PROTOCOL',
      immediateActions: [
        '1. Don full PPE (Chemical respirator, nitrile gloves, gumboots, safety goggles).',
        '2. In case of chlorine gas, move upwind and evacuate basement/enclosed spaces.',
        '3. Shut down feed dosing pumps and isolate raw sewage/chemical supply.',
        '4. Deploy spill containment kit (sand/neutralizing agent) around drains.',
        '5. Notify Water Management SME and Site Operations Manager immediately.'
      ]
    };
  }

  // 6. Medical Emergency
  if (/\b(unconscious|cardiac|heart attack|snake bite|heavy bleeding|injury|ambulance|medical emergency)\b/i.test(q)) {
    return {
      isEmergency: true,
      type: 'MEDICAL',
      title: '🚑 CRITICAL MEDICAL EMERGENCY PROTOCOL',
      immediateActions: [
        '1. Call Emergency Ambulance at 108 / local hospital emergency desk immediately.',
        '2. Alert Site Security to clear entrance boom barriers and guide ambulance to spot.',
        '3. Retrieve Site First Aid Box & AED (Automated External Defibrillator) if available.',
        '4. Keep victim calm, still, and do not administer oral liquids if semi-conscious.',
        '5. Notify Site Facility Manager and resident/employee emergency contact.'
      ]
    };
  }

  return { isEmergency: false, type: null, title: '', immediateActions: [] };
}

// ============================================================================
// LIVE DATABASE CONTEXT (SCOPED) — used only on the GENERAL / knowledge-base path.
// Specific data questions are answered by the role-aware tools in src/api/assist (orchestrator).
// Every section here is restricted to the asker's AccessScope; the old staff-directory dump and the
// hard-coded people-name / site-name regexes were removed (they leaked names and phones to any user).
// ============================================================================
export interface LiveDatabaseContextResult {
  textContext: string;
  citations: Array<{ id: string; title: string; sourceTable: string; score: string | number }>;
  isDataFound: boolean;
}

const istDayStartUtc = () => {
  const istNow = new Date(Date.now() + 5.5 * 3600_000);
  return new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - 5.5 * 3600_000).toISOString();
};

export async function gatherLiveDatabaseContext(
  query: string,
  effectiveSiteId: string | null,
  siteName: string,
  scope: AccessScope,
  askerId: string
): Promise<LiveDatabaseContextResult> {
  const q = query.toLowerCase();
  const sections: string[] = [];
  const citations: Array<{ id: string; title: string; sourceTable: string; score: string | number }> = [];
  if (!scope || scope.level === 'none') return { textContext: '', citations, isDataFound: false };

  // 1. TODAY'S ATTENDANCE COUNTS for the selected site: counts only, for managers/admin of that site.
  if (/\b(present|attendance|punch|punches|checked\s*in|who\s+is\s+in|who\s+is\s+working)\b/i.test(q) &&
      effectiveSiteId && scope.level !== 'self' && scope.can('attendance') && scope.canSeeSiteId(effectiveSiteId)) {
    try {
      const { data: todayEvents } = await supabase.from('attendance_events')
        .select('user_id, type')
        .eq('location_id', effectiveSiteId)
        .gte('timestamp', istDayStartUtc())
        .limit(2000);
      const visible = (todayEvents || []).filter(e => scope.canSeeUser(e.user_id));
      const inUsers = new Set(visible.filter(e => e.type === 'punch-in' || e.type === 'check_in').map(e => e.user_id));
      const outUsers = new Set(visible.filter(e => e.type === 'punch-out' || e.type === 'check_out').map(e => e.user_id));
      sections.push(
        `[LIVE DATABASE: TODAY'S ATTENDANCE COUNTS FOR ${siteName.toUpperCase()}]\n` +
        `Staff punched IN today: ${inUsers.size}\nStaff punched OUT today: ${outUsers.size}\n` +
        `(For a named employee's attendance, ask e.g. "is <name> present today".)`
      );
      citations.push({ id: 'attendance-events', title: `Today's attendance counts (${siteName})`, sourceTable: 'attendance_events', score: 1.0 });
    } catch (err) {
      console.warn('[Assist] Live attendance gather error:', err);
    }
  }

  // 2. ONBOARDING SUBMISSIONS: HR / Admin only (hr_records capability). No KYC or document details.
  if (scope.can('hr_records') && /\b(onboard|onboarding|submission|submissions|recruitment|hire|candidate)\b/i.test(q)) {
    try {
      const { data: allSubs } = await supabase
        .from('onboarding_submissions')
        .select('status, organization_name, personal, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (allSubs && allSubs.length > 0) {
        const count = (st: string) => allSubs.filter(s => s.status === st).length;
        const pendingList = allSubs.filter(s => s.status === 'pending').slice(0, 8).map(s => {
          const name = [s.personal?.first_name, s.personal?.last_name].filter(Boolean).join(' ') || 'Unnamed';
          return `  • ${name} | Site: ${s.organization_name || 'N/A'} | Status: PENDING`;
        }).join('\n');
        sections.push(
          `[LIVE DATABASE: EMPLOYEE ONBOARDING APPLICATIONS (latest ${allSubs.length})]\n` +
          `Verified: ${count('verified')} | Pending: ${count('pending')} | Drafts: ${count('draft')} | Rejected: ${count('rejected')}\n` +
          (pendingList ? `Pending applications:\n${pendingList}\n` : '')
        );
        citations.push({ id: 'onboarding-submissions', title: 'Employee Onboarding Records', sourceTable: 'onboarding_submissions', score: 1.0 });
      }
    } catch (err) {
      console.warn('[Assist] Onboarding gather error:', err);
    }
  }

  // 3. SUPPORT TICKETS: org-wide scope sees recent tickets; everyone else only tickets they raised or are assigned.
  if (scope.can('tickets') && /\b(ticket|tickets|support|complaint|complaints)\b/i.test(q)) {
    try {
      let tq = supabase
        .from('support_tickets')
        .select('ticket_number, title, priority, status, raised_by_name, assigned_to_name')
        .order('raised_at', { ascending: false })
        .limit(10);
      if (scope.level !== 'all') tq = tq.or(`raised_by_id.eq.${askerId},assigned_to_id.eq.${askerId}`);
      const { data: tickets } = await tq;
      if (tickets && tickets.length > 0) {
        const ticketList = tickets.map(t =>
          `  • [${t.ticket_number}] "${t.title}" | Status: ${t.status} | Priority: ${t.priority} | Raised by: ${t.raised_by_name} | Assigned: ${t.assigned_to_name || 'Unassigned'}`
        ).join('\n');
        sections.push(`[LIVE DATABASE: ${scope.level === 'all' ? 'RECENT' : 'YOUR'} SUPPORT TICKETS]\n${ticketList}`);
        citations.push({ id: 'support-tickets', title: `Support Tickets (${tickets.length})`, sourceTable: 'support_tickets', score: 1.0 });
      }
    } catch (err) {
      console.warn('[Assist] Tickets gather error:', err);
    }
  }

  // 4. LEAVE REQUESTS: only people inside the asker's scope (self / team / org).
  if (scope.can('leave') && /\b(leave|leaves|chutti|sick\s+leave|earned\s+leave|casual\s+leave)\b/i.test(q)) {
    try {
      let lq = supabase
        .from('leave_requests')
        .select('user_id, leave_type, start_date, end_date, status')
        .order('start_date', { ascending: false })
        .limit(10);
      if (scope.level !== 'all') lq = lq.in('user_id', [...scope.userIds].slice(0, 300));
      const { data: leaves } = await lq;
      if (leaves && leaves.length > 0) {
        const userIds = Array.from(new Set(leaves.map(l => l.user_id)));
        const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
        const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
        const leaveList = leaves.map(l =>
          `  • ${userMap.get(l.user_id) || 'Employee'}: ${l.leave_type} Leave (${l.start_date} to ${l.end_date}) — Status: ${l.status}`
        ).join('\n');
        sections.push(`[LIVE DATABASE: RECENT LEAVE REQUESTS ${scope.level === 'self' ? '(YOURS)' : '(WITHIN YOUR ACCESS)'}]\n${leaveList}`);
        citations.push({ id: 'leave-requests', title: 'Leave Requests', sourceTable: 'leave_requests', score: 1.0 });
      }
    } catch (err) {
      console.warn('[Assist] Leaves gather error:', err);
    }
  }

  return {
    textContext: sections.join('\n\n'),
    citations,
    isDataFound: sections.length > 0
  };
}

// ============================================================================
// MAIN PIPELINE HANDLER
// ============================================================================
export async function handleAssistChat(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // 1. Authenticate Request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(403).json({ error: 'Unauthorized or expired token' });
    }

    const {
      conversationId,
      query,
      siteId,
      modelEngine = 'auto-hybrid',
      history = [],
      selection = null
    } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const trimmedQuery = query.trim();
    const safeHistory = Array.isArray(history) ? history : [];

    // 2. Load the asker's profile and resolve what they may see (server-side; never trust the client)
    let siteName = 'All Paradigm Sites';
    let siteCity: string | null = null;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let asker: AskerProfile = { id: user.id, name: user.email || 'User', email: user.email || null, role_id: 'unverified', location_id: null };
    let scope: AccessScope = noAccessScope();
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, name, email, role_id, location_id')
        .eq('id', user.id)
        .maybeSingle();
      if (userProfile) asker = { ...userProfile, role_id: userProfile.role_id || 'unverified' } as AskerProfile;
      scope = await resolveScope(supabase, asker);
    } catch (scopeErr: any) {
      console.warn('[Assist] Scope resolution failed (no data access for this request):', scopeErr?.message);
    }

    // The client-selected site is honoured only when it is inside the asker's scope.
    const clientSiteId = (typeof siteId === 'string' && UUID_REGEX.test(siteId) && scope.canSeeSiteId(siteId)) ? siteId : null;
    let effectiveSiteId: string | null = clientSiteId;

    try {
      if (!effectiveSiteId && asker.location_id && UUID_REGEX.test(asker.location_id)) {
        effectiveSiteId = asker.location_id;
      }

      if (effectiveSiteId) {
        const { data: loc } = await supabase
          .from('locations')
          .select('id, name, address')
          .eq('id', effectiveSiteId)
          .maybeSingle();
        if (loc) {
          siteName = loc.name;
          if (loc.address) {
            if (/bengaluru|bangalore/i.test(loc.address)) siteCity = 'Bengaluru';
            else if (/hyderabad/i.test(loc.address)) siteCity = 'Hyderabad';
            else if (/pune/i.test(loc.address)) siteCity = 'Pune';
          }
        }
      }
    } catch (profileErr) {
      console.warn('[Assist] User/Location lookup fallback:', profileErr);
    }

    // 3. Resolve or Create Conversation
    let activeConvId = conversationId;
    if (!activeConvId) {
      const { data: newConv, error: convErr } = await supabase
        .from('assist_conversations')
        .insert({
          user_id: user.id,
          title: trimmedQuery.slice(0, 60),
          site_id: effectiveSiteId
        })
        .select('id')
        .single();
      if (!convErr && newConv) {
        activeConvId = newConv.id;
      }
    }

    // Log User Message
    let userMsgId: string | null = null;
    if (activeConvId) {
      const { data: uMsg } = await supabase
        .from('assist_messages')
        .insert({
          conversation_id: activeConvId,
          sender: 'user',
          content: trimmedQuery
        })
        .select('id')
        .single();
      if (uMsg) userMsgId = uMsg.id;
    }

    // 4. Check Deterministic Emergency Bypass
    const emergency = detectEmergency(trimmedQuery);
    if (emergency.isEmergency) {
      // Query escalation matrix contacts for site / HQ
      let escQuery = supabase
        .from('escalation_matrix')
        .select('*')
        .order('display_order', { ascending: true })
        .limit(6);

      if (effectiveSiteId) {
        escQuery = escQuery.or(`site_id.eq.${effectiveSiteId},site_id.is.null`);
      }

      const { data: escContacts } = await escQuery;

      // Query on-duty staff if site is known
      let staffMembers: any[] = [];
      if (effectiveSiteId) {
        const { data: staff } = await supabase
          .from('site_staff_members')
          .select('full_name, designation, phone, shift_type')
          .eq('site_id', effectiveSiteId)
          .eq('is_active', true)
          .limit(5);
        if (staff) staffMembers = staff;
      }

      // Format Emergency Response
      let contactList = '';
      if (escContacts && escContacts.length > 0) {
        contactList = escContacts.map(c => 
          `• **${c.role_name} (${c.level})**: ${c.contact_person} — 📞 [${c.phone}](tel:${c.phone}) (TAT: ${c.tat_minutes} mins)`
        ).join('\n');
      } else {
        contactList = '• **Head Office 24x7 Emergency Desk**: 📞 [+91 80 4114 2666](tel:+918041142666)\n• **Operations Director**: 📞 [+91 98450 12345](tel:+919845012345)';
      }

      let staffList = '';
      if (staffMembers.length > 0) {
        staffList = '\n\n**On-Site Responders:**\n' + staffMembers.map(s => 
          `• ${s.full_name} (${s.designation}): 📞 [${s.phone}](tel:${s.phone}) [Shift: ${s.shift_type}]`
        ).join('\n');
      }

      const emergencyReply = `### ${emergency.title}\n\n**Immediate Safety Actions:**\n${emergency.immediateActions.join('\n')}\n\n**Emergency Escalation Contacts:**\n${contactList}${staffList}\n\n*Notice: This is a critical life-safety protocol. Execute containment steps immediately and alert emergency services.*`;

      const latencyMs = Date.now() - startTime;

      if (activeConvId) {
        await supabase.from('assist_messages').insert({
          conversation_id: activeConvId,
          sender: 'assistant',
          content: emergencyReply,
          confidence: 1.0,
          latency_ms: latencyMs,
          sources: [{ title: 'Emergency Escalation Protocol', type: 'emergency', score: 1.0 }]
        });
      }

      return res.status(200).json({
        conversationId: activeConvId,
        message: emergencyReply,
        isEmergency: true,
        emergencyType: emergency.type,
        confidence: 1.0,
        sources: [{ title: emergency.title, type: 'emergency' }],
        latencyMs
      });
    }

    // 4B. Role-aware Paradigm DATABASE answers (planner → scoped tool → clarify / denied / answer)
    const sendDataReply = async (reply: AssistDataReply, engine: string) => {
      const latencyMs = Date.now() - startTime;
      const sources: any[] = [];
      if (reply.route === 'web') {
        sources.push({ type: 'web', title: reply.sourceBadge || 'From the web' });
        (reply.webSources || []).forEach(s => sources.push({ type: 'web', title: s.title, url: s.url }));
      } else if (reply.clarification) {
        sources.push({ type: 'clarification', title: reply.clarification.question, tool: reply.clarification.tool, options: reply.clarification.options });
      } else {
        sources.push({ type: 'database', title: reply.sourceBadge || 'Paradigm database', tool: reply.toolUsed || null, denied: !!reply.denied });
      }
      if (reply.actions?.length) sources.push({ type: 'actions', actions: reply.actions });

      let assistantMsgId: string | null = null;
      if (activeConvId) {
        const { data: savedMsg } = await supabase.from('assist_messages').insert({
          conversation_id: activeConvId,
          sender: 'assistant',
          content: reply.message,
          confidence: 1.0,
          sources,
          latency_ms: latencyMs
        }).select('id').single();
        if (savedMsg) assistantMsgId = savedMsg.id;
        await supabase.from('assist_conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvId);
      }

      return res.status(200).json({
        conversationId: activeConvId,
        messageId: assistantMsgId,
        message: reply.message,
        confidence: 1.0,
        sources,
        latencyMs,
        modelEngineUsed: engine,
        route: reply.route,
        sourceBadge: reply.sourceBadge ?? null,
        clarification: reply.clarification ?? null,
        denied: !!reply.denied,
        table: reply.table ?? null,
        webSources: reply.webSources ?? [],
        toolUsed: reply.toolUsed ?? null,
        actions: reply.actions ?? [],
        engine: reply.engine ?? null
      });
    };

    const assistCtx: AssistCtx = {
      sb: supabase,
      asker,
      scope,
      question: trimmedQuery,
      selectedSiteId: clientSiteId,
      now: new Date(),
      audit: makeAuditor(supabase, asker.id)
    };
    const validSelection = selection && typeof selection === 'object' && typeof selection.tool === 'string'
      ? { tool: String(selection.tool), args: (selection.args && typeof selection.args === 'object' && !Array.isArray(selection.args)) ? selection.args : {} }
      : null;
    const looksLikeGreeting = /^(hi|hello|hey|namaste|good\s+(morning|afternoon|evening)|howdy|greetings|how\s+are\s+you|who\s+are\s+you|help|thanks|thank\s+you|ok|okay)\b[!.?]*$/i.test(trimmedQuery);
    const dataReply = (looksLikeGreeting && !validSelection) ? null : await handleDataQuestion(assistCtx, trimmedQuery, safeHistory, validSelection);
    if (dataReply) {
      return sendDataReply(dataReply, 'paradigm-database');
    }

    // 5. Hybrid Knowledge Retrieval
    // Use clean natural query for database search so FTS/Trigram accurately match
    const { data: searchResults, error: rpcError } = await supabase.rpc('search_knowledge_base', {
      query_text: trimmedQuery,
      query_embedding: null,
      filter_site_id: effectiveSiteId,
      filter_city: siteCity,
      match_count: 6
    });

    if (rpcError) {
      console.warn('[Assist] search_knowledge_base RPC error:', rpcError.message);
    }

    // Site staff roster (names + phones): only for askers allowed to see phones AND that specific site.
    let staffContext: any[] = [];
    if (effectiveSiteId && scope.can('directory_phone') && scope.canSeeSiteId(effectiveSiteId) &&
        /\b(staff|roster|duty|shift|phone|number|supervisor|electrician|plumber|technician|contact)\b/i.test(trimmedQuery)) {
      const { data: stf } = await supabase
        .from('site_staff_members')
        .select('full_name, designation, department, phone, shift_type, reporting_manager_name')
        .eq('is_active', true)
        .eq('site_id', effectiveSiteId)
        .limit(8);
      if (stf) staffContext = stf;
    }

    // Also fetch escalation matrix if query asks about escalation or complaint
    let escContext: any[] = [];
    if (/\b(escalat|complaint|emergency|helpline|nodal|l1|l2|l3|tat)\b/i.test(trimmedQuery)) {
      let eq = supabase
        .from('escalation_matrix')
        .select('role_name, contact_person, phone, email, tat_minutes, level, escalation_trigger')
        .order('display_order', { ascending: true })
        .limit(6);
      if (effectiveSiteId) {
        eq = eq.or(`site_id.eq.${effectiveSiteId},site_id.is.null`);
      }
      const { data: ed } = await eq;
      if (ed) escContext = ed;
    }

    // 5B. Gather scoped live database context (site attendance counts, onboarding, tickets, leaves)
    const liveDbResult = await gatherLiveDatabaseContext(trimmedQuery, effectiveSiteId, siteName, scope, asker.id);

    // Evaluate Confidence
    const items = (searchResults || []) as any[];
    const topItem = items[0];
    const topConfidence = topItem ? parseFloat(topItem.composite_confidence || '0') : 0.0;

    // Check Assist Settings for thresholds
    const { data: settings } = await supabase
      .from('assist_settings')
      .select('high_threshold, medium_threshold')
      .eq('id', 'singleton')
      .single();

    const minAcceptableThreshold = settings?.medium_threshold ? Number(settings.medium_threshold) : 0.20;

    // Check if this is a conversational greeting or polite pleasantry
    const isGreeting = /^(hi|hello|hey|namaste|good\s+(morning|afternoon|evening)|howdy|greetings|how\s+are\s+you|who\s+are\s+you|help)\b[!\.\?]*$/i.test(trimmedQuery.trim());

    if (isGreeting) {
      const politeGreetingReply = `Namaste! 🙏 Warm greetings. I am **Paradigm Assist**, your dedicated digital companion and operations copilot for **${siteName}**.\n\n` +
        `It is an honor and pleasure to assist you today. Here are key ways I can serve you:\n\n` +
        `• ⚡ **54 Operational Skills**: Equipment SOPs (DG Cold Start, STP, Lift Rescue, Fire & Gas), shift rules, and rosters.\n` +
        `• ✍️ **Drafting & Messaging**: Professional emails, WhatsApp broadcasts, and formal incident reports.\n` +
        `• 📝 **Local Notes & Reminders**: Capture field readings or schedule local alarm reminders.\n` +
        `• 🖥️ **System Launchers**: Open UltraViewer, Gmail, WhatsApp, Calculator, and more.\n\n` +
        `How may I respectfully assist your operations today?`;

      const latencyMs = Date.now() - startTime;
      if (activeConvId) {
        await supabase.from('assist_messages').insert({
          conversation_id: activeConvId,
          sender: 'assistant',
          content: politeGreetingReply,
          confidence: 1.0,
          latency_ms: latencyMs,
          sources: []
        });
      }

      return res.status(200).json({
        conversationId: activeConvId,
        message: politeGreetingReply,
        isFallback: false,
        confidence: 1.0,
        sources: [],
        latencyMs
      });
    }

    // Check if this is a real-time clock, date, or operational shift query
    const isTimeOrShift = /\b(?:what(?:'s|\s+is)?\s+(?:the\s+)?(?:current\s+)?time|what\s+time\s+is\s+it|time\s+now|current\s+time|what(?:'s|\s+is)?\s+(?:the\s+)?(?:current\s+)?date|what\s+date\s+is\s+(?:it|today)|today(?:'s)?\s+date|what\s+day\s+is\s+(?:it|today)|which\s+shift\s+(?:is\s+)?(?:running|active|now)|what\s+shift\s+is\s+(?:running|active|now)|current\s+shift|active\s+shift)\b/i.test(trimmedQuery.trim()) ||
      /^\/(?:time|clock|date|shift|today)$/i.test(trimmedQuery.trim());

    if (isTimeOrShift) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
      
      const istHours = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(now));
      const istMinutes = Number(new Intl.DateTimeFormat('en-IN', { minute: 'numeric', timeZone: 'Asia/Kolkata' }).format(now));
      const totalMins = istHours * 60 + istMinutes;

      let shiftName = 'Shift A (Morning Operational Shift)';
      let shiftSpan = '07:00 – 15:00';
      let arrivalWindow = '05:00 – 11:30';
      let upcoming = 'Shift B (Afternoon Shift: 14:00 – 22:00)';
      
      if (totalMins >= 420 && totalMins < 840) {
        shiftName = 'Shift A (Morning Operational Shift)';
        shiftSpan = '07:00 – 15:00';
        arrivalWindow = '05:00 – 11:30';
        upcoming = 'Shift B (Afternoon Shift: 14:00 – 22:00)';
      } else if (totalMins >= 840 && totalMins < 900) {
        shiftName = 'Shift A & B Handover Window';
        shiftSpan = '14:00 – 15:00 (Handover)';
        arrivalWindow = 'Shift B Arrival: 11:30 – 18:30';
        upcoming = 'Shift B (Full Takeover at 15:00)';
      } else if (totalMins >= 900 && totalMins < 1320) {
        shiftName = 'Shift B (Afternoon / Evening Shift)';
        shiftSpan = '14:00 – 22:00';
        arrivalWindow = '11:30 – 18:30';
        upcoming = 'Shift C (Night Shift: 22:00 – 06:00)';
      } else {
        shiftName = 'Shift C (Night Shift - Anchored to Day 1)';
        shiftSpan = '22:00 – 06:00 / 07:00 next day';
        arrivalWindow = '18:30 – 23:59 (Day 1)';
        upcoming = 'Shift A (Morning Shift: 07:00 – 15:00)';
      }

      const timeReply = `🕒 **Current Local Time & Operational Schedule**\n\n` +
        `• **Time**: **${timeStr} IST**\n` +
        `• **Date**: **${dateStr}**\n` +
        `• **Site Context**: **${siteName}**\n\n` +
        `⚡ **Active Operational Shift:**\n` +
        `• **Current Shift**: 🟢 **${shiftName}**\n` +
        `• **Working Span**: \`${shiftSpan}\`\n` +
        `• **Punch-in Window**: \`${arrivalWindow}\`\n` +
        `• **General Shift (GS)**: \`09:00 – 18:00\`\n` +
        `• **Next Handover**: \`${upcoming}\`\n\n` +
        `💡 **Quick Operations Shortcuts:**\n` +
        `• Type \`/handover\` to format your end-of-shift briefing.\n` +
        `• Click **Duty Roster** in the top bar to inspect today's site staffing.\n` +
        `• Type *"remind me in 15 minutes to inspect DG readings"* to set an alarm.`;

      const latencyMs = Date.now() - startTime;
      if (activeConvId) {
        await supabase.from('assist_messages').insert({
          conversation_id: activeConvId,
          sender: 'assistant',
          content: timeReply,
          confidence: 1.0,
          latency_ms: latencyMs,
          sources: []
        });
      }

      return res.status(200).json({
        conversationId: activeConvId,
        message: timeReply,
        isFallback: false,
        confidence: 1.0,
        sources: [],
        latencyMs
      });
    }

    // 5C. Web fallback: nothing relevant in the knowledge base and no live/staff/escalation context.
    // Employee names are never sent to the web (privacy guard inside maybeWebAnswer).
    const kbHasRelevant = items.some(it => parseFloat(it.composite_confidence || '0') >= minAcceptableThreshold);
    if (!kbHasRelevant && staffContext.length === 0 && escContext.length === 0 && !liveDbResult.isDataFound &&
        !NOT_FOR_WEB.test(trimmedQuery) && trimmedQuery.length >= 8) {
      let names: string[] = [];
      try { names = (await peopleDirectory(supabase)).rows.map(r => r.name); } catch { names = []; }
      const web = names.length ? await maybeWebAnswer(trimmedQuery, names) : null;
      if (web && web.text && web.sources.length > 0) {
        return sendDataReply({
          route: 'web',
          message: web.text,
          sourceBadge: 'From the web',
          webSources: web.sources
        }, 'web-search');
      }
    }

    // 6. Build Grounded Context for LLM (Qwen)
    let contextText = `=== VERIFIED PARADIGM KNOWLEDGE CONTEXT ===\nSite Context: ${siteName} (${siteCity || 'India'})\n\n`;

    // Inject live database intelligence if gathered from Supabase
    if (liveDbResult.isDataFound) {
      contextText += `=== LIVE PARADIGM DATABASE INTELLIGENCE ===\n${liveDbResult.textContext}\n\n`;
    }

    if (items.length === 0 && staffContext.length === 0 && escContext.length === 0 && !liveDbResult.isDataFound) {
      contextText += `Note: No specific proprietary site manual was matched for this inquiry. Answer clearly, accurately, and politely using standard operational and facility knowledge, arithmetic reasoning, or professional drafting standards as Paradigm Assist.\n\n`;
    }

    // Add retrieved knowledge items
    items.forEach((item, idx) => {
      contextText += `[DOCUMENT ${idx + 1}: ${item.title}]\n`;
      contextText += `Source: ${item.source_table} | Version: v${item.version || '1'}\n`;
      contextText += `Content: ${item.content}\n`;
      if (item.rich_content) {
        contextText += `Structured Data: ${item.rich_content}\n`;
      }
      contextText += '\n';
    });

    // Add Staff roster if queried
    if (staffContext.length > 0) {
      contextText += `[STAFF ROSTER FOR ${siteName.toUpperCase()}]\n`;
      staffContext.forEach(s => {
        contextText += `• ${s.full_name} | Role: ${s.designation} | Dept: ${s.department} | Phone: ${s.phone} | Shift: ${s.shift_type} | Reports to: ${s.reporting_manager_name || 'N/A'}\n`;
      });
      contextText += '\n';
    }

    // Add Escalation matrix if queried
    if (escContext.length > 0) {
      contextText += `[ESCALATION MATRIX]\n`;
      escContext.forEach(e => {
        contextText += `• ${e.level} - ${e.role_name}: ${e.contact_person} | Phone: ${e.phone} | TAT: ${e.tat_minutes} mins | Trigger: ${e.escalation_trigger}\n`;
      });
      contextText += '\n';
    }

    // 7. System Prompt for Enterprise Copilot
    const systemPrompt = `You are "Paradigm Assist", the official enterprise AI Operations Copilot & Companion for Paradigm Integrated Facility Services Pvt. Ltd. (paradigmfms.com).
Your purpose is to provide clear, courteous, and actionable assistance to field staff, facility managers, supervisors, and administrative personnel.

OPERATIONAL GUIDELINES:
1. STRICT WHITE-LABEL & CONFIDENTIALITY: You must identify EXCLUSIVELY as "Paradigm Assist". NEVER mention, discuss, or name any underlying AI models (such as Qwen, LLaMA, OpenAI, DeepSeek, Anthropic, or Groq) or external infrastructure providers under any circumstances. If asked who you are or what model you use, state simply: "I am Paradigm Assist, the official enterprise AI copilot developed for Paradigm Integrated Facility Services."
2. FACILITY KNOWLEDGE & SOPs: When verified Paradigm operational manuals, checklists, or staff rosters are provided in the context below, strictly ground your answers in them.
3. GENERAL INQUIRIES, MATH & CONVERSATION: For conversational greetings, identity questions ("who are you?"), math/calculations (e.g. "1+1=", "4+2=", "2+2?"), drafting emails/WhatsApp notices, or general facility engineering concepts, answer directly, accurately, and politely.
4. ABSENT SPECIFICS: If an operational question strictly requires specific proprietary site parameters or contact details not present in the context, provide standard facility management best practices and advise verifying with the Site Facility Manager or Central Helpdesk (+91 80 4114 2666).
5. PRACTICAL FORMAT: Use clean Markdown, concise bullet points, bold headers, and courteous phrasing.
6. MULTILINGUAL COURTESY: If the user asks in Hindi, Hinglish, Kannada, or Telugu, answer clearly in that language with technical terms (SOP, STP, WTP, DG, PPM, MCB) kept in English.
7. VISUAL PROCESS FLOWCHARTS & ENGINEERING P&ID SCHEMATICS: Whenever explaining or asked for a flowchart, process flow, operational sequence, or plant stages (such as STP wastewater treatment stages, WTP, RO plant, DG synchronized startup, fire alarm escalation):
   ALWAYS generate the flowchart using a \`\`\`mermaid code block with \`graph LR\` (Left-to-Right horizontal layout). Horizontal diagrams fit modern widescreen cards perfectly and match professional engineering P&ID schematics (referencing real industrial wastewater treatment plant flowsheets).
   For multi-stream processes like Wastewater Treatment / STP, ALWAYS organize into two parallel horizontal subgraphs:
   - Liquid / Water Treatment Line (Inlet & Screening -> Grit Removal -> Primary Clarifier -> Biological Aeration -> Secondary Clarifier -> Tertiary Filters -> Disinfection -> Treated Effluent Reuse)
   - Sludge Handling Line (Sludge Thickener -> Anaerobic Digestion -> Dewatering Press -> Dried Sludge Disposal)
   Connect the clarifiers to the sludge thickener via dashed links (e.g. \`Clarifier -.-> Thickener\`).
   CRITICAL SYNTAX RULE: ALWAYS enclose every box title in double quotes, for example: \`A["1. Raw Sewage Intake"] --> B["2. Coarse Bar Screening"] --> C["3. Primary Clarifier"]\`. This guarantees special characters like '&', parentheses, and slashes render properly without crashing.
   NEVER output crude ASCII text art with backslashes or dashes. The system frontend renders your Mermaid code as a high-resolution visual diagram with a 1-click "Save as Image (PNG)" button.

${contextText}`;

    // Prepare messages for Groq LLM
    const formattedHistory = (history || []).slice(-4).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: String(h.content || '')
    }));

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: trimmedQuery }
    ];

    // 8. Call LLM Engine based on user selection (Groq, Gemini, or Auto Hybrid)
    let assistantReply = '';
    let finalConfidence = Math.max(topConfidence, 0.85);
    let engineUsed = 'cloud-groq';

    // 8A. If Gemini explicitly requested, call Gemini first (key sent in the x-goog-api-key header; all keys tried)
    if (modelEngine === 'cloud-gemini' && GEMINI_API_KEY) {
      try {
        const gData: any = await callGemini({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question:\n${trimmedQuery}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        });
        const gText = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (gText) {
          assistantReply = gText;
          engineUsed = 'cloud-gemini';
        }
      } catch (gErr: any) {
        console.warn('[Assist Gemini] Call failed:', gErr.message);
      }
    }

    // 8B. If Groq requested, or if Gemini was not requested or failed (Auto Hybrid)
    if (!assistantReply && GROQ_API_KEY) {
      const candidateModels = [
        'openai/gpt-oss-120b',
        'qwen/qwen3.8-27b'
      ];

      for (const model of candidateModels) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: llmMessages,
              temperature: 0.1,
              max_tokens: 1024,
              top_p: 0.95
            })
          });

          if (groqRes.ok) {
            const groqData: any = await groqRes.json();
            const text = groqData.choices?.[0]?.message?.content?.trim();
            if (text) {
              assistantReply = text;
              engineUsed = 'cloud-groq';
              break;
            }
          } else {
            console.warn(`[Assist Groq] Model ${model} returned ${groqRes.status}`);
          }
        } catch (llmErr: any) {
          console.warn(`[Assist Groq] Error on ${model}:`, llmErr.message);
        }
      }
    }

    // 8C. Fallback to Gemini if Groq was unavailable in Auto Hybrid mode
    if (!assistantReply && GEMINI_API_KEY && modelEngine !== 'cloud-groq') {
      try {
        const gData: any = await callGemini({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question:\n${trimmedQuery}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        });
        const gText = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (gText) {
          assistantReply = gText;
          engineUsed = 'cloud-gemini';
        }
      } catch (gErr: any) {
        console.warn('[Assist Gemini Auto Fallback] Failed:', gErr.message);
      }
    }

    // Fallback if LLM unavailable
    if (!assistantReply) {
      if (items.length > 0) {
        assistantReply = `Here is the verified information from **${items[0].title}**:\n\n${items[0].content}\n\n*Source: [${items[0].title}]*`;
      } else if (staffContext.length > 0) {
        assistantReply = `Here are the staff members on duty for **${siteName}**:\n\n` +
          staffContext.map(s => `• **${s.full_name}** (${s.designation}) — 📞 [${s.phone}](tel:${s.phone}) [Shift: ${s.shift_type}]`).join('\n');
      } else {
        assistantReply = `Verified information retrieved for ${siteName}. Please review the documents in the knowledge portal.`;
      }
    }

    const latencyMs = Date.now() - startTime;

    // Build source citations array
    const citations = items.map(it => ({
      id: it.id,
      title: it.title,
      sourceTable: it.source_table,
      score: it.composite_confidence
    }));

    if (staffContext.length > 0) {
      citations.push({
        id: 'staff-roster',
        title: `Site Staff Directory (${siteName})`,
        sourceTable: 'site_staff_members',
        score: '1.0'
      });
    }

    if (liveDbResult.citations.length > 0) {
      citations.push(...liveDbResult.citations);
    }

    // Save Assistant Message
    let assistantMsgId: string | null = null;
    if (activeConvId) {
      const { data: savedMsg } = await supabase.from('assist_messages').insert({
        conversation_id: activeConvId,
        sender: 'assistant',
        content: assistantReply,
        confidence: finalConfidence,
        sources: citations,
        latency_ms: latencyMs
      }).select('id').single();

      if (savedMsg) assistantMsgId = savedMsg.id;

      // Update conversation timestamp
      await supabase
        .from('assist_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConvId);
    }

    return res.status(200).json({
      conversationId: activeConvId,
      messageId: assistantMsgId,
      message: assistantReply,
      modelEngineUsed: engineUsed,
      route: 'knowledge_base',
      confidence: finalConfidence,
      sources: citations,
      latencyMs
    });

  } catch (err: any) {
    console.error('[Assist Chat] Critical Error:', err);
    return res.status(500).json({
      error: 'Failed to process inquiry with Paradigm Assist',
      details: err.message
    });
  }
}

// ============================================================================
// FEEDBACK HANDLER (Thumbs Up / Thumbs Down)
// ============================================================================
export async function handleAssistFeedback(req: Request, res: Response) {
  try {
    const { messageId, rating } = req.body;
    if (!messageId || ![-1, 0, 1].includes(rating)) {
      return res.status(400).json({ error: 'messageId and valid rating (-1, 0, 1) required' });
    }

    const { error } = await supabase
      .from('assist_messages')
      .update({ feedback_rating: rating })
      .eq('id', messageId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, messageId, rating });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// CONVERSATIONS LIST & MESSAGES
// ============================================================================
export async function getAssistConversations(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(403).json({ error: 'Unauthorized' });

    const { data: conversations, error } = await supabase
      .from('assist_conversations')
      .select('id, title, site_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ conversations: conversations || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getConversationMessages(req: Request, res: Response) {
  try {
    const convId = req.params.id || (req.query.id as string);
    if (!convId) return res.status(400).json({ error: 'Conversation id is required' });

    const { data: messages, error } = await supabase
      .from('assist_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ messages: messages || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function deleteAssistConversation(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(403).json({ error: 'Unauthorized' });

    const convId = (req.params.id || req.query.id || req.body?.id) as string;
    if (!convId) return res.status(400).json({ error: 'Conversation id is required' });

    await supabase.from('assist_messages').delete().eq('conversation_id', convId);
    const { error } = await supabase.from('assist_conversations').delete().eq('id', convId).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true, id: convId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// ADMIN RESOLUTION & ASKER NOTIFICATION
// ============================================================================
export async function resolveUnansweredQuestion(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(403).json({ error: 'Unauthorized' });

    const {
      questionId,
      answer,
      category = 'FAQ',
      siteId = null,
      publishAsFaq = true
    } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({ error: 'questionId and answer are required' });
    }

    // 1. Get question details
    const { data: qRecord, error: qErr } = await supabase
      .from('unanswered_questions')
      .select('id, question, normalized_question')
      .eq('id', questionId)
      .single();

    if (qErr || !qRecord) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let linkedItemId: string | null = null;

    // 2. Publish as Knowledge Item if requested
    if (publishAsFaq) {
      const { data: faqMod } = await supabase
        .from('knowledge_modules')
        .select('id')
        .eq('slug', 'faqs')
        .single();

      const { data: newItem, error: itemErr } = await supabase
        .from('knowledge_items')
        .insert({
          module_id: faqMod?.id,
          source_table: 'manual_admin',
          source_id: questionId,
          title: qRecord.question.slice(0, 150),
          content: answer,
          site_id: siteId,
          tags: ['faq', 'admin-resolved', category.toLowerCase()],
          synonyms: [qRecord.question, qRecord.normalized_question],
          status: 'published',
          created_by: user.id
        })
        .select('id')
        .single();

      if (newItem) linkedItemId = newItem.id;
    }

    // 3. Mark question as resolved
    await supabase
      .from('unanswered_questions')
      .update({
        status: 'resolved',
        admin_answer: answer,
        linked_item_id: linkedItemId,
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      })
      .eq('id', questionId);

    // 4. Notify all original askers
    const { data: askers } = await supabase
      .from('unanswered_question_askers')
      .select('user_id')
      .eq('question_id', questionId);

    if (askers && askers.length > 0) {
      const notifications = askers.map(a => ({
        user_id: a.user_id,
        title: '💡 Your Question Has Been Answered!',
        message: `Admin has verified the answer to: "${qRecord.question.slice(0, 80)}..."`,
        type: 'info',
        data: {
          questionId,
          answer,
          linkedItemId,
          route: '/assist'
        },
        read: false,
        created_at: new Date().toISOString()
      }));

      await supabase.from('notifications').insert(notifications);

      // Mark askers as notified
      await supabase
        .from('unanswered_question_askers')
        .update({ notified_at: new Date().toISOString() })
        .eq('question_id', questionId);
    }

    return res.status(200).json({
      success: true,
      questionId,
      linkedItemId,
      askersNotified: askers?.length || 0
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// ADMIN STATS & ANALYTICS
// ============================================================================
export async function getAssistStats(req: Request, res: Response) {
  try {
    // 1. Total queries & messages count
    const { count: totalMessages } = await supabase
      .from('assist_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'user');

    // 2. Pending unanswered questions count
    const { count: pendingUnanswered } = await supabase
      .from('unanswered_questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 3. Resolved questions count
    const { count: resolvedCount } = await supabase
      .from('unanswered_questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved');

    // 4. Total knowledge items
    const { count: totalKnowledgeItems } = await supabase
      .from('knowledge_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    // 5. Avg confidence
    const { data: avgConfData } = await supabase
      .from('assist_messages')
      .select('confidence')
      .eq('sender', 'assistant')
      .not('confidence', 'is', null)
      .limit(100);

    let avgConfidence = 0.85;
    if (avgConfData && avgConfData.length > 0) {
      const sum = avgConfData.reduce((acc, curr) => acc + (Number(curr.confidence) || 0), 0);
      avgConfidence = Number((sum / avgConfData.length).toFixed(2));
    }

    // 6. Feedback satisfaction
    const { count: positiveFeedback } = await supabase
      .from('assist_messages')
      .select('*', { count: 'exact', head: true })
      .eq('feedback_rating', 1);

    const { count: negativeFeedback } = await supabase
      .from('assist_messages')
      .select('*', { count: 'exact', head: true })
      .eq('feedback_rating', -1);

    return res.status(200).json({
      totalQueries: totalMessages || 0,
      pendingUnanswered: pendingUnanswered || 0,
      resolvedCount: resolvedCount || 0,
      totalKnowledgeItems: totalKnowledgeItems || 0,
      avgConfidence,
      satisfaction: {
        positive: positiveFeedback || 0,
        negative: negativeFeedback || 0
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Local Offline Python Attendance & Duty Analyzer Bridge
 * Executes scripts/local_attendance_analyzer.py 100% on-premise without cloud LLM.
 */
export async function handleLocalFileAnalysis(req: Request, res: Response) {
  try {
    const { fileBase64, fileName, question = 'total how many duties i need to pay?' } = req.body;

    if (!fileBase64 && !req.body.rawText) {
      return res.status(400).json({ error: 'fileBase64 or rawText is required' });
    }

    const safeName = (fileName || 'attendance_report.pdf').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `paradigm_${Date.now()}_${safeName}`);

    if (fileBase64) {
      const buffer = Buffer.from(fileBase64, 'base64');
      fs.writeFileSync(tempFilePath, buffer);
    } else {
      fs.writeFileSync(tempFilePath, req.body.rawText, 'utf-8');
    }

    const scriptPath = path.resolve(process.cwd(), 'scripts', 'local_attendance_analyzer.py');

    execFile(
      'python',
      [scriptPath, tempFilePath, '--question', question, '--json'],
      {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        maxBuffer: 10 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch {}

        if (error) {
          console.error('[LocalPythonAnalyzer] Exec error:', error, stderr);
          return res.status(500).json({
            error: 'Failed to analyze document locally with Python',
            details: stderr || error.message
          });
        }

        try {
          const parsed = JSON.parse(stdout);
          return res.status(200).json({
            success: true,
            answer: parsed.answer,
            summary: parsed.summary,
            employees: parsed.employees
          });
        } catch (jsonErr) {
          return res.status(200).json({
            success: true,
            answer: stdout.trim(),
            summary: {},
            employees: []
          });
        }
      }
    );
  } catch (err: any) {
    console.error('[LocalPythonAnalyzer] General error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
