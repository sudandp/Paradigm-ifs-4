/**
 * Paradigm Assist — data-tool contract (shared by orchestrator, tools and frontend).
 *
 * SECURITY RULES for every tool:
 *  1. `ctx.sb` is a SERVICE-ROLE client (bypasses RLS). Every query MUST be filtered by `ctx.scope`.
 *  2. Never trust ids in args (they can come back from the client in a clarification `selection`):
 *     re-check with `ctx.scope.canSeeUser(id)` / `ctx.scope.canSeeSite...` before reading.
 *  3. Return FACTS (numbers/strings computed in code). The LLM only words them; it never counts rows.
 *  4. Never return columns on the denylist (see roles.ts NEVER_EXPOSE).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Feature-level permissions. Checked by the orchestrator before a tool runs (tool.capability). */
export type Capability =
  | 'attendance'      // punches, days worked, violations, corrections, shifts, OT
  | 'leave'           // leave requests / balances / holidays / weekly offs
  | 'tracking'        // GPS whereabouts (more sensitive than attendance)
  | 'directory'       // basic employee profile (name, role, site, manager)
  | 'directory_phone' // phone numbers / email of other employees
  | 'hr_records'      // onboarding, recruitment, document-upload status, letters, performance scores
  | 'finance'         // invoices, billing, contract values
  | 'crm'             // leads, follow-ups, quotations, referrals
  | 'tickets'         // helpdesk tickets, escalation, SLA
  | 'ops'             // ops approvals, audits, checklists, gate, devices, weather, sites
  | 'comms'           // email / notification / call logs
  | 'audit_trail';    // who-changed-what logs (admin only)

export type ScopeLevel = 'all' | 'team' | 'self' | 'none';

export interface AskerProfile {
  id: string;
  name: string;
  email: string | null;
  role_id: string;
  location_id: string | null;
}

export interface AccessScope {
  level: ScopeLevel;
  /** People this asker may see (always includes self unless level = none). For level 'all' it contains everyone. */
  userIds: Set<string>;
  /** `locations.id` values the asker is responsible for ('all' = every site). */
  siteIds: Set<string> | 'all';
  /** Lower-cased, trimmed site NAMES from site_responsibility_matrix the asker is responsible for ('all' = every site).
   *  Use for tables keyed by site_name (site_finance_tracker, site_invoice_tracker, ...). */
  siteNames: Set<string> | 'all';
  /** Finance visibility by lower-cased site name: 'all' for finance/admin roles, own matrix sites for ops managers, empty otherwise. */
  financeSiteNames: Set<string> | 'all';
  capabilities: Set<Capability>;
  /** Human-readable explanation, e.g. 'operation_manager: 3 reportees + 2 sites'. */
  why: string;
  can(cap: Capability): boolean;
  canSeeUser(userId: string): boolean;
  canSeeSiteId(siteId: string | null | undefined): boolean;
  canSeeSiteName(siteName: string | null | undefined): boolean;
  canSeeFinanceSite(siteName: string | null | undefined): boolean;
}

export interface AssistCtx {
  sb: SupabaseClient;
  asker: AskerProfile;
  scope: AccessScope;
  /** The user's original question (useful for wording "not found" messages). */
  question: string;
  /** Site selected in the UI site picker (already validated against scope), or null. */
  selectedSiteId: string | null;
  now: Date;
  /** Best-effort audit log (never throws). */
  audit(entry: { tool: string; args: any; subjectUserId?: string | null; subjectSite?: string | null; allowed: boolean; note?: string }): void;
}

/** JSON-schema subset accepted by both Gemini function-calling and Groq/OpenAI tools. Use lower-case types. */
export interface ToolParamSchema {
  type: 'object';
  properties: Record<string, { type: 'string' | 'integer' | 'number' | 'boolean' | 'array'; description?: string; enum?: string[]; items?: { type: string } }>;
  required?: string[];
}

export interface ClarifyOption {
  label: string;           // "Kavya M"
  sublabel?: string;       // "HR Ops · PIFS Bangalore"
  /** Complete args to re-run the SAME tool with the ambiguity resolved, e.g. { ...args, person_id: 'uuid' }. */
  args: Record<string, any>;
}

export type ToolResult =
  | { kind: 'answer'; facts: Record<string, any>; sourceLabel: string; /** optional pre-formatted markdown table/card the UI shows under the text */ table?: { columns: string[]; rows: (string | number | null)[][] };
      /** Ready-made markdown (app guides, leave previews). When set it is shown as-is: no template, no AI. */
      markdown?: string;
      /** Buttons under the answer, e.g. { label: 'Open Apply Leave', route: '/leaves/apply' } (in-app hash route). */
      actions?: AssistAction[] }
  | { kind: 'clarify'; question: string; options: ClarifyOption[]; /** optional markdown shown above the chips (e.g. a leave preview) */ markdown?: string }
  | { kind: 'denied'; text: string }
  | { kind: 'not_found'; text: string };

export interface AssistTool {
  name: string;                 // snake_case, unique
  /** One or two sentences: WHEN the planner should call this tool. Include example phrasings. */
  description: string;
  parameters: ToolParamSchema;
  /** Capability required (checked before run). null = everyone signed-in & verified. */
  capability: Capability | null;
  /** Badge text group, e.g. 'Attendance', 'Leave', 'Billing'. */
  module: string;
  run(ctx: AssistCtx, args: Record<string, any>): Promise<ToolResult>;
}

/** An in-app navigation button. `route` is the app's router path WITHOUT the '#', e.g. '/leaves/apply'. */
export interface AssistAction { label: string; route: string }

/** What the chat API returns for data answers (merged into the existing JSON response). */
export interface AssistDataReply {
  route: 'database' | 'web' | 'knowledge_base';
  message: string;                 // markdown
  sourceBadge?: string;            // "Paradigm database · Leave · Nov 2026"
  clarification?: { tool: string; question: string; options: { label: string; sublabel?: string; selection: { tool: string; args: Record<string, any> } }[] };
  denied?: boolean;
  table?: { columns: string[]; rows: (string | number | null)[][] };
  webSources?: { title: string; url: string }[];
  toolUsed?: string;
  /** How the question was understood: rules = fast path (no AI), ai = LLM planner, selection = chip click. */
  engine?: 'rules' | 'ai' | 'selection';
  /** Fast-path rule id (debug / analytics). */
  ruleId?: string;
  /** In-app navigation buttons ("Open Apply Leave"). */
  actions?: AssistAction[];
}
