import { serviceClient } from '../src/api/assist/devctx.js';
const sb = serviceClient();
const { data } = await sb.from('leave_requests').select('*').order('created_at', { ascending: false }).limit(400);
const rows = data ?? [];
console.log('columns', Object.keys(rows[0] || {}));
const cnt = (k: string) => { const m: any = {}; rows.forEach((r: any) => { const v = JSON.stringify(r[k]); m[v] = (m[v] || 0) + 1; }); return m; };
console.log('leave_type', cnt('leave_type'));
console.log('day_option', cnt('day_option'));
console.log('status', cnt('status'));
const s = rows.find((r: any) => r.leave_type === 'Earned') || rows[0];
console.log('sample', JSON.stringify({ ...s, reason: '<redacted>' }, null, 1).slice(0, 1500));
const { data: nr } = await sb.from('notification_rules').select('event_type, recipient_role, recipient_user_id, is_enabled, send_alert, send_push').eq('event_type', 'leave_request');
console.log('notification_rules leave_request', nr);
const { data: st } = await sb.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle();
const as: any = (st as any)?.attendance_settings ?? {};
for (const k of ['office', 'field', 'site']) { const r = as[k] || {}; console.log(k, JSON.stringify(Object.fromEntries(Object.entries(r).filter(([kk]) => /leave|sick|earned|comp|float|maternity|weekly|permission|probation|holiday|notice|certificate|half|minimum_hours/.test(kk))))); }
console.log('top keys', Object.keys(as));
