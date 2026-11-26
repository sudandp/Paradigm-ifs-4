import { serviceClient } from '../src/api/assist/devctx.js';
const sb = serviceClient();
const h = await sb.from('holidays').select('*').limit(2); console.log(h.error?.message, h.data);
const s = await sb.from('settings').select('approval_workflow_settings').eq('id', 'singleton').maybeSingle(); console.log(s.data);
const u = await sb.from('users').select('id, name, role_id, gender, joining_date, reporting_manager_id, weekly_off_days').ilike('email', 'veerabhadra@paradigmfms.com'); console.log(u.data);
