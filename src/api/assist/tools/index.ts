import type { AssistTool } from '../types.js';
import { attendanceTools } from './attendance.js';
import { hrTools } from './hr.js';
import { opsTools } from './ops.js';
import { financeTools } from './finance.js';
import { leaveApplyTools } from './leave-apply.js';
import { guideTools } from './guide.js';

export const ALL_TOOLS: AssistTool[] = [...leaveApplyTools, ...guideTools, ...attendanceTools, ...hrTools, ...opsTools, ...financeTools];

const names = new Set<string>();
for (const t of ALL_TOOLS) {
  if (names.has(t.name)) throw new Error(`[Assist] duplicate tool name: ${t.name}`);
  names.add(t.name);
}
export const toolByName = (name: string) => ALL_TOOLS.find(t => t.name === name);
