import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fmyafuhxlorbafbacywa.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ANKUR_ID = '944263d8-c7e4-42e1-b112-cdb3b1392b44';

async function deepAudit() {
  console.log('\n🔬 === DEEP AUDIT — ANKUR (944263d8) ===\n');

  // 1. Check leave_requests schema by getting one sample row
  const { data: sampleLeave } = await supabase.from('leave_requests').select('*').limit(1);
  if (sampleLeave && sampleLeave[0]) {
    console.log('📂 LEAVE_REQUESTS TABLE COLUMNS:');
    console.log('  ', Object.keys(sampleLeave[0]).join(', '));
  }

  // 2. Total leaves in system
  const { count: totalLeaves } = await supabase
    .from('leave_requests')
    .select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total leave records in DB: ${totalLeaves}`);

  // 3. Search leaves by Ankur's ID - try different column names
  const cols = ['user_id', 'userId', 'employee_id', 'employeeId'];
  for (const col of cols) {
    try {
      const { data, error, count } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact' })
        .eq(col, ANKUR_ID)
        .limit(5);
      if (!error) {
        console.log(`\n🔍 Leaves with ${col}='${ANKUR_ID}': ${count} records`);
        if (data && data.length > 0) {
          console.table(data.map(l => ({
            id: l.id?.substring(0,8),
            type: l.leave_type || l.leaveType,
            from: l.start_date || l.startDate,
            to: l.end_date || l.endDate,
            status: l.status,
            createdBy: l.created_by || l.createdBy,
          })));
        }
      }
    } catch(e) { /* column doesn't exist */ }
  }

  // 4. Search leaves by email
  const { data: leavesByName } = await supabase
    .from('leave_requests')
    .select('*')
    .ilike('employee_name', '%ankur%')
    .limit(10);
  console.log(`\n🔍 Leaves where employee_name LIKE 'ankur': ${leavesByName?.length || 0}`);
  if (leavesByName && leavesByName.length > 0) console.table(leavesByName);

  // 5. Check attendance_events schema
  const { data: sampleEvent } = await supabase.from('attendance_events').select('*').limit(1);
  if (sampleEvent && sampleEvent[0]) {
    console.log('\n📂 ATTENDANCE_EVENTS TABLE COLUMNS:');
    console.log('  ', Object.keys(sampleEvent[0]).join(', '));
  }

  // 6. Total attendance events in system
  const { count: totalEvents } = await supabase
    .from('attendance_events')
    .select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total attendance events in DB: ${totalEvents}`);

  // 7. Search attendance_events for Ankur - different column names
  for (const col of ['user_id', 'userId']) {
    try {
      const { data, error, count } = await supabase
        .from('attendance_events')
        .select('*', { count: 'exact' })
        .eq(col, ANKUR_ID)
        .limit(5);
      if (!error) {
        console.log(`\n🔍 Events with ${col}='${ANKUR_ID}': ${count} records`);
        if (data && data.length > 0) {
          console.table(data.map(e => ({
            date: e.timestamp?.substring(0,10),
            type: e.type,
            source: e.source,
          })));
        }
      }
    } catch(e) {}
  }

  // 8. Check ALL users named Ankur (maybe there are duplicates)
  const { data: allAnkurs } = await supabase
    .from('users')
    .select('id, name, role_id, email, created_at')
    .ilike('name', '%ankur%');
  console.log(`\n👥 ALL users named Ankur: ${allAnkurs?.length || 0}`);
  console.table(allAnkurs || []);

  // 9. Check if any leave records exist where created_at is in May 2026
  const { data: mayLeaves } = await supabase
    .from('leave_requests')
    .select('user_id, leave_type, start_date, end_date, status, created_by')
    .gte('start_date', '2026-05-01')
    .lte('start_date', '2026-05-31')
    .limit(20);
  console.log(`\n📅 ALL leaves with start_date in May 2026: ${mayLeaves?.length || 0}`);
  if (mayLeaves && mayLeaves.length > 0) {
    console.table(mayLeaves.map(l => ({
      userId: l.user_id?.substring(0,8),
      type: l.leave_type,
      from: l.start_date,
      to: l.end_date,
      status: l.status,
      createdBy: l.created_by?.substring(0,8),
    })));
  }

  // 10. Check audit logs for any manual entries for Ankur
  try {
    const { data: auditLogs } = await supabase
      .from('attendance_audit_logs')
      .select('*')
      .or(`target_user_id.eq.${ANKUR_ID},performed_by.eq.${ANKUR_ID}`)
      .limit(20);
    console.log(`\n📝 AUDIT LOGS for Ankur: ${auditLogs?.length || 0}`);
    if (auditLogs && auditLogs.length > 0) console.table(auditLogs);
  } catch(e) { console.log('audit_logs table error:', e.message); }

  console.log('\n✅ DEEP AUDIT COMPLETE\n');
}

deepAudit().catch(console.error);
