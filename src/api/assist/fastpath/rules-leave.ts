/** Fast-path rules for APPLYING leave from chat + leave-policy explanations. Owned by the LEAVE agent. Evaluated BEFORE the general rules and before the "how to / policy" filter. */
import type { Rule } from './rules.js';

export const LEAVE_APPLY_RULES: Rule[] = [];
