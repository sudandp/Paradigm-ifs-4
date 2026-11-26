import { serviceClient } from '../../src/api/assist/devctx.js';
const sb = serviceClient();
const { data, error } = await sb.from('roles').select('*');
if (error) console.log(error);
for (const r of data ?? []) console.log(r.id, '|', r.display_name ?? r.name, '|', Array.isArray(r.permissions) ? r.permissions.length + ': ' + r.permissions.join(',') : r.permissions);
console.log(Object.keys(data?.[0] ?? {}));
const { data: u } = await sb.from('users').select('name,email,role_id').or('email.eq.veerabhadra@paradigmfms.com,name.ilike.%udita paul%,name.ilike.%kavya hegde%,name.ilike.%sudhan m%');
console.log(u);
