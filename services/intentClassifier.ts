/**
 * Paradigm Assist — Semantic Intent Classifier (Phase 1)
 *
 * Replaces all fragile regex matching with an LLM-powered classifier.
 * Uses Groq llama-3.1-8b-instant for ~180ms structured JSON intent parsing.
 *
 * CONFIDENTIALITY: Never exposes Supabase, eSSL, MSSQL, or table names in responses.
 */

import type { User } from '../types';
import { supabase } from '../services/supabase';

// ─── Intent Types ─────────────────────────────────────────────────────────────

export type IntentType =
  // Attendance — Individual
  | 'attendance_individual'
  | 'attendance_my_own'
  // Attendance — Aggregate
  | 'headcount_backoffice'
  | 'headcount_site'
  | 'headcount_enterprise'
  | 'attendance_absent_list'
  | 'attendance_late_list'
  // Leave
  | 'leave_status_individual'
  | 'leave_my_balance'
  | 'leave_pending_approvals'
  | 'leave_calendar'
  // Tickets / Maintenance
  | 'ticket_summary'
  | 'ticket_my_assigned'
  | 'ticket_sla_breach'
  | 'ticket_specific'
  // Shifts & Rosters
  | 'shift_current'
  | 'shift_schedule'
  | 'roster_query'
  // Onboarding
  | 'onboarding_status'
  | 'onboarding_individual'
  // Payroll
  | 'payroll_my_slip'
  | 'payroll_summary'
  // Visitor
  | 'visitor_log'
  | 'visitor_expected'
  // SOPs / Knowledge
  | 'sop_procedure'
  | 'sop_emergency'
  | 'sop_checklist'
  // CRM & Sales
  | 'crm_summary'
  // Operations & Contracts
  | 'contract_summary'
  // Biometric & Hardware Devices
  | 'device_inventory'
  // Snags & Audits
  | 'audit_snag_summary'
  // Uniforms
  | 'uniform_summary'
  // Tracking & Violations
  | 'tracking_violation_summary'
  // Security & Roles
  | 'role_permission_query'
  // Drafting & Communication Templates
  | 'draft_template'
  // Corporate Leadership & Governance
  | 'leadership_query'
  // Human Resources Team
  | 'hr_team_query'
  // System Actions (handled before classifier)
  | 'app_launch'
  | 'math_calculation'
  | 'time_shift_query'
  | 'note_capture'
  | 'reminder_set'
  | 'greeting'
  // General
  | 'general_knowledge'
  | 'unclear';

export type DataSourceType = 'supabase' | 'biometric' | 'internet' | 'local' | 'groq_llm';

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;           // 0.0 – 1.0
  entities: {
    person?: string;            // Extracted name fragment (raw, before fuzzy resolve)
    dateScope?: string;         // 'today' | 'yesterday' | 'day_before_yesterday' | 'last_week' | 'this_month' | 'last_monday' etc.
    site?: string;              // Site name fragment
    company?: string;           // 'paradigm' | 'southwall' | 'all'
    staffCategory?: string;     // 'all' | 'mep' | 'security' | 'housekeeping' | 'back_office'
    metric?: string;            // 'count' | 'list' | 'status' | 'verify'
    equipment?: string;         // For SOP queries: 'DG Set', 'STP', 'Lift' etc.
    ticketId?: string;          // For specific ticket lookups
    leaveType?: string;         // 'casual' | 'sick' | 'annual'
    queryType?: string;         // 'verify' | 'count' | 'list' | 'balance'
  };
  dataSource: DataSourceType;
  needsClarification: boolean;
  clarificationHint?: string;   // What to ask the user if needsClarification is true
  rawQuery: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Intent Classifier ────────────────────────────────────────────────────────

class IntentClassifier {
  private static instance: IntentClassifier;
  private groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
  private groqModel = 'openai/gpt-oss-20b';
  private cachedExamples: Array<{ query: string; intent: string; entities?: any }> = [];
  private lastExamplesFetch = 0;

  private constructor() {
    this.refreshDynamicExamples().catch(() => {});
  }

  public static getInstance(): IntentClassifier {
    if (!IntentClassifier.instance) {
      IntentClassifier.instance = new IntentClassifier();
    }
    return IntentClassifier.instance;
  }

  /**
   * Loads fresh training examples from Supabase assist_training_examples table
   */
  public async refreshDynamicExamples(): Promise<void> {
    try {
      const now = Date.now();
      if (this.cachedExamples.length > 0 && now - this.lastExamplesFetch < 15 * 60 * 1000) {
        return; // Cache valid for 15 minutes
      }
      const { data, error } = await supabase
        .from('assist_training_examples')
        .select('query, intent, entities')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        this.cachedExamples = data;
        this.lastExamplesFetch = now;
        console.debug(`[IntentClassifier] Loaded ${data.length} dynamic training examples from Supabase`);
      }
    } catch (err) {
      // Fail silently; static prompts will continue to work
      console.debug('[IntentClassifier] Supabase training examples fetch deferred:', err);
    }
  }

  /**
   * Main entry point — classify any natural language query into a ParsedIntent.
   * Falls back to a safe local heuristic if Groq is unavailable.
   */
  async classify(
    query: string,
    history: ConversationTurn[] = [],
    currentUser: User | null = null,
    selectedSite: string | null = null
  ): Promise<ParsedIntent> {
    // 1. Quick on-device pre-classification for deterministic patterns (no LLM cost)
    const quickIntent = this.quickClassify(query);
    if (quickIntent) return quickIntent;

    // 2. LLM-powered semantic classification via Groq
    try {
      const groqKey = this.getGroqKey();
      if (!groqKey) throw new Error('Groq key unavailable');

      const systemPrompt = this.buildSystemPrompt(currentUser, selectedSite);
      const userPrompt = this.buildUserPrompt(query, history);

      const response = await fetch(this.groqEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 512,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) throw new Error(`Groq returned ${response.status}`);

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '{}';
      return this.parseGroqResponse(raw, query);

    } catch (err) {
      console.warn('[IntentClassifier] Groq unavailable, using heuristic fallback:', err);
      return this.heuristicFallback(query);
    }
  }

  /**
   * Directly answers general, open-ended inquiries, or drafts templates using
   * Multi-Provider Cloud AI (Groq Fast Primary + Google Gemini Secondary Fallback)
   */
  async answerGeneralQuery(
    query: string,
    history: ConversationTurn[] = [],
    currentUser: User | null = null,
    selectedSite: string | null = null
  ): Promise<string> {
    const userContext = currentUser
      ? `Current User: ${currentUser.name} (${currentUser.role || 'staff'})`
      : 'User: Operations Staff';
    const siteContext = selectedSite ? `Site Scope: ${selectedSite}` : 'All Paradigm Sites';

    const systemPrompt = `You are Paradigm Assist, an expert, professional enterprise AI operations copilot for Paradigm Integrated Facility Services (IFS).
Context: ${userContext}, ${siteContext}.

CORPORATE LEADERSHIP & GOVERNANCE:
- Company: Paradigm Integrated Facility Services Pvt. Ltd. (PIFS)
- Sister Security Entity: Southwall Security LLP (SWLLP)
- Director: Ankur (Director, Paradigm Integrated Facility Services Pvt. Ltd. | ankur@paradigmfms.com)
- Operations Leadership: Sudhan M (Administrator & Lead Operations | admin@paradigmfms.com)
- Regional Presence: Bengaluru (Headquarters), Hyderabad, Pune, Chennai
- Core Verticals: Technical MEP & Engineering, HVAC & Chillers, Water/STP/WTP Operations, 24x7 Security & Guarding, Soft Services & Housekeeping

When asked who the directors, founders, or leadership are, clearly state that Ankur is the Director of Paradigm Integrated Facility Services Pvt. Ltd., supported by Sudhan M (Lead Operations & Administrator).
When the user asks to write, draft, or provide a template (e.g. sick leave email, resignation, permission, handover, client notice), provide a complete, well-structured, professional draft ready to copy and send, with clear Subject line and formatted Body with placeholders.
For operational, engineering, or general questions, provide direct, authoritative, and concise executive answers using clean markdown.
Never disclose internal database, vendor, or infrastructure names (such as Supabase, eSSL, or MSSQL).`;

    const chatHistory = history.slice(-4).map(h => ({ role: h.role, content: h.content.slice(0, 300) }));

    // ── 1. PRIMARY: Groq Cloud AI (~150ms) ──────────────────────────────────
    try {
      const groqKey = this.getGroqKey();
      if (groqKey) {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          { role: 'user', content: query }
        ];

        for (const model of ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b']) {
          try {
            const response = await fetch(this.groqEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model,
                messages,
                temperature: 0.3,
                max_tokens: 800
              })
            });

            if (response.ok) {
              const data = await response.json();
              const text = data.choices?.[0]?.message?.content?.trim();
              if (text) return text;
            }
          } catch (mErr) {
            console.warn(`[IntentClassifier] Groq ${model} attempt failed:`, mErr);
          }
        }
      }
    } catch (groqErr) {
      console.warn('[IntentClassifier] Groq provider failed, falling back to Gemini:', groqErr);
    }

    // ── 2. SECONDARY: Google Gemini 2.5 Flash Fallback ──────────────────────
    try {
      const geminiKey = this.getGeminiKey();
      if (geminiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
        const contents = [
          {
            parts: [
              { text: `${systemPrompt}\n\nUser Request: ${query}` }
            ]
          }
        ];

        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 800
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        }
      }
    } catch (geminiErr) {
      console.warn('[IntentClassifier] Gemini fallback failed:', geminiErr);
    }

    // ── 3. TERTIARY: Offline Contextual Generator (zero network) ────────────
    if (/\b(?:mail|email|letter|template|application|resignation)\b/i.test(query)) {
      const name = currentUser?.name || '[Your Name]';
      const role = currentUser?.role || '[Your Role]';
      const site = selectedSite || 'Paradigm Facility Operations';
      const isSick = /sick|ill|doctor|medical|health/i.test(query);

      if (isSick) {
        return `**Subject:** Sick Leave Notification – ${name}\n\n` +
          `Dear [Manager's Name],\n\n` +
          `I am writing to inform you that I am unwell today, [Date], and will not be able to attend my shift at ${site}.\n\n` +
          `I expect to resume duty on [Expected Return Date]. In my absence, I have coordinated with [Colleague Name] to cover any critical shift items.\n\n` +
          `Thank you for your understanding.\n\n` +
          `Best regards,\n` +
          `**${name}**\n${role}\n${site}`;
      }

      return `**Subject:** Formal Leave Request – ${name}\n\n` +
        `Dear [Manager's Name],\n\n` +
        `I am writing to formally request leave from [Start Date] to [End Date] due to [Reason].\n\n` +
        `I have briefed [Colleague Name] to handle my operational duties during this period.\n\n` +
        `Thank you for your consideration.\n\n` +
        `Warm regards,\n` +
        `**${name}**\n${role}\n${site}`;
    }

    return '';
  }

  // ─── System Prompt (Paradigm-trained) ───────────────────────────────────────

  private buildSystemPrompt(user: User | null, selectedSite: string | null): string {
    const userContext = user
      ? `Current user: ${user.name}, Role: ${user.role || user.roleId || 'staff'}`
      : 'User not identified';
    const siteContext = selectedSite ? `Active site filter: ${selectedSite}` : 'No site filter active';

    return `You are the Paradigm Assist Intent Classifier for an Integrated Facility Management System (IFS).

CONTEXT:
- Company: Paradigm IFS — manages premium residential & commercial facilities in India
- ${userContext}
- ${siteContext}
- Sites: Nikoo Homes (Bengaluru), Uber Verdant (Bengaluru), Sunny Groves, Mantri Espana, iTowers Exente
- Staff Types: Back-Office (HR, Accounts, Operations, Helpdesk) and Field Staff (MEP/Technical, Security, Housekeeping, Gardening)
- Systems: Biometric attendance punch-in/out, Leave requests, Support/maintenance tickets, Employee onboarding, Preventive maintenance (PPM), Visitor logs

YOUR TASK:
Analyze the query and return ONLY a valid JSON object (no markdown, no explanation) with these exact fields:

{
  "intent": "<one of the allowed intent types>",
  "confidence": <0.0 to 1.0>,
  "entities": {
    "person": "<extracted name or null>",
    "dateScope": "<today|yesterday|day_before_yesterday|last_week|this_month|this_week|last_monday|last_friday|...>",
    "site": "<site name or null>",
    "company": "<paradigm|southwall|all|null>",
    "staffCategory": "<all|mep|security|housekeeping|back_office|gardening|null>",
    "metric": "<count|list|status|verify|balance|null>",
    "equipment": "<equipment name or null>",
    "ticketId": "<ticket id or null>",
    "leaveType": "<casual|sick|annual|null>",
    "queryType": "<verify|count|list|balance|null>"
  },
  "dataSource": "<supabase|biometric|internet|local|groq_llm>",
  "needsClarification": <true|false>,
  "clarificationHint": "<what to ask user if needsClarification is true, else null>"
}

ALLOWED INTENT TYPES:
attendance_individual, attendance_my_own, headcount_backoffice, headcount_site, headcount_enterprise,
attendance_absent_list, attendance_late_list,
leave_status_individual, leave_my_balance, leave_pending_approvals, leave_calendar,
ticket_summary, ticket_my_assigned, ticket_sla_breach, ticket_specific,
shift_current, shift_schedule, roster_query,
onboarding_status, onboarding_individual,
payroll_my_slip, payroll_summary,
visitor_log, visitor_expected,
sop_procedure, sop_emergency, sop_checklist,
crm_summary, contract_summary, device_inventory, audit_snag_summary, uniform_summary, tracking_violation_summary, role_permission_query,
draft_template,
leadership_query,
hr_team_query,
general_knowledge, unclear

DATA SOURCE RULES:
- supabase → back-office attendance, leave requests, tickets, onboarding, payroll, users
- biometric → field/site staff attendance punch logs
- internet → general knowledge, external info
- local → on-device: time, math, shift timings, SOPs from bundled knowledge base
- groq_llm → open-ended questions not matched to any operational data

TEMPORAL EXPRESSION MAPPING:
"today", "now", "rn", "right now", "at this moment", "currently", "as of now" → dateScope: "today"
"yesterday", "previous day", "last day", "yday" → dateScope: "yesterday"
"day before yesterday", "day before", "two days ago" → dateScope: "day_before_yesterday"
"last week", "previous week" → dateScope: "last_week"
"this week" → dateScope: "this_week"
"this month", "current month" → dateScope: "this_month"
"on monday", "last monday" → dateScope: "last_monday"
"on friday", "last friday" → dateScope: "last_friday"
(etc. for each day of week)

INFORMAL PHRASE MAPPING:
"guys", "people", "folks", "workers", "employees", "manpower" → staff (any category)
"rn", "right now", "at this point", "atm" → temporal: today
"came in", "showed up", "reported", "logged in", "clocked in", "punched in" → attendance check-in
"on leave", "absent", "off today", "not coming", "not in" → absence/leave status
"any issues?", "problems?", "complaints?", "open items" → ticket_summary
"SLA", "breach", "overdue", "escalation" → ticket_sla_breach
"DG", "diesel generator", "generator" → equipment: DG Set
"STP", "sewage", "treatment plant" → equipment: STP Plant
"lift", "elevator" → equipment: Lift
"fire", "evacuation", "emergency" → sop_emergency
"checklist", "daily check", "inspection" → sop_checklist

CONFIDENCE GUIDELINES:
- 0.90–1.0 → very clear intent, all entities resolved
- 0.70–0.89 → intent clear but some entities ambiguous
- 0.50–0.69 → partial match, set needsClarification: true
- < 0.50 → unclear, set intent: "unclear", needsClarification: true

MULTI-TURN MEMORY: If the current query is short and ambiguous (e.g., "what about today?", "and yesterday?"),
look at the conversation history to inherit the person/site entity from the previous exchange.${
  this.cachedExamples.length > 0
    ? '\n\nVERIFIED BENCHMARK TRAINING EXAMPLES:\n' +
      this.cachedExamples.slice(0, 15).map(e => `- "${e.query}" => intent: "${e.intent}"`).join('\n')
    : ''
}`;
  }

  // ─── User Prompt ─────────────────────────────────────────────────────────────

  private buildUserPrompt(query: string, history: ConversationTurn[]): string {
    const recentHistory = history.slice(-4);
    let historyText = '';
    if (recentHistory.length > 0) {
      historyText = '\n\nRECENT CONVERSATION:\n' +
        recentHistory.map(t => `${t.role.toUpperCase()}: ${t.content.slice(0, 200)}`).join('\n');
    }
    return `Classify this query: "${query}"${historyText}`;
  }

  // ─── Response Parser ──────────────────────────────────────────────────────────

  private parseGroqResponse(raw: string, originalQuery: string): ParsedIntent {
    try {
      const parsed = JSON.parse(raw);

      // Validate and normalise intent
      const validIntent = this.validateIntent(parsed.intent);
      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;

      const parsedCompany = parsed.entities?.company;
      const resolvedCompany = (parsedCompany === 'paradigm' || parsedCompany === 'southwall' || parsedCompany === 'all')
        ? parsedCompany
        : this.quickCompany(originalQuery);

      return {
        intent: validIntent,
        confidence,
        entities: {
          person: parsed.entities?.person || undefined,
          dateScope: parsed.entities?.dateScope || 'today',
          site: parsed.entities?.site || undefined,
          company: resolvedCompany,
          staffCategory: parsed.entities?.staffCategory || undefined,
          metric: parsed.entities?.metric || undefined,
          equipment: parsed.entities?.equipment || undefined,
          ticketId: parsed.entities?.ticketId || undefined,
          leaveType: parsed.entities?.leaveType || undefined,
          queryType: parsed.entities?.queryType || undefined,
        },
        dataSource: this.validateDataSource(parsed.dataSource),
        needsClarification: !!parsed.needsClarification || confidence < 0.65,
        clarificationHint: parsed.clarificationHint || undefined,
        rawQuery: originalQuery
      };
    } catch (e) {
      console.warn('[IntentClassifier] Failed to parse Groq JSON response:', raw);
      return this.heuristicFallback(originalQuery);
    }
  }

  // ─── Quick On-Device Pre-Classifier (Zero latency, zero cost) ────────────────

  private quickClassify(query: string): ParsedIntent | null {
    const q = query.trim().toLowerCase();

    // Math detection
    if (/^[\d\s\+\-\*\/\%\(\)\.]+$/.test(q) && /[\+\-\*\/]/.test(q)) {
      return this.make('math_calculation', 1.0, {}, 'local');
    }

    // Greeting
    if (/^(hi|hello|hey|namaste|good\s+(morning|afternoon|evening)|howdy|greetings|who\s+are\s+you|how\s+are\s+you|help)[\s!\.\?]*$/i.test(q)) {
      return this.make('greeting', 1.0, {}, 'local');
    }

    // Note capture
    if (/^(?:\/note\s+|(?:take|save|add)\s+note:?\s*)/i.test(q)) {
      return this.make('note_capture', 1.0, {}, 'local');
    }

    // Reminder
    if (/\b(?:remind\s+me|set\s+(?:a\s+)?reminder|alarm\s+in)\b/i.test(q)) {
      return this.make('reminder_set', 1.0, {}, 'local');
    }

    // Drafting & Communication Templates (Email, Mail, Letter, Notice, Handover)
    if (
      /\b(?:write|draft|provide|give\s*me|create|compose|prepare|generate|format|template)\b.*\b(?:mail|email|letter|template|application|notice|message|memo|proposal|handover)\b/i.test(q) ||
      /\b(?:mail|email|letter|template|application)\s+(?:for|to|regarding|about)\b/i.test(q) ||
      /\b(?:sick\s*leave|casual\s*leave|earned\s*leave|permission|resignation|handover|incident)\s*(?:mail|email|letter|template|application)\b/i.test(q) ||
      /\b(?:mail|email)\s*(?:template|draft)\b/i.test(q)
    ) {
      return this.make('draft_template', 0.98, { queryType: 'draft' }, 'groq_llm', query);
    }

    // Corporate Leadership & Directors (who is director, leadership team, CEO, who leads)
    if (/\b(?:directors?|managing\s*director|md\b|ceo|founder|founders|leadership|board\s*of\s*directors|who\s+leads?|head\s+of\s+paradigm|who\s+(?:is|are)\s+(?:the\s+)?(?:paradigm\s+)?(?:directors?|boss|head))\b/i.test(q)) {
      return this.make('leadership_query', 0.98, { company: this.quickCompany(q) }, 'supabase', query);
    }

    // Human Resources Team (hr names, who is in hr, hr contact, hr members)
    if (/\b(?:hr\s*(?:names?|team|members?|contact|support|department|personnel|officers?|ops)|who\s+is\s+(?:in\s+)?hr|human\s+resources?)\b/i.test(q)) {
      return this.make('hr_team_query', 0.98, {}, 'supabase', query);
    }

    // My own attendance
    if (/\b(my\s*(attendance|punch|punches|shift|clock|check\s*in|status)|when\s+did\s+i|my\s+in\s+time|did\s+i\s+punch)\b/i.test(q)) {
      return this.make('attendance_my_own', 1.0, { dateScope: this.quickDateScope(q) }, 'supabase');
    }

    // Leave balance (self)
    if (/\b(my\s+leave\s*balance|how\s+many\s+leaves?\s+(do\s+)?(i\s+)?have|my\s+remaining\s+leave)\b/i.test(q)) {
      return this.make('leave_my_balance', 1.0, {}, 'supabase');
    }

    // SLA breach
    if (/\b(sla\s+breach|overdue\s+ticket|escalat|missed\s+sla)\b/i.test(q)) {
      return this.make('ticket_sla_breach', 1.0, {}, 'supabase');
    }

    // Tickets & Work Orders (handles typos: 'tickes', 'ticket', 'tickets', 'work order')
    if (/\b(ticke\w*|work\s*order\w*|open\s*issue\w*|complaint\w*)\b/i.test(q)) {
      return this.make('ticket_summary', 0.95, {}, 'supabase', query);
    }

    // Onboarding status & count
    if (/\b(onboard\w*|joining\w*|new\s+joiners?)\b/i.test(q)) {
      const company = this.quickCompany(q);
      return this.make('onboarding_status', 0.95, { metric: 'count', company }, 'supabase', query);
    }

    // CRM & Sales leads
    if (/\b(crm|leads?|pipeline|prospects?|sales\s*pitch|deals?)\b/i.test(q)) {
      return this.make('crm_summary', 0.95, {}, 'supabase', query);
    }

    // Operations Contracts & AMCs
    if (/\b(contracts?|amc\b|vendor\s*contract|amc\s*agreement|active\s*agreement)\b/i.test(q)) {
      return this.make('contract_summary', 0.95, {}, 'supabase', query);
    }

    // Biometric & Hardware Devices
    if (/\b(biometric\s*devices?|fingerprint\s*scanner|attendance\s*machine|cctv\s*camera|kiosk\s*devices?|hardware\s*devices?)\b/i.test(q)) {
      return this.make('device_inventory', 0.95, {}, 'supabase', query);
    }

    // Snags & Audits
    if (/\b(snags?|audit\s*report|ht\s*yard|snag\s*list|open\s*snags?|inspection\s*report)\b/i.test(q)) {
      return this.make('audit_snag_summary', 0.95, {}, 'supabase', query);
    }

    // Uniforms & Kits
    if (/\b(uniforms?|kits?|shoes?|trousers?|dress|uniform\s*request)\b/i.test(q)) {
      return this.make('uniform_summary', 0.95, {}, 'supabase', query);
    }

    // Tracking & Geofence Violations
    if (/\b(geofence|violations?|out\s*of\s*boundary|tracking\s*history|gps\s*route)\b/i.test(q)) {
      return this.make('tracking_violation_summary', 0.95, { dateScope: this.quickDateScope(q) }, 'supabase', query);
    }

    // Security & Roles / Permissions
    if (/\b(roles?|permissions?|access\s*control|my\s*permissions|registered\s*devices?)\b/i.test(q)) {
      return this.make('role_permission_query', 0.95, {}, 'supabase', query);
    }

    return null; // Let Groq handle the rest
  }

  // ─── Heuristic Fallback (when Groq unavailable) ──────────────────────────────

  private heuristicFallback(query: string): ParsedIntent {
    const q = query.trim().toLowerCase();
    const dateScope = this.quickDateScope(q);
    const company = this.quickCompany(q);

    // Individual person attendance
    if (/\b(report|reported|came|come|arrive|arrived|punch|punched|check|checked|present|working|clocked)\b/i.test(q) &&
        !/\b(total|count|how\s*many|all\s*staff|back\s*office|field\s*staff|headcount|manpower)\b/i.test(q)) {
      return this.make('attendance_individual', 0.72, { dateScope, company }, 'supabase');
    }

    // Headcount — site
    if (/\b(field|site|nikoo|uber|exente|sunny|mantri|mep|security|guard|housekeeping)\b/i.test(q) &&
        /\b(present|count|how\s*many|total|manpower|headcount|working)\b/i.test(q)) {
      return this.make('headcount_site', 0.75, { dateScope, company }, 'biometric');
    }

    // Headcount — back office
    if (/\b(back\s*office|office\s*staff|admin\s*staff|accounts?|billing|helpdesk)\b/i.test(q)) {
      return this.make('headcount_backoffice', 0.75, { dateScope, company }, 'supabase');
    }

    // Ticket queries (handles typos like 'tickes')
    if (/\b(ticke\w*|sla|open\s*issues?|maintenance|work\s*order|complaint)\b/i.test(q)) {
      return this.make('ticket_summary', 0.85, {}, 'supabase');
    }

    // Drafting & Communication Templates (Email, Mail, Letter, Notice, Handover)
    if (
      /\b(?:write|draft|provide|give\s*me|create|compose|prepare|generate|format|template)\b.*\b(?:mail|email|letter|template|application|notice|message|memo|proposal|handover)\b/i.test(q) ||
      /\b(?:mail|email|letter|template|application)\s+(?:for|to|regarding|about)\b/i.test(q) ||
      /\b(?:sick\s*leave|casual\s*leave|earned\s*leave|permission|resignation|handover|incident)\s*(?:mail|email|letter|template|application)\b/i.test(q) ||
      /\b(?:mail|email)\s*(?:template|draft)\b/i.test(q)
    ) {
      return this.make('draft_template', 0.95, { queryType: 'draft' }, 'groq_llm', query);
    }

    // Corporate Leadership & Directors
    if (/\b(?:directors?|managing\s*director|md\b|ceo|founder|founders|leadership|board\s*of\s*directors|who\s+leads?|head\s+of\s+paradigm|who\s+(?:is|are)\s+(?:the\s+)?(?:paradigm\s+)?(?:directors?|boss|head))\b/i.test(q)) {
      return this.make('leadership_query', 0.95, { company: this.quickCompany(q) }, 'supabase', query);
    }

    // Human Resources Team
    if (/\b(?:hr\s*(?:names?|team|members?|contact|support|department|personnel|officers?|ops)|who\s+is\s+(?:in\s+)?hr|human\s+resources?)\b/i.test(q)) {
      return this.make('hr_team_query', 0.95, {}, 'supabase', query);
    }

    // Leave queries (Roster / Calendar lookups only)
    if (/\b(leave|absent|off\s*today|on\s*leave|annual|casual|sick)\b/i.test(q) &&
        !/\b(mail|email|letter|template|application|write|draft|compose)\b/i.test(q)) {
      return this.make('leave_calendar', 0.68, { dateScope }, 'supabase');
    }

    // Onboarding
    if (/\b(onboard\w*|submission\w*|pending\s+form|kyc|verification\w*|joining\w*|hired)\b/i.test(q)) {
      return this.make('onboarding_status', 0.85, { metric: 'count', company }, 'supabase', query);
    }

    // SOP / procedure
    if (/\b(procedure|protocol|sop|checklist|how\s+to|startup|shutdown|steps?)\b/i.test(q)) {
      return this.make('sop_procedure', 0.68, {}, 'local');
    }

    // CRM & Sales leads
    if (/\b(crm|leads?|pipeline|prospects?|deals?)\b/i.test(q)) {
      return this.make('crm_summary', 0.85, {}, 'supabase', query);
    }
    // Operations Contracts & AMCs
    if (/\b(contracts?|amc\b|vendor\s*contract)\b/i.test(q)) {
      return this.make('contract_summary', 0.85, {}, 'supabase', query);
    }
    // Biometric & Hardware Devices
    if (/\b(biometric\s*devices?|fingerprint|scanners?|terminals?)\b/i.test(q)) {
      return this.make('device_inventory', 0.85, {}, 'supabase', query);
    }
    // Snags & Audits
    if (/\b(snags?|audits?|inspection)\b/i.test(q)) {
      return this.make('audit_snag_summary', 0.85, {}, 'supabase', query);
    }
    // Uniforms & Kits
    if (/\b(uniforms?|kits?|shoe\s*size)\b/i.test(q)) {
      return this.make('uniform_summary', 0.85, {}, 'supabase', query);
    }
    // Tracking & Geofence Violations
    if (/\b(geofence|violations?|tracking)\b/i.test(q)) {
      return this.make('tracking_violation_summary', 0.85, { dateScope }, 'supabase', query);
    }
    // Security & Roles / Permissions
    if (/\b(roles?|permissions?|access\s*control)\b/i.test(q)) {
      return this.make('role_permission_query', 0.85, {}, 'supabase', query);
    }

    // General fallback
    return this.make('general_knowledge', 0.5, {}, 'groq_llm');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private make(
    intent: IntentType,
    confidence: number,
    entities: ParsedIntent['entities'],
    dataSource: DataSourceType,
    rawQuery = ''
  ): ParsedIntent {
    return {
      intent,
      confidence,
      entities: { dateScope: 'today', ...entities },
      dataSource,
      needsClarification: confidence < 0.65,
      rawQuery
    };
  }

  private quickDateScope(q: string): string {
    if (/\b(day\s+before\s+yesterday|two\s+days\s+ago)\b/i.test(q)) return 'day_before_yesterday';
    if (/\byesterday\b/i.test(q)) return 'yesterday';
    if (/\blast\s+week\b/i.test(q)) return 'last_week';
    if (/\bthis\s+week\b/i.test(q)) return 'this_week';
    if (/\bthis\s+month\b/i.test(q)) return 'this_month';
    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    for (const day of dayNames) {
      if (new RegExp(`\\b(on|last)\\s+${day}\\b`, 'i').test(q)) return `last_${day}`;
    }
    return 'today';
  }

  private quickCompany(q: string): 'paradigm' | 'southwall' | 'all' | undefined {
    if (/\b(paradigm|pifs)\b/i.test(q)) return 'paradigm';
    if (/\b(southwall|south\s*wall|swllp)\b/i.test(q)) return 'southwall';
    return undefined;
  }

  private validateIntent(raw: string): IntentType {
    const valid: IntentType[] = [
      'attendance_individual','attendance_my_own','headcount_backoffice','headcount_site',
      'headcount_enterprise','attendance_absent_list','attendance_late_list',
      'leave_status_individual','leave_my_balance','leave_pending_approvals','leave_calendar',
      'ticket_summary','ticket_my_assigned','ticket_sla_breach','ticket_specific',
      'shift_current','shift_schedule','roster_query',
      'onboarding_status','onboarding_individual',
      'payroll_my_slip','payroll_summary',
      'visitor_log','visitor_expected',
      'sop_procedure','sop_emergency','sop_checklist',
      'crm_summary','contract_summary','device_inventory','audit_snag_summary',
      'uniform_summary','tracking_violation_summary','role_permission_query',
      'draft_template',
      'leadership_query',
      'hr_team_query',
      'app_launch','math_calculation','time_shift_query','note_capture','reminder_set',
      'greeting','general_knowledge','unclear'
    ];
    return valid.includes(raw as IntentType) ? (raw as IntentType) : 'unclear';
  }

  private validateDataSource(raw: string): DataSourceType {
    const valid: DataSourceType[] = ['supabase','biometric','internet','local','groq_llm'];
    return valid.includes(raw as DataSourceType) ? (raw as DataSourceType) : 'groq_llm';
  }

  private getGroqKey(): string {
    // 1. Vite browser environment
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GROQ_API_KEY) {
      return (import.meta as any).env.VITE_GROQ_API_KEY;
    }
    // 2. Node.js server environment
    if (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) {
      return process.env.GROQ_API_KEY;
    }
    if (typeof process !== 'undefined' && process.env?.VITE_GROQ_API_KEY) {
      return process.env.VITE_GROQ_API_KEY;
    }
    // 3. Fallback
    return '';
  }

  private getGeminiKey(): string {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_KEY_1) {
      return (import.meta as any).env.VITE_API_KEY_1;
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_KEY_2) {
      return (import.meta as any).env.VITE_API_KEY_2;
    }
    if (typeof process !== 'undefined' && process.env?.VITE_API_KEY_1) {
      return process.env.VITE_API_KEY_1;
    }
    if (typeof process !== 'undefined' && process.env?.VITE_API_KEY_2) {
      return process.env.VITE_API_KEY_2;
    }
    return '';
  }
}

export const intentClassifier = IntentClassifier.getInstance();
