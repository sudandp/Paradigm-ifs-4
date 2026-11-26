/**
 * Paradigm Assist — data-question orchestrator.
 * plan (or clarification selection) → capability check → tool (scope re-checked inside) → clarify / denied / answer → phrase → audit.
 * Returns null when the question is not a Paradigm-data question (caller continues to the knowledge-base flow)
 * or on any unexpected error (fail open to the old flow, never to more data).
 */
import type { AssistCtx, AssistDataReply, AssistTool, Capability, ToolResult } from './types.js';
import { ALL_TOOLS, toolByName } from './tools/index.js';
import { planTool, phraseAnswer, webAnswer, type HistoryItem } from './llm.js';
import { todayIst } from './helpers.js';
import { ROLE_LABEL } from './roles.js';
import { matchFastPath } from './fastpath/index.js';
import { renderAnswer } from './fastpath/templates.js';
import { resumePendingDraft } from './tools/leave-apply.js';

export interface ToolSelection { tool: string; args: Record<string, any> }

// ------------------------------------------------------------------ multi-turn drafts (apply leave: "type the dates / a reason")
/** Stored in the assistant message's `sources` (and in memory) when a tool waits for a TYPED reply. */
export interface PendingAction { type: 'pending_action'; tool: string; args: Record<string, any>; awaiting: string; at: string }
export type AssistDataReplyWithDraft = AssistDataReply & { pendingAction?: PendingAction };
export const PENDING_TTL_MS = 30 * 60_000;
export const isFreshPending = (p: any, now = new Date()): p is PendingAction =>
  !!p && p.type === 'pending_action' && typeof p.tool === 'string' && p.args && typeof p.args === 'object' && !Array.isArray(p.args)
  && typeof p.awaiting === 'string' && Number.isFinite(Date.parse(p.at)) && now.getTime() - Date.parse(p.at) < PENDING_TTL_MS;

/** In-memory copy keyed by user + client conversation id (works even when the conversation id is not a DB row). */
const pendingMem = new Map<string, PendingAction>();
const memKey = (userId: string, convId: string | null | undefined) => `${userId}|${convId || 'none'}`;
/** Returns AND removes the draft (it is re-saved only if the next reply waits again). */
export function takePendingFromMemory(userId: string, convId: string | null | undefined): PendingAction | null {
  const k = memKey(userId, convId);
  const p = pendingMem.get(k) ?? null;
  pendingMem.delete(k);
  return isFreshPending(p) ? p : null;
}
export function savePendingToMemory(userId: string, convId: string | null | undefined, p: PendingAction) {
  if (pendingMem.size > 5000) for (const [k, v] of pendingMem) if (!isFreshPending(v)) pendingMem.delete(k);
  pendingMem.set(memKey(userId, convId), p);
}

const CAP_DENIED: Record<Capability, string> = {
  attendance: 'Attendance records of other employees are limited to their managers, HR and Admin.',
  leave: 'Leave records of other employees are limited to their managers, HR and Admin.',
  tracking: "Location tracking is limited to Admin and the employee's reporting managers.",
  directory: 'The employee directory is not available for your account.',
  directory_phone: 'Phone numbers and email addresses of employees are limited to managers, HR and Admin.',
  hr_records: 'Onboarding, recruitment and HR records are limited to HR and Admin.',
  finance: "Invoice and billing data is limited to Finance, Admin and the site's Operations Manager.",
  crm: 'CRM and sales data is limited to Business Development and Admin.',
  tickets: 'Helpdesk tickets are not available for your account.',
  ops: 'Operations data is not available for your account.',
  comms: 'Email, notification and call logs are limited to HR and Admin.',
  audit_trail: 'The security and change audit trail is limited to Admin.',
};

const PENDING_TEXT = 'Your account is pending verification, so I can only answer general and policy questions for now. Once an admin verifies your account, you can ask about attendance, leave and other records.';

function subjectOf(args: any) {
  return {
    subjectUserId: typeof args?.person_id === 'string' ? args.person_id : null,
    subjectSite: (args?.site_exact || args?.site_name || null) as string | null,
  };
}

/**
 * Answers a Paradigm-data question, or returns null (not a data question / unexpected error).
 * `selection` = a clarification chip the user clicked ({ tool, args }); the planner is skipped.
 */
export async function handleDataQuestion(ctx: AssistCtx, question: string, history: HistoryItem[] = [], selection?: ToolSelection | null, pending?: PendingAction | null): Promise<AssistDataReplyWithDraft | null> {
  try {
    let tool: AssistTool | undefined;
    let args: Record<string, any> = {};
    // selections re-run a tool whose question was already understood → template answer, no AI
    let engine: 'rules' | 'ai' | 'selection' = 'selection';
    let ruleId: string | undefined;

    const isSelection = !!selection && typeof selection === 'object' && typeof selection.tool === 'string';
    // a typed reply that is not clearly a new question continues the pending draft (null = treat as a new question)
    const resumed = !isSelection && isFreshPending(pending, ctx.now) && toolByName(pending.tool) ? resumePendingDraft(pending as any, question, ctx.now) : null;

    if (isSelection) {
      tool = toolByName(selection!.tool);
      if (!tool) return { route: 'database', message: 'That option is no longer available. Please ask your question again.', denied: false };
      args = selection!.args && typeof selection!.args === 'object' && !Array.isArray(selection!.args) ? { ...selection!.args } : {};
    } else if (resumed) {
      // 0) a typed reply to a pending draft ("tomorrow", "family function", "cancel") → fill the awaited field, re-run the tool
      tool = toolByName(resumed.tool);
      args = { ...resumed.args };
      delete args.confirm_token; // a typed reply never confirms; only the signed chip does
      ruleId = `draft:${pending!.awaiting}`;
    } else {
      // 1) rules-first fast path (no AI): common questions are recognised by patterns + DB name matching
      const fast = await matchFastPath(ctx.sb, question, ctx.now).catch(e => { console.warn('[Assist fastpath]', e?.message); return null; });
      // Write tools switched off (ASSIST_ENABLE_LEAVE_APPLY not set): guide the user to the app instead of failing silently.
      if (fast && !toolByName(fast.tool) && (fast.tool === 'apply_leave' || fast.tool === 'withdraw_leave')) {
        const apply = fast.tool === 'apply_leave';
        return {
          route: 'database', engine: 'rules', ruleId: fast.ruleId, toolUsed: fast.tool,
          message: apply
            ? 'Applying leave directly from chat isn\'t switched on yet. You can apply in the app in a few taps:\n\n1. Open **Apply Leave**\n2. Pick the leave type, dates and full/half day\n3. Enter a reason and tap **Submit**\n\nYour reporting manager will be notified to approve it.'
            : 'Withdrawing leave from chat isn\'t switched on yet. Open **My Leaves**, find the pending request and tap the **Withdraw Request** icon next to it.',
          actions: [apply ? { label: 'Open Apply Leave', route: '/leaves/apply' } : { label: 'Open My Leaves', route: '/leaves/dashboard' }],
        };
      }
      if (fast && toolByName(fast.tool)) {
        tool = toolByName(fast.tool);
        args = { ...fast.args };
        engine = 'rules';
        ruleId = fast.ruleId;
      } else {
        // 2) AI planner for everything the rules don't recognise
        const plan = await planTool(question, history, ALL_TOOLS, todayIst(ctx.now));
        if (!plan) return null;
        tool = toolByName(plan.tool);
        if (!tool) return null;
        args = { ...plan.args };
        engine = 'ai';
      }
      // neither path may inject internal ids
      delete args.person_id; delete args.site_exact; delete args.confirm_token; delete args.request_id;
    }

    const subj = subjectOf(args);
    if (ctx.scope.level === 'none') {
      ctx.audit({ tool: tool.name, args, ...subj, allowed: false, note: 'unverified account' });
      return { route: 'database', message: PENDING_TEXT, denied: true, toolUsed: tool.name };
    }
    if (tool.capability && !ctx.scope.can(tool.capability)) {
      ctx.audit({ tool: tool.name, args, ...subj, allowed: false, note: `missing capability ${tool.capability}` });
      return { route: 'database', message: `🔒 ${CAP_DENIED[tool.capability]} Your role (${ROLE_LABEL(ctx.asker.role_id)}) can't view it.`, denied: true, toolUsed: tool.name };
    }

    // Argument hygiene (mainly for AI-planned calls): map name aliases onto the field the tool understands, and
    // refuse filters the tool does not support instead of silently answering about the wrong subject
    // (e.g. "overtime at nikoo" must not fall back to the asker's own overtime).
    if (engine !== 'selection') {
      const props = tool.parameters?.properties ?? {};
      if (args.person_name && !('person_name' in props) && 'candidate_name' in props && !args.candidate_name) { args.candidate_name = args.person_name; delete args.person_name; }
      const SUBJECT_KEYS: Record<string, string> = { site_name: 'a site', team: 'a whole team', person_name: 'one person' };
      const unsupported = Object.keys(args).filter(k => k in SUBJECT_KEYS && args[k] && !(k in props));
      if (unsupported.length) {
        ctx.audit({ tool: tool.name, args, ...subj, allowed: true, note: `unsupported filter ${unsupported.join(',')}` });
        return { engine, ruleId, route: 'database', toolUsed: tool.name, sourceBadge: 'Paradigm database',
          message: `I can't filter ${tool.module.toLowerCase()} by ${unsupported.map(k => SUBJECT_KEYS[k]).join(' or ')} yet. Try asking for a specific person${'team' in props ? ' or your whole team' : ''}${'site_name' in props ? ' or a site' : ''}.` };
      }
    }

    const result: ToolResult = await tool.run(ctx, args);
    ctx.audit({ tool: tool.name, args, ...subj, allowed: result.kind !== 'denied', note: `${result.kind} via ${engine}${ruleId ? ':' + ruleId : ''}` });
    const meta = { engine, ruleId };

    switch (result.kind) {
      case 'clarify': {
        const pend = (result as any).pending;
        const pendingAction: PendingAction | undefined = pend && typeof pend.tool === 'string'
          ? { type: 'pending_action', tool: pend.tool, args: pend.args ?? {}, awaiting: String(pend.awaiting), at: ctx.now.toISOString() } : undefined;
        return {
          ...meta, route: 'database', toolUsed: tool.name, ...(pendingAction ? { pendingAction } : {}), message: result.markdown ? `${result.markdown}\n\n${result.question}` : result.question,
          // file-upload step (e.g. Sick Leave certificate): the UI sends this selection back with certificate_path added
          ...(result.upload ? { upload: { ...result.upload, selection: { tool: tool.name, args: { ...(pend?.args ?? {}) } } } } : {}),
          clarification: {
            tool: tool.name, question: result.question,
            options: result.options.map(o => ({ label: o.label, sublabel: o.sublabel, selection: { tool: tool!.name, args: o.args } })),
          },
        };
      }
      case 'denied':
        return { ...meta, route: 'database', toolUsed: tool.name, message: result.text.startsWith('🔒') ? result.text : `🔒 ${result.text}`, denied: true };
      case 'not_found':
        return { ...meta, route: 'database', toolUsed: tool.name, message: result.text, sourceBadge: 'Paradigm database' };
      case 'answer': {
        // Template wording (instant, no AI) for rule-matched questions and chip selections;
        // AI wording only when the AI planner was needed (unusual phrasing / regional language),
        // unless ASSIST_PHRASE=template forces templates everywhere.
        const useAi = !result.markdown && engine === 'ai' && process.env.ASSIST_PHRASE !== 'template';
        const text = result.markdown
          ? result.markdown
          : useAi
            ? await phraseAnswer(question, result.facts, result.sourceLabel)
            : renderAnswer(tool.name, result.facts, result.sourceLabel);
        return { ...meta, route: 'database', toolUsed: tool.name, message: text, sourceBadge: result.sourceLabel.startsWith('App guide') ? result.sourceLabel : `Paradigm database · ${result.sourceLabel}`, table: result.table, actions: result.actions };
      }
    }
    return null;
  } catch (e: any) {
    console.warn('[Assist orchestrator] falling back to knowledge-base flow:', e?.message);
    return null;
  }
}

// ------------------------------------------------------------------ web fallback with privacy guard
const GENERIC_WORDS = new Set([
  'security', 'officer', 'facility', 'facilities', 'manager', 'admin', 'guard', 'guards', 'supervisor', 'technician', 'senior',
  'junior', 'executive', 'field', 'staff', 'site', 'team', 'paradigm', 'office', 'helper', 'driver', 'test', 'user', 'house',
  'keeping', 'housekeeping', 'electrician', 'plumber', 'operator', 'accounts', 'finance', 'human', 'resources', 'india',
  'bangalore', 'bengaluru', 'karnataka', 'kumar', 'service', 'services', 'super', 'head', 'lead', 'assistant', 'associate',
  'operations', 'operation', 'engineer', 'technical', 'mobile', 'account', 'company', 'manpower', 'south', 'north', 'east', 'west',
]);

/** Name tokens (≥4 chars, not generic job words) of employees that appear in the question. */
export function mentionedEmployeeTokens(question: string, peopleNames: string[]) {
  const tokens = new Set(question.toLowerCase().split(/[^a-zऀ-ൿ]+/).filter(t => t.length >= 4));
  const hits = new Set<string>();
  for (const name of peopleNames) {
    for (const part of String(name || '').toLowerCase().split(/[^a-z]+/)) {
      if (part.length >= 4 && !GENERIC_WORDS.has(part) && tokens.has(part)) hits.add(part);
    }
  }
  return [...hits];
}

/**
 * Web answer for general questions. Returns null when the question mentions an employee name (never sent to the web)
 * or when no web-capable model is available.
 */
export async function maybeWebAnswer(question: string, peopleNames: string[]): Promise<{ text: string; sources: { title: string; url: string }[] } | null> {
  try {
    if (mentionedEmployeeTokens(question, peopleNames).length) return null;
    return await webAnswer(question);
  } catch (e: any) {
    console.warn('[Assist web] failed:', e?.message);
    return null;
  }
}
