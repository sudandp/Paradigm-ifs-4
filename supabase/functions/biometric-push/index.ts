// supabase/functions/biometric-push/index.ts
/// <reference lib="deno.ns" />
import { createClient, SupabaseClient } from 'supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * eSSL Biometric Push Protocol Handler
 * 
 * Flow:
 * 1. Device sends GET /?SN=...&table=... (Handshake/Keep-alive)
 *    Response: OK
 * 2. Device sends POST /?SN=...&table=ATTLOG (Logs)
 *    Response: OK: [count]
 * 3. Device sends POST /?SN=...&table=USER (User data)
 *    Response: OK: [count]
 */

interface BiometricDeviceWithOrg {
  id: string;
  organization_id: string;
  location_name: string | null;
  organizations: {
    full_name: string | null;
    short_name: string | null;
  } | null;
}

// @ts-ignore: Deno is a global in Supabase Edge Functions
Deno.serve(async (req: Request) => {
  const { method, url } = req;

  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const query = urlObj.searchParams;

  // eSSL sends SN in query params, sometimes SN, sometimes sn
  const rawSn = query.get('SN') || query.get('sn');
  const sn = rawSn?.toLowerCase(); // Standardize to lowercase for DB lookups
  const table = query.get('table');

  console.log(`[${new Date().toISOString()}] [${method}] ${path} | SN: ${sn} | Table: ${table}`);

  // Initialize Supabase Admin
  const supabaseAdmin = createClient(
    // @ts-ignore: Deno environment
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore: Deno environment
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Handshake / Heartbeat (GET)
  if (method === 'GET') {
    if (sn) {
      console.log(`Processing handshake for SN: ${sn}`);
      try {
        const { error } = await supabaseAdmin
          .from('biometric_devices')
          .update({ last_seen: new Date().toISOString(), status: 'online' })
          .ilike('sn', sn); // Case-insensitive update
        
        if (error) console.error('DB Handshake Update Error:', error);
      } catch (e) {
        console.error('Handshake status update failed:', e);
      }
      
      // eSSL ADMS protocol expects plain text OK for handshake
      return new Response('OK', { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }
    
    // Default reply if SN is missing or service check
    return new Response('BIOMETRIC_PUSH_SERVICE_ALIVE', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }

  // 2. Data Push (POST)
  if (method === 'POST') {
    if (!sn) {
      return new Response('BadRequest: No SN', { status: 400, headers: corsHeaders });
    }

    const payloadBuffer = await req.arrayBuffer();
    const payload = new TextDecoder().decode(payloadBuffer);

    console.log(`Received ${table} push from SN: ${sn}. Payload length: ${payload.length}`);

    // Fetch Device Info (used for location/org attribution)
    const { data: deviceRaw, error: deviceError } = await supabaseAdmin
      .from('biometric_devices')
      .select('id, organization_id, location_name, organizations:organization_id(full_name, short_name)')
      .ilike('sn', sn)
      .single();

    const device = deviceRaw as unknown as BiometricDeviceWithOrg;

    if (deviceError || !device) {
      console.error(`Unknown device SN: ${sn}. Error:`, deviceError);
      // We still return OK to prevent device from retrying indefinitely, 
      // but we should log this in production.
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // --- CASE A: Attendance Logs ---
    if (table === 'ATTLOG') {
      const logs = payload.split('\n').filter((l: string) => l.trim());
      let successCount = 0;
      const errors: { log: string; error: unknown }[] = [];

      for (const log of logs) {
        // eSSL ATTLOG Format (Tab-separated): 
        // [BiometricID]\t[Timestamp]\t[Status]\t[VerifyType]\t[DeviceID]\t[WorkCode]
        const parts = log.split('\t');
        if (parts.length < 2) continue;

        const biometricId = parts[0].trim();
        const timestamp = parts[1].trim(); // Format: YYYY-MM-DD HH:mm:ss
        const status = parts[2]?.trim();    // 0=CheckIn, 1=CheckOut (usually, but configurable)

        // Find associated user
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id, name, organization_id, reporting_manager_id, role_id')
          .eq('biometric_id', biometricId)
          .single();

        if (user) {
          const locationName = device.location_name || device.organizations?.full_name || 'Biometric Device';
          
          // Mapping: Status 1 is often check-in, 0 is check-out for some configurations
          // User requested: 1=CheckIn, 0=CheckOut
          const eventType = status === '1' ? 'punch-in' : 'punch-out';

          const { error: attError } = await supabaseAdmin
            .from('attendance_events')
            .insert({
              user_id: user.id,
              timestamp: timestamp,
              type: eventType,
              device_id: device.id,
              location_name: locationName
            });

          if (!attError) {
            successCount++;
            
            // Notification Logic (Async)
            edgeNotifySync(supabaseAdmin, user, eventType);
          } else {
            console.error('Attendance Insert Error:', attError);
            errors.push({ log, error: attError });
          }
        } else {
          console.warn(`User with Biometric ID ${biometricId} not found.`);
          errors.push({ log, error: 'User not found' });
        }
      }

      // Update last seen
      await supabaseAdmin.from('biometric_devices')
        .update({ last_seen: new Date().toISOString(), status: 'online' })
        .eq('id', device.id);

      return new Response(`OK: ${successCount}`, { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    // --- CASE B: User Enrollment Auto-Sync ---
    if (table === 'USER') {
      const lines = payload.split('\n').filter((l: string) => l.trim());
      let createdCount = 0;
      
      const rawSiteName = device.location_name || device.organizations?.short_name || 'site';
      const sanitizedSiteName = rawSiteName.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const line of lines) {
        const parts = line.split('\t');
        const biometricId = parts[0].trim();
        const name = parts[1]?.trim() || `User ${biometricId}`;
        
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('biometric_id', biometricId)
          .single();
        
        if (!existingUser) {
          console.log(`Auto-enrolling new device user: ${name} (ID: ${biometricId})`);
          
          const email = `${sanitizedSiteName}_${biometricId}@paradigm.com`;
          const password = Math.random().toString(36).slice(-12);

          const { data: authUser, error: _authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name }
          });

          if (authUser.user) {
            await supabaseAdmin.from('users').insert({
              id: authUser.user.id,
              name: name,
              email: email,
              role_id: 'field_staff',
              biometric_id: biometricId,
              organization_id: device.organization_id,
              organization_name: rawSiteName
            });
            createdCount++;
          }
        }
      }
      return new Response(`OK: ${createdCount}`, { status: 200, headers: corsHeaders });
    }

    // --- CASE C: User Pictures ---
    if (table === 'USERPIC') {
      const pin = query.get('PIN');
      if (pin) {
        const { data: user } = await supabaseAdmin.from('users').select('id').eq('biometric_id', pin).single();
        if (user) {
          const fileName = `${user.id}_face.jpg`;
          await supabaseAdmin.storage.from('avatars').upload(fileName, payloadBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
          const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
          await supabaseAdmin.from('users').update({ photo_url: publicUrl }).eq('id', user.id);
        }
      }
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Default catch-all for unknown tables
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  return new Response('NotFound', { status: 404, headers: corsHeaders });
});

/**
 * Robust notification helper for edge events
 */
async function edgeNotifySync(
  supabaseAdmin: SupabaseClient, 
  user: { id: string, name: string, reporting_manager_id?: string | null }, 
  eventType: string
) {
  try {
    const greeting = new Date().getHours() < 12 ? 'Good Morning' : (new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening');
    const actionText = eventType === 'punch-in' ? 'punched in' : 'punched out';
    
    // User Self Notification
    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      message: `${greeting}, ${user.name || 'there'}! Successfully recorded ${actionText} via biometric.`,
      type: 'greeting',
    });

    // Manager Notification
    if (user.reporting_manager_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: user.reporting_manager_id,
        message: `${user.name || 'An employee'} ${actionText} via biometric device.`,
        type: 'info'
      });
    }
  } catch (err) {
    console.error('Edge notification failed:', err);
  }
}
