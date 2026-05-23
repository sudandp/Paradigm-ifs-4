import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Manual env parsing
const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}\\s*=\\s*"?([^"\\n\\r]+)"?`))
  return match ? match[1].trim() : null
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  // 1. Get Uma user
  const { data: users, error: uError } = await supabase.from('users').select('*')
  if (uError) {
    console.error('Error fetching users:', uError)
    return;
  }
  
  const uma = users.find(u => {
    const name = u.name.toLowerCase();
    return name.startsWith('uma ') || name.includes(' uma ') || name === 'uma';
  })
  if (!uma) {
    console.log('Uma user not found!')
    return;
  }

  console.log('============================================================')
  console.log('UMA PROFILE:')
  console.log(JSON.stringify(uma, null, 2))
  console.log('============================================================')

  // 2. Fetch all attendance events for Uma on 2026-05-23
  const { data: events, error: eError } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', uma.id)
    .gte('timestamp', '2026-05-23T00:00:00')
    .lte('timestamp', '2026-05-23T23:59:59')
    .order('timestamp', { ascending: true })

  if (eError) {
    console.error('Error fetching attendance events:', eError)
  } else {
    console.log(`UMA ATTENDANCE EVENTS ON 2026-05-23 (${events.length} records):`)
    events.forEach((e, idx) => {
      console.log(`${idx + 1}. [${e.timestamp}] ID: ${e.id}, Type: ${e.type}, WorkType: ${e.work_type || e.workType}, Location: ${e.location_name || e.locationName} (Lat: ${e.latitude}, Lng: ${e.longitude})`)
    })
  }
  console.log('============================================================')

  // 3. Fetch tracking audit logs for Uma on 2026-05-23
  const { data: logs, error: lError } = await supabase
    .from('tracking_audit_logs')
    .select('*')
    .eq('target_user_id', uma.id)
    .gte('requested_at', '2026-05-23T00:00:00')
    .lte('requested_at', '2026-05-23T23:59:59')
    .order('requested_at', { ascending: true })

  if (lError) {
    console.error('Error fetching tracking audit logs:', lError)
  } else {
    console.log(`UMA TRACKING AUDIT LOGS FOR 2026-05-23 (${logs.length} records):`)
    logs.forEach((log, idx) => {
      console.log(`${idx + 1}. [${log.requested_at}] Status: ${log.status}, Admin: ${log.admin_user_id || log.adminId}`)
    })
  }
  console.log('============================================================')

  // 4. Fetch route history (GPS pings) for Uma on 2026-05-23
  const { data: routes, error: rError } = await supabase
    .from('route_history')
    .select('*')
    .eq('user_id', uma.id)
    .gte('timestamp', '2026-05-23T00:00:00')
    .lte('timestamp', '2026-05-23T23:59:59')
    .order('timestamp', { ascending: true })

  if (rError) {
    console.error('Error fetching route history:', rError)
  } else {
    console.log(`UMA GPS ROUTE HISTORY PINGS ON 2026-05-23 (${routes.length} points):`)
    routes.forEach((p, idx) => {
      if (idx < 5 || idx === routes.length - 1 || idx % 10 === 0) {
        console.log(`- [${p.timestamp}] Lat: ${p.latitude}, Lng: ${p.longitude}, Battery: ${p.battery_level || p.batteryLevel}, Source: ${p.source}, Device: ${p.device_name || p.deviceName}`)
      }
    })
  }
  console.log('============================================================')
}

run()
