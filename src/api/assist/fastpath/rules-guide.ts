/**
 * Fast-path rules for APP GUIDES ("how do I apply leave in the app", "where is the invoice option").
 * Owned by the GUIDE agent. Evaluated after LEAVE_APPLY_RULES, before the general data rules and the how-to filter.
 * Strict on purpose: a guide fires only when the question has navigation / how-to phrasing AND the topic matches the
 * app-guide catalogue. Non-app how-tos ("how to do lift rescue") and data questions fall through.
 */
import type { Rule, RuleCtx } from './rules.js';
import { matchGuides } from '../guide/catalogue.js';

const HOWTO = /^(?:please |pls |hey |hi |ok |can you |could you |tell me |show me |guide me )*(?:how (?:do|can|should|would|to|does)\b|how i\b|where (?:is|are|can|do|will|to|should)\b|steps (?:to|for)\b|way to\b|navigate to\b|take me to\b|go to\b|which (?:page|menu|option)\b|show me (?:the |my |where |how )?|guide (?:for|to)\b)/;
const SHOW_PAGE = /^(?:show|open|take) (?:me )?(?:the |my )?(.+?) (?:page|option|menu|section|screen|tab)\b/;
const HELP = /^(?:help|help me|what can you do|what all can you do|what do you do|how can you help(?: me)?|what are your features|your features)$/;
const TIMEY = /\b(today|yesterday|tomorrow|now|currently|right now|last night)\b/;
const DATA_WORDS = /\b(how (?:many|much|long|often|old)|who|whom|whose|balance of|value|amount of|total)\b/;

const topicOf = (n: string) => n.trim();
const isGuide = (c: RuleCtx): boolean => {
  const n = c.n.trim();
  if (HELP.test(n)) return true;
  if (DATA_WORDS.test(n)) return false;
  const show = SHOW_PAGE.exec(n);
  if (!HOWTO.test(n) && !show) return false;
  // "show me my attendance" is data; only "... page/option/menu" counts (SHOW_PAGE). Plain "show me" without it is not a guide.
  if (/^(?:please |pls )?show me\b/.test(n) && !show) return false;
  // "where is isaac yesterday": a person's whereabouts (time word + where is/are)
  if (/^where (?:is|are)\b/.test(n) && TIMEY.test(n)) return false;
  if (c.e.person && !c.e.self && /^where (?:is|are)\b/.test(n)) return false;
  return matchGuides(topicOf(n)).length > 0;
};

export const GUIDE_RULES: Rule[] = [
  {
    id: 'app_guide_help', tool: 'get_app_guide', group: 'App guide',
    when: c => HELP.test(c.n.trim()),
    args: () => ({ guide_id: 'help' }),
    examples: ['help', 'what can you do', 'what all can you do'],
  },
  {
    id: 'app_guide', tool: 'get_app_guide', group: 'App guide',
    when: isGuide,
    args: c => ({ topic: topicOf(c.n) }),
    examples: [
      'how to apply leave from the app', 'where to find the invoice option', 'how do i add a new employee',
      'where can i see my attendance', 'how to download attendance report', 'how to approve leave',
      'where is site finance tracker', 'how to raise a helpdesk ticket', 'how to change my profile photo',
      'how to select optional holidays', 'where is the leave management page', 'how do i punch in',
      'how to add a biometric device', 'where is the cctv dashboard', 'how to deboard an employee', 'where is inventory',
    ],
  },
];
