/**
 * Fast-path rules for APPLYING leave from chat + leave-policy explanations. Owned by the LEAVE agent.
 * Evaluated BEFORE the general rules and before the "how to / policy" filter, so they must stay strict:
 *  - "how do I apply leave (in the app)" / "where is apply leave" are APP GUIDE questions → not captured here.
 *  - data questions ("my leave balance", "my leave history", "who is on leave") → not captured here.
 */
import type { Rule, RuleCtx } from './rules.js';
import { parseLeaveType, parseDayOption } from '../tools/leave-apply.js';

const LEAVE_WORD = /\b(leave|half day|comp off|wfh|work from home|loss of pay|lop|day off|off day|holiday for me)\b/;
/** Navigation / how-to-use-the-app phrasing → the GUIDE agent's rules. */
const GUIDE_LIKE = /\b(how (do|can|should|to) (i |we )?(apply|request|submit|take)|steps (to|for)|procedure|process (to|for|of)|in the app|on the app|from the app|where (is|can|do)|which (page|menu|screen|button|option|tab)|click|navigate|screen|menu|option to)\b/;
/** Data questions (balances, history, lists, approvals) → general data rules. */
const DATA_LIKE = /\b(balance|remaining|left|available|history|how many|did .* take|taken|took|who|whom|which (staff|employees|people)|staff|employees|team|pending (my )?approval|approve|approval|status of)\b/;
const HINGLISH_APPLY = /\b(lena|leni|lene|chahiye|chahie|chaiye|chahta|chahti|dena|de do|karna|karni)\b/;

const POLICY = (n: string) =>
  /\bhow (is|are|do|does|will) .*\b(leave|comp off|blue|pink|lop|loss of pay)\b.*\b(calculated|allocated|accrued|accrue|earned|counted|credited|given|work|works|deducted|computed)\b/.test(n)
  || /\b(attendance|muster)\b.*\b(marked|shown|show|look|counted)\b.*\b(leave|holiday|weekly off|half day)\b/.test(n)
  || /\bhow (is|will) (my )?attendance\b.*\bleave\b/.test(n)
  || /\b(what is|what are|what s|explain|meaning of)\s+(a |an |the )?(earned leave|sick leave|comp off|blue leave|pink leave|loss of pay|lop|floating leave|child care leave|maternity leave|casual leave|half day leave)\b/.test(n)
  || /\b(leave|leave s) (rules|policy|policies|eligibility|entitlement)\b|\b(rules|policy) (for|of|on) (leave|earned leave|sick leave|comp off)\b/.test(n)
  || /\b(can|could|may) i (take|apply|get|avail)\b.*\b(during|in|on) (my )?probation\b/.test(n)
  || /\bprobation\b.*\bleave\b|\bleave\b.*\bprobation\b/.test(n)
  || /\bhow many days\b.*\b(notice|in advance|advance|before)\b/.test(n) && /\bleave\b/.test(n)
  || /\b(notice period|advance notice)\b.*\bleave\b|\bleave\b.*\b(notice period|advance notice)\b/.test(n)
  || /\b(carry forward|carried forward|carry over|lapse|lapses|expire|expires|expiry|encash)\b/.test(n) && /\b(leave|comp off)\b/.test(n)
  || /\bwho approves\b.*\bleave\b|\bleave approval (flow|process|workflow)\b/.test(n);

const APPLY_INTENT = (c: RuleCtx) => {
  const n = c.n;
  if (!LEAVE_WORD.test(n) && !/\b(sick|earned|casual|blue|pink)\b/.test(n)) return false;
  if (GUIDE_LIKE.test(n) || DATA_LIKE.test(n)) return false;
  if (/\b(cancel|withdraw)\b/.test(n)) return false;
  return /\b(apply|applying|want|wanna|need|take|taking|book|request|put|mark me|going on|i will be on|i ll be on|i am on|grant me)\b/.test(n)
    || HINGLISH_APPLY.test(n)
    || /^\s*(earned leave|sick leave|comp off|half day|leave)\s+(today|tomorrow|on|from|for)\b/.test(n);
};

/** Date words for the tool to parse (Hinglish "kal" is normalised to "yesterday" — in a leave request it means tomorrow). */
const datesText = (c: RuleCtx) => {
  let n = c.n;
  if (HINGLISH_APPLY.test(n) && /\byesterday\b/.test(n) && !/\bday before yesterday\b/.test(n)) n = n.replace(/\byesterday\b/, 'tomorrow');
  return n.trim();
};
const personFor = (c: RuleCtx) => (c.e.person && new RegExp(`\\b(for|on behalf of)\\s+${c.e.person.split(/\s+/)[0]}`, 'i').test(c.n) ? c.e.person : undefined);

export const LEAVE_APPLY_RULES: Rule[] = [
  {
    id: 'leave_withdraw', tool: 'withdraw_leave', group: 'Apply leave',
    when: c => /\b(cancel|withdraw|take back|revoke)\b/.test(c.n) && /\b(my|the|this)?\s*(leave|leave request|comp off|wfh)\b/.test(c.n) && !GUIDE_LIKE.test(c.n) && !/\b(policy|rules|can i)\b/.test(c.n),
    args: () => ({}),
    examples: ['cancel my leave request', 'withdraw my leave'],
  },
  {
    id: 'leave_policy', tool: 'explain_leave_policy', group: 'Leave policy',
    when: c => POLICY(c.n) && !/\b(my|his|her)\s+(leave )?balance\b/.test(c.n) && !GUIDE_LIKE.test(c.n.replace(/\bhow (is|are|do|does|will)\b/, '')),
    args: () => ({}),
    examples: ['how is earned leave calculated', 'how are leaves allocated', 'how is attendance marked when i am on leave', 'leave rules', 'what is blue leave', 'can i take leave during probation', 'how many days notice for leave', 'what is comp off'],
  },
  {
    id: 'leave_apply', tool: 'apply_leave', group: 'Apply leave',
    when: APPLY_INTENT,
    args: c => {
      const lt = parseLeaveType(c.n);
      return {
        leave_type: lt && lt !== 'casual' ? lt : lt === 'casual' ? 'casual' : undefined,
        dates_text: datesText(c),
        day_option: parseDayOption(c.n) ?? undefined,
        person_name: personFor(c),
      };
    },
    examples: ['apply leave', 'apply for leave tomorrow', 'i want sick leave from 2 dec to 4 dec', 'take half day leave today', 'apply comp off on friday', 'leave lena hai kal', 'i need earned leave on 3rd december'],
  },
];
