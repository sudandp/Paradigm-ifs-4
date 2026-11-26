/** Fast-path rules for APP GUIDES ("how do I apply leave in the app", "where is the invoice option"). Owned by the GUIDE agent. Evaluated after LEAVE_APPLY_RULES, before general data rules. */
import type { Rule } from './rules.js';

export const GUIDE_RULES: Rule[] = [];
