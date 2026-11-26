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

export interface ToolSelection { tool: string; args: Record<string, any> }

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
export async function handleDataQuestion(ctx: AssistCtx, question: string, history: HistoryItem[] = [], selection?: ToolSelection | null): Promise<AssistDataReply | null> {
  try {
    let tool: AssistTool | undefined;
    let args: Record<string, any> = {};
    // selections re-run a tool whose question was already understood → template answer, no AI
    let engine: 'rules' | 'ai' | 'selection' = 'selection';
    let ruleId: string | undefined;

    if (selection && typeof selection === 'object' && typeof selection.tool === 'string') {
      tool = toolByName(selection.tool);
      if (!tool) return { route: 'database', message: 'That option is no longer available. Please ask your question again.', denied: false };
      args = selection.args && typeof selection.args === 'object' && !Array.isArray(selection.args) ? { ...selection.args } : {};
    } else {
      // 1) rules-first fast path (no AI): common questions are recognised by patterns + DB name matching
      const fast = await matchFastPath(ctx.sb, question, ctx.now).catch(e => { console.warn('[Assist fastpath]', e?.message); return null; });
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
      delete args.person_id; delete args.site_exact;
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

    const result: ToolResult = await tool.run(ctx, args);
    ctx.audit({ tool: tool.name, args, ...subj, allowed: result.kind !== 'denied', note: `${result.kind} via ${engine}${ruleId ? ':' + ruleId : ''}` });
    const meta = { engine, ruleId };

    switch (result.kind) {
      case 'clarify':
        return {
          ...meta, route: 'database', toolUsed: tool.name, message: result.markdown ? `${result.markdown}\n\n${result.question}` : result.question,
          clarification: {
            tool: tool.name, question: result.question,
            options: result.options.map(o => ({ label: o.label, sublabel: o.sublabel, selection: { tool: tool!.name, args: o.args } })),
          },
        };
      case 'denied':
        return { ...meta, route: 'database', toolUsed: tool.name, message: result.text.startsWith('🔒') ? result.text : `🔒 ${result.text}`, denied: true };
      case 'not_found':
        return { ...meta, route: 'database', toolUsed: tool.name, message: result.text };
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
