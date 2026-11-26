import type { AssistTool } from '../types.js';
import { attendanceTools } from './attendance.js';
import { hrTools } from './hr.js';
import { opsTools } from './ops.js';
import { financeTools } from './finance.js';
import { leaveApplyTools } from './leave-apply.js';
import { guideTools } from './guide.js';

/**
 * SAFETY SWITCH: tools that WRITE to the database (apply / withdraw leave) are off unless
 * ASSIST_ENABLE_LEAVE_APPLY=1 is set on the server. Turn it on only after the dry-run tests pass
 * and the owner has reviewed a preview → confirm run. Read-only tools are always on.
 */
const WRITE_TOOLS = new Set(['apply_leave', 'withdraw_leave']);
const writesEnabled = () => process.env.ASSIST_ENABLE_LEAVE_APPLY === '1' || process.env.ASSIST_LEAVE_DRY_RUN === '1';
const leaveTools = leaveApplyTools.filter(t => !WRITE_TOOLS.has(t.name) || writesEnabled());

export const ALL_TOOLS: AssistTool[] = [...leaveTools, ...guideTools, ...attendanceTools, ...hrTools, ...opsTools, ...financeTools];

const names = new Set<string>();
for (const t of ALL_TOOLS) {
  if (names.has(t.name)) throw new Error(`[Assist] duplicate tool name: ${t.name}`);
  names.add(t.name);
}
export const toolByName = (name: string) => ALL_TOOLS.find(t => t.name === name);
