/** App navigation / how-to guide tools. Owned by the GUIDE agent. */
import type { AssistCtx, AssistTool, ToolResult } from '../types.js';
import { GUIDE_BY_ID, GUIDE_CATALOGUE, matchGuides, type GuideEntry } from '../guide/catalogue.js';
import { accessFor, rolesWithPermission, type GuideAccess } from '../guide/access.js';
import { questionCatalogue } from '../fastpath/index.js';

const isMobileHint = (q: string) => /\b(mobile|phone|android|ios|iphone)\b/i.test(q);

async function managerName(ctx: AssistCtx): Promise<string | null> {
  try {
    const { data } = await ctx.sb.from('users').select('reporting_manager_id').eq('id', ctx.asker.id).maybeSingle();
    const mid = (data as any)?.reporting_manager_id;
    if (!mid) return null;
    const { data: m } = await ctx.sb.from('users').select('name').eq('id', mid).maybeSingle();
    return (m as any)?.name ?? null;
  } catch { return null; }
}

const OPEN_NAME: Record<string, string> = {
  apply_leave: 'Apply Leave', attendance_report: 'Attendance Dashboard', attendance_punch: 'Attendance Dashboard', raise_ticket: 'New Ticket',
  site_finance_tracker: 'Site Finance Tracker', grant_comp_off: 'Grant Comp Off', bulk_earned_leave: 'Bulk Leave Update', add_user: 'Add User',
  profile_photo: 'Profile', change_password: 'Profile', leave_dashboard: 'Leave Dashboard', holiday_selection: 'Holiday Selection', home: 'Home', tasks: 'Tasks',
};
const openName = (g: GuideEntry) => OPEN_NAME[g.id] ?? ([...g.menuPath].reverse().find(s => !/bottom bar/i.test(s)) ?? g.title);

function renderGuide(g: GuideEntry, access: GuideAccess, question: string): ToolResult {
  const where = g.menuPath.join(' › ');
  const lines: string[] = [`**${g.title}**`, '', `**Where:** ${where}`, ''];
  g.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  const tips = [...(g.tips ?? [])];
  if (isMobileHint(question) && g.menuPath[0].includes('bottom bar')) tips.push('On the phone app, this is in the bottom bar.');
  if (!isMobileHint(question) && g.menuPath[0].includes('bottom bar')) tips.push('On desktop the same page is reachable from the left menu; on the phone app use the bottom bar.');
  if (tips.length) { lines.push('', ...tips.map(t => `Tip: ${t}`)); }
  if (g.menuPermission && g.menuPermission !== g.requiredPermission && !access.can(g.menuPermission)) {
    lines.push('', 'Note: the menu item may be hidden for your role; the button below opens the page directly.');
  }
  return {
    kind: 'answer', facts: { guide: g.id, route: g.route, menu: where },
    sourceLabel: `App guide · ${g.title}`, markdown: lines.join('\n'),
    actions: [{ label: `Open ${openName(g)}`, route: g.route }],
  };
}

async function renderNoAccess(ctx: AssistCtx, g: GuideEntry, access: GuideAccess): Promise<ToolResult> {
  const perm = g.requiredPermission!;
  const roles = await rolesWithPermission(ctx.sb, perm);
  const mgr = await managerName(ctx);
  const ask = mgr ? `${mgr} (your reporting manager) or your admin / HR` : 'your reporting manager or your admin / HR';
  const md = [
    `**${g.title}** is at **${g.menuPath.join(' › ')}**, but your role (**${access.roleLabel}**) does not have access to it.`,
    '',
    `It is available to roles such as: ${roles.join(', ')}.`,
    `If you need it for your work, please ask ${ask} to enable it for you.`,
  ].join('\n');
  return { kind: 'answer', facts: { guide: g.id, access: false, required: perm }, sourceLabel: `App guide · ${g.title}`, markdown: md };
}

const helpEntry = (): ToolResult => {
  const cat = questionCatalogue();
  const pick = (re: RegExp) => cat.filter(c => re.test(c.group)).flatMap(c => c.examples).slice(0, 2);
  const examples = [...pick(/attendance/i), ...pick(/leave/i), ...pick(/bill|invoice/i), ...pick(/guide|app/i)].filter(Boolean).slice(0, 8);
  const md = [
    '**What I can do**',
    '',
    '- **Answer data questions** about attendance, leave, billing and invoices, tickets, sites and people (only what your role allows).',
    '- **Apply leave for you**: say "apply leave tomorrow" and I will prepare it for your confirmation.',
    '- **Guide you around the app**: ask "where is the invoice option" or "how do I add a new employee", and I will show the steps with an Open page button.',
    '',
    ...(examples.length ? ['**Try asking**', ...examples.map(e => `- ${e}`)] : []),
  ].join('\n');
  return { kind: 'answer', facts: { guide: 'help' }, sourceLabel: 'App guide · What I can do', markdown: md, actions: [{ label: 'Open FAQ & SOPs', route: '/assist/faq' }] };
};

export const guideTools: AssistTool[] = [{
  name: 'get_app_guide',
  description: 'Short step-by-step guide for using THIS app: "how do I apply leave in the app", "where is the invoice option", "how to add a new employee", "where can I see my attendance", "how to download attendance report", "how to change my profile photo", "what can you do". Returns steps and an Open page button. Not for data questions (balances, values, who is on leave).',
  parameters: { type: 'object', properties: {
    topic: { type: 'string', description: 'What the user wants to do or find in the app, in their words.' },
    guide_id: { type: 'string', description: 'Internal: exact guide id (set by clarification chips).' },
  } },
  capability: null,
  module: 'App guide',
  async run(ctx, args) {
    const topic = String(args.topic ?? ctx.question ?? '');
    if (args.guide_id === 'help' || (!args.guide_id && /\b(what can you do|what do you do|help me|^help$|how can you help|your features|capabilities)\b/i.test(topic.trim()))) return helpEntry();
    let g: GuideEntry | undefined;
    if (args.guide_id) g = GUIDE_BY_ID.get(String(args.guide_id));
    if (!g) {
      const ms = matchGuides(topic);
      if (!ms.length) return { kind: 'not_found', text: 'I could not find that in the app guide. Try the menu search box, or ask me in different words, for example "where is the invoice option".' };
      const top = ms[0].score;
      const close = ms.filter(m => m.score >= top - 0.0005).slice(0, 5);
      // distinct pages only (same route twice, e.g. punch + view attendance, still needs a choice because the steps differ)
      if (close.length > 1) {
        return { kind: 'clarify', question: 'Which of these do you mean?', options: close.map(m => ({ label: m.entry.title, sublabel: m.entry.menuPath.join(' › '), args: { guide_id: m.entry.id, topic } })) };
      }
      g = ms[0].entry;
    }
    const access = await accessFor(ctx.sb, ctx.asker.role_id);
    if (g.requiredPermission && !access.can(g.requiredPermission)) return renderNoAccess(ctx, g, access);
    return renderGuide(g, access, topic);
  },
}];

export const GUIDE_COUNT = GUIDE_CATALOGUE.length;
