/**
 * Rules-first fast path: recognise common Paradigm-data questions WITHOUT AI.
 * Returns the tool + args to run, or null (caller falls back to the AI planner).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalize, extractPeriod } from './text.js';
import { extractEntities } from './entities.js';
import { RULES, type Rule } from './rules.js';
import { LEAVE_APPLY_RULES } from './rules-leave.js';
import { GUIDE_RULES } from './rules-guide.js';

/** Checked before the general data rules and before the how-to filter. Leave-apply first, then guides. */
const PRIORITY_RULES: Rule[] = [...LEAVE_APPLY_RULES, ...GUIDE_RULES];

export interface FastMatch { ruleId: string; tool: string; args: Record<string, any>; debug: { normalized: string; person?: string; site?: string; self: boolean; period?: string } }

/** Not data questions (how-to / SOP / drafting / explanations) → leave to the knowledge base + AI. */
const NOT_DATA = /\b(how to|how do i|how can i|how should|procedure|steps to|sop|process (for|of|to)|explain|why|draft|write|compose|translate|meaning of|define|what is an?|policy for|rules for)\b/;

export async function matchFastPath(sb: SupabaseClient, question: string, now = new Date()): Promise<FastMatch | null> {
  if (!question || question.length > 220) return null;                 // long / multi-part questions → AI
  if (/[^\x00-\x7F₹’‘“”–—]/.test(question)) return null;                // Indic scripts etc. → AI
  const n = normalize(question);
  const p = extractPeriod(n, now);
  const forNames = p.text ? n.replace(p.text, ' ') : n;
  const e = await extractEntities(sb, forNames);
  const c = { n, e, p };
  const first = (rules: Rule[]) => { for (const r of rules) { try { if (r.when(c)) return r; } catch { /* ignore broken rule */ } } return undefined; };

  // 1) apply-leave + app-guide rules see EVERY question ("how do I apply leave" is a guide, not an SOP)
  let rule = first(PRIORITY_RULES);
  if (!rule) {
    // 2) data rules: skip how-to / SOP / drafting questions (those go to the knowledge base + AI)
    if (NOT_DATA.test(n) && !/\b(what is (my|the) (leave balance|weekly off|shift|grace time)|what is \w+ (leave balance|weekly off|shift))\b/.test(n)) return null;
    if ((n.match(/\band\b/g) ?? []).length >= 2) return null;          // "x and y and z" → AI
    rule = first(RULES);
  }
  if (!rule) return null;
  const args = Object.fromEntries(Object.entries(rule.args(c)).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)));
  return { ruleId: rule.id, tool: rule.tool, args, debug: { normalized: n.trim(), person: e.person, site: e.site, self: e.self, period: p.period } };
}

/** The supported-questions catalogue (for docs / UI suggestions). */
export function questionCatalogue() {
  const groups = new Map<string, { tool: string; examples: string[] }[]>();
  for (const r of [...PRIORITY_RULES, ...RULES]) {
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group)!.push({ tool: r.tool, examples: r.examples });
  }
  return [...groups.entries()].map(([group, items]) => ({ group, examples: items.flatMap(i => i.examples), tools: [...new Set(items.map(i => i.tool))] }));
}

export { RULES, PRIORITY_RULES };
