/**
 * Gate Attendance API Service
 * Handles all Supabase operations for the gate attendance module.
 */

import { supabase } from './supabase';
import type { GateUser, GateAttendanceLog, GateAttendanceMethod } from '../types/gate';
import { offlineDb } from './offline/database';

export function normalizeFaceDescriptor(desc: any): number[] | null {
  if (!desc) return null;
  if (typeof desc === 'string') {
    try {
      const parsed = JSON.parse(desc);
      if (Array.isArray(parsed) && parsed.length === 128) return parsed;
    } catch (e) {
      return null;
    }
  }
  if (Array.isArray(desc) && desc.length === 128) return desc;
  return null;
}

// ─── Helper: generate a unique QR token ────────────────────────────────────────
function generateQrToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = 'PG-';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generatePasscode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ─── Gate Users ────────────────────────────────────────────────────────────────


export async function fetchGateUsers(): Promise<GateUser[]> {
  const { data, error } = await supabase
    .from('gate_users')
    .select(`
      id, user_id, qr_token, passcode, photo_url,
      department, is_active, created_at, updated_at,
      users:user_id (name, email, photo_url)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.users?.name || 'Unknown',
    userEmail: row.users?.email || '',
    userPhotoUrl: row.users?.photo_url || row.photo_url,
    qrToken: row.qr_token,
    passcode: row.passcode,
    photoUrl: row.photo_url,
    department: row.department,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function fetchAllGateUsers(): Promise<GateUser[]> {
  const { data, error } = await supabase
    .from('gate_users')
    .select(`
      id, user_id, qr_token, passcode, photo_url,
      department, is_active, created_at, updated_at,
      users:user_id (name, email, photo_url)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.users?.name || 'Unknown',
    userEmail: row.users?.email || '',
    userPhotoUrl: row.users?.photo_url || row.photo_url,
    qrToken: row.qr_token,
    passcode: row.passcode,
    photoUrl: row.photo_url,
    department: row.department,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getGateUserByUserId(userId: string): Promise<GateUser | null> {
  const cacheKey = `gate_user_${userId}`;
  
  try {
    const { data, error } = await supabase
      .from('gate_users')
      .select(`
        id, user_id, face_descriptor, face_version, qr_token, passcode, photo_url,
        department, is_active, created_at, updated_at,
        users:user_id (name, email, photo_url)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw error; // Fall down to catch block
    }
    
    if (!data || data.length === 0) return null;
    const rowData = data[0];

    const gateUser: GateUser = {
      id: rowData.id,
      userId: rowData.user_id,
      userName: (rowData as any).users?.name || 'Unknown',
      userEmail: (rowData as any).users?.email || '',
      userPhotoUrl: (rowData as any).users?.photo_url || rowData.photo_url,
      qrToken: rowData.qr_token,
      passcode: rowData.passcode,
      photoUrl: rowData.photo_url,
      faceDescriptor: normalizeFaceDescriptor(rowData.face_descriptor),
      faceVersion: rowData.face_version,
      department: rowData.department,
      isActive: rowData.is_active,
      createdAt: rowData.created_at,
      updatedAt: rowData.updated_at,
    };
    
    // Cache for offline use
    offlineDb.setCache(cacheKey, gateUser).catch(e => console.warn('[gateApi] Failed to cache gate user', e));
    return gateUser;
  } catch (err) {
    console.warn('[gateApi] Failed to fetch gate user from Supabase, attempting offline cache...', err);
    try {
      const cached = await offlineDb.getCache(cacheKey);
      if (cached) {
         return cached as GateUser;
      }
    } catch (cacheErr) {
      console.warn('[gateApi] No cached gate user found', cacheErr);
    }
    return null;
  }
}

export async function registerGateUser(params: {
  userId: string;
  faceDescriptor?: number[];
  photoUrl?: string;
  department?: string;
}): Promise<GateUser> {
  // ─── Phase 3 & 11: Transactional Enrollment with Lock ───
  try {
    // Attempt to use the hardened RPC if the migration has been applied
    const { data: rpcData, error: rpcError } = await supabase.rpc('enroll_gate_user', {
      p_user_id: params.userId,
      p_face_descriptor: params.faceDescriptor || null,
      p_photo_url: params.photoUrl || null,
      p_department: params.department || null,
    });

    if (!rpcError && rpcData) {
      // Fetch the users joined data as the RPC only returns gate_users fields
      const { data: joinedData } = await supabase
        .from('gate_users')
        .select(`*, users:user_id (name, email, photo_url)`)
        .eq('id', rpcData.id)
        .single();
        
      if (joinedData) {
        const newUser: GateUser = {
          id: joinedData.id,
          userId: joinedData.user_id,
          userName: joinedData.users?.name || 'Unknown',
          userEmail: joinedData.users?.email || '',
          userPhotoUrl: joinedData.users?.photo_url || joinedData.photo_url,
          qrToken: joinedData.qr_token,
          passcode: joinedData.passcode,
          photoUrl: joinedData.photo_url,
          department: joinedData.department,
          isActive: joinedData.is_active,
          createdAt: joinedData.created_at,
          updatedAt: joinedData.updated_at,
        };

        const cacheKey = `gate_user_${params.userId}`;
        offlineDb.setCache(cacheKey, newUser).catch(e =>
          console.warn('[gateApi] Failed to prime offline cache for new gate user via RPC', e)
        );

        return newUser;
      }
    }
  } catch (err) {
    console.warn('[gateApi] Hardened RPC not found or failed, falling back to client-side cleanup', err);
  }

  // ─── Client-side Smart Register & Cleanup Fallback ───
  // Fetch ALL rows for this user to handle duplicates and cleanup
  const { data: existingRows, error: fetchError } = await supabase
    .from('gate_users')
    .select('id, qr_token, passcode, is_active')
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false });

  if (fetchError) throw new Error(fetchError.message);

  if (existingRows && existingRows.length > 0) {
    const latest = existingRows[0];

    // Deactivate all OTHER rows (old templates)
    if (existingRows.length > 1) {
      const otherIds = existingRows.slice(1).map(r => r.id);
      await supabase
        .from('gate_users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', otherIds);
      console.log(`[gateApi] Deactivated ${otherIds.length} old face embeddings for user ${params.userId}`);
    }

    // Re-enrollment: update the latest row and ensure it's active
    const updatePayload: any = {
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    // Only update photo if a new one was captured
    if (params.photoUrl) updatePayload.photo_url = params.photoUrl;
    if (params.department) updatePayload.department = params.department;

    const { data, error } = await supabase
      .from('gate_users')
      .update(updatePayload)
      .eq('id', latest.id)
      .select(`
        *,
        users:user_id (name, email, photo_url)
      `)
      .single();

    if (error) throw new Error(error.message);

    const updatedUser: GateUser = {
      id: data.id,
      userId: data.user_id,
      userName: data.users?.name || 'Unknown',
      userEmail: data.users?.email || '',
      userPhotoUrl: data.users?.photo_url || data.photo_url,
      qrToken: data.qr_token,
      passcode: data.passcode,
      photoUrl: data.photo_url,
      department: data.department,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    const cacheKey = `gate_user_${params.userId}`;
    offlineDb.setCache(cacheKey, updatedUser).catch(e =>
      console.warn('[gateApi] Failed to update offline cache after re-enrollment', e)
    );

    return updatedUser;
  }

  // New registration: generate fresh tokens
  const qrToken = generateQrToken();
  const passcode = generatePasscode();

  const { data, error } = await supabase
    .from('gate_users')
    .insert({
      user_id: params.userId,
      qr_token: qrToken,
      passcode: passcode,
      photo_url: params.photoUrl || null,
      department: params.department || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select(`
      *,
      users:user_id (name, email, photo_url)
    `)
    .single();

  if (error) throw new Error(error.message);

  const newUser: GateUser = {
    id: data.id,
    userId: data.user_id,
    userName: data.users?.name || 'Unknown',
    userEmail: data.users?.email || '',
    userPhotoUrl: data.users?.photo_url || data.photo_url,
    qrToken: data.qr_token,
    passcode: data.passcode,
    photoUrl: data.photo_url,
    department: data.department,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  const cacheKey = `gate_user_${params.userId}`;
  offlineDb.setCache(cacheKey, newUser).catch(e =>
    console.warn('[gateApi] Failed to prime offline cache for new gate user', e)
  );

  return newUser;
}


export async function deleteGateUser(gateUserId: string, userId: string): Promise<void> {
  console.log(`[gateApi] Attempting to delete gate_user: ${gateUserId} (Internal User ID: ${userId})`);
  
  // Try hard delete first
  const { error: deleteError } = await supabase
    .from('gate_users')
    .delete()
    .eq('id', gateUserId);

  if (deleteError) {
    console.warn('[gateApi] Hard delete failed, falling back to soft delete:', deleteError.message);
    
    // If hard delete fails (e.g. foreign key violation with logs), fallback to soft delete
    const { error: updateError } = await supabase
      .from('gate_users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', gateUserId);

    if (updateError) {
      console.error('[gateApi] Soft delete ALSO failed:', updateError.message);
      throw new Error(`Deletion failed: ${updateError.message}`);
    }
  }
  
  console.log('[gateApi] Successfully removed/deactivated user');
  
  // Clear offline cache for this user
  await offlineDb.deleteOldDescriptors(userId);
}

export async function resetGateUserInfo(userId: string): Promise<void> {
  const { error } = await supabase
    .from('gate_users')
    .update({ 
      photo_url: null,
      updated_at: new Date().toISOString() 
    })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

// ─── Gate Attendance Logs ──────────────────────────────────────────────────────

export async function markGateAttendance(params: {
  userId: string;
  gateUserId?: string;
  method: GateAttendanceMethod;
  action?: string;
  confidence?: number;
  imageProofUrl?: string;
  notes?: string;
  deviceName?: string;
}): Promise<GateAttendanceLog> {
  // TODO: Re-enable time restriction in production
  // Duplicate check — has this employee checked in in the last 5 min?
  /*
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: recent, error: recentError } = await supabase
    .from('gate_attendance_logs')
    .select('id')
    .eq('user_id', params.userId)
    .gte('marked_at', fiveMinAgo)
    .limit(1);
    
  if (recent && recent.length > 0) {
    throw new Error('Duplicate attendance mark. User checked in within the last 5 minutes.');
  }
  */

  const { data, error } = await supabase
    .from('gate_attendance_logs')
    .insert({
      user_id: params.userId,
      gate_user_id: params.gateUserId || null,
      method: params.method,
      confidence: params.confidence || null,
      image_proof_url: params.imageProofUrl || null,
      notes: params.notes || null,
      device_info: {
        userAgent: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        deviceName: params.deviceName || 'Web Browser',
        action: params.action || null,
      },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    userId: data.user_id,
    gateUserId: data.gate_user_id,
    method: data.method,
    confidence: data.confidence,
    imageProofUrl: data.image_proof_url,
    markedAt: data.marked_at,
    deviceInfo: data.device_info,
    location: data.location,
    notes: data.notes,
    createdAt: data.created_at,
  };
}

export async function fetchGateAttendanceLogs(params?: {
  date?: string; // YYYY-MM-DD
  userId?: string;
  method?: GateAttendanceMethod;
  limit?: number;
}): Promise<GateAttendanceLog[]> {
  let query = supabase
    .from('gate_attendance_logs')
    .select(`
      id, user_id, gate_user_id, method, confidence,
      image_proof_url, marked_at, device_info, location, notes, created_at,
      users:user_id (name, photo_url),
      gate_users:gate_user_id (department)
    `)
    .order('marked_at', { ascending: false });

  if (params?.date) {
    const start = `${params.date}T00:00:00.000Z`;
    const end = `${params.date}T23:59:59.999Z`;
    query = query.gte('marked_at', start).lte('marked_at', end);
  }

  if (params?.userId) {
    query = query.eq('user_id', params.userId);
  }

  if (params?.method) {
    query = query.eq('method', params.method);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  } else {
    query = query.limit(200);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    gateUserId: row.gate_user_id,
    userName: row.users?.name || 'Unknown',
    userPhotoUrl: row.users?.photo_url || '',
    department: row.gate_users?.department || '',
    method: row.method,
    confidence: row.confidence,
    imageProofUrl: row.image_proof_url,
    markedAt: row.marked_at,
    deviceInfo: row.device_info,
    location: row.location,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

// ─── Photo Upload ──────────────────────────────────────────────────────────────

export async function uploadGatePhoto(
  base64Data: string,
  folder: 'registration' | 'proof',
  fileName?: string
): Promise<string> {
  const finalName = fileName || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const filePath = `gate-captures/${folder}/${finalName}`;

  // Convert base64 to Uint8Array
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from('gate-captures')
    .upload(filePath, uint8Array, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('gate-captures')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ─── Lookup by QR Token ────────────────────────────────────────────────────────

export async function lookupByQrToken(token: string): Promise<GateUser | null> {
  const { data, error } = await supabase
    .from('gate_users')
    .select(`
      id, user_id, face_descriptor, face_version, qr_token, passcode, photo_url,
      department, is_active, created_at, updated_at,
      users:user_id (name, email, photo_url)
    `)
    .eq('qr_token', token)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    userName: (data as any).users?.name || 'Unknown',
    userEmail: (data as any).users?.email || '',
    userPhotoUrl: (data as any).users?.photo_url || data.photo_url,
    qrToken: data.qr_token,
    passcode: data.passcode,
    photoUrl: data.photo_url,
    faceDescriptor: normalizeFaceDescriptor(data.face_descriptor),
    faceVersion: data.face_version,
    department: data.department,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ─── Lookup by Passcode ────────────────────────────────────────────────────────

export async function lookupByPasscode(passcode: string): Promise<GateUser | null> {
  const { data, error } = await supabase
    .from('gate_users')
    .select(`
      id, user_id, face_descriptor, face_version, qr_token, passcode, photo_url,
      department, is_active, created_at, updated_at,
      users:user_id (name, email, photo_url)
    `)
    .eq('passcode', passcode)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    userName: (data as any).users?.name || 'Unknown',
    userEmail: (data as any).users?.email || '',
    userPhotoUrl: (data as any).users?.photo_url || data.photo_url,
    qrToken: data.qr_token,
    passcode: data.passcode,
    photoUrl: data.photo_url,
    faceDescriptor: normalizeFaceDescriptor(data.face_descriptor),
    faceVersion: data.face_version,
    department: data.department,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ─── Kiosk Devices Management ──────────────────────────────────────────────────

export interface KioskDevice {
  id: string;
  deviceId: string;
  locationId: string;
  locationName?: string;
  deviceName: string;
  deviceModel: string;
  ipAddress: string | null;
  batteryPercentage: number | null;
  signalStrength: string | null;
  isActive: boolean;
  lastHeartbeat: string;
  userId: string | null;
  userEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchKioskDevices(): Promise<KioskDevice[]> {
  const { data, error } = await supabase
    .from('kiosk_devices')
    .select(`
      id, device_id, location_id, device_name, device_model, ip_address,
      battery_percentage, signal_strength, is_active, last_heartbeat, user_id, created_at, updated_at,
      locations:location_id (name),
      users:user_id (email)
    `)
    .order('device_name', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    deviceId: row.device_id,
    locationId: row.location_id,
    locationName: row.locations?.name || 'Unassigned',
    deviceName: row.device_name || row.device_id,
    deviceModel: row.device_model || 'Unknown',
    ipAddress: row.ip_address,
    batteryPercentage: row.battery_percentage,
    signalStrength: row.signal_strength,
    isActive: row.is_active,
    lastHeartbeat: row.last_heartbeat,
    userId: row.user_id,
    userEmail: row.users?.email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function registerKioskDevice(
  params: {
    locationId: string;
    deviceName: string;
    deviceModel?: string;
  }
): Promise<KioskDevice> {
  const { data, error } = await supabase
    .from('kiosk_devices')
    .insert({
      location_id: params.locationId,
      device_name: params.deviceName,
      device_model: params.deviceModel || 'Samsung M07',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    deviceId: data.device_id,
    locationId: data.location_id,
    deviceName: data.device_name,
    deviceModel: data.device_model,
    ipAddress: data.ip_address,
    batteryPercentage: data.battery_percentage,
    signalStrength: data.signal_strength,
    isActive: data.is_active,
    lastHeartbeat: data.last_heartbeat,
    userId: data.user_id || null,
    userEmail: null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateKioskDevice(
  id: string,
  updates: {
    locationId?: string;
    deviceName?: string;
    userId?: string;
  }
): Promise<void> {
  const payload: any = {};
  if (updates.locationId !== undefined) payload.location_id = updates.locationId;
  if (updates.deviceName !== undefined) payload.device_name = updates.deviceName;
  if (updates.userId !== undefined) payload.user_id = updates.userId;
  
  const { error } = await supabase
    .from('kiosk_devices')
    .update(payload)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteKioskDevice(id: string): Promise<void> {
  const { error } = await supabase
    .from('kiosk_devices')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Assign a location to a kiosk device.
 * If the device doesn't have a linked user account yet, one is auto-created
 * with role='kiosk' and email kiosk-{name}@paradigm.local.
 */
export async function assignKioskDevice(
  kioskId: string,
  deviceName: string,
  locationId: string,
  existingUserId: string | null
): Promise<{ userId: string }> {
  // Lazy import to avoid circular dependency
  const { api } = await import('./api');

  let userId = existingUserId;

  if (!userId) {
    // Generate a sanitized email from device name
    const sanitized = deviceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      || 'kiosk-device';
    const email = `kiosk-${sanitized}@paradigm.local`;
    const password = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    try {
      const newUser = await api.createAuthUser({
        name: deviceName,
        email,
        password,
        role: 'kiosk',
      });
      userId = newUser.id;
    } catch (err: any) {
      // If user already exists with this email, look it up
      if (err?.message?.includes('already registered') || err?.message?.includes('already been registered')) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (existing) {
          userId = existing.id;
        } else {
          throw new Error(`Failed to create kiosk user account: ${err.message}`);
        }
      } else {
        throw err;
      }
    }
  }

  // Update the kiosk device with location + user link
  await updateKioskDevice(kioskId, {
    locationId,
    deviceName,
    userId: userId!,
  });

  return { userId: userId! };
}

export async function reportKioskHeartbeat(
  deviceId: string,
  telemetry: {
    batteryPercentage: number | null;
    ipAddress: string | null;
    signalStrength: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('kiosk_devices')
    .update({
      battery_percentage: telemetry.batteryPercentage,
      ip_address: telemetry.ipAddress,
      signal_strength: telemetry.signalStrength,
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('device_id', deviceId);

  if (error) {
    console.warn('[gateApi] Failed to report kiosk heartbeat:', error.message);
  }
}

export async function fetchKioskLocations(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as { id: string; name: string }[];
}

// ─── Security Audit Logging ───────────────────────────────────────────────────

export async function reportSecurityLog(params: {
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  details?: any;
  origin?: string;
  userId?: string;
  userEmail?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.from('security_audit_logs').insert({
      event_type: params.eventType,
      severity: params.severity,
      details: params.details,
      origin: params.origin || 'gate-kiosk',
      user_id: params.userId,
      user_email: params.userEmail,
      user_agent: navigator.userAgent,
    });
    
    if (error) {
      console.warn('[gateApi] Failed to insert security audit log:', error.message);
    }
  } catch (err) {
    console.error('[gateApi] Critical error reporting security log:', err);
  }
}

// ─── Gate-Only User Registration ──────────────────────────────────────────────
// Creates a new user directly in public.users with role 'gate_only'.
// No Supabase Auth account is created — user cannot log into the app.
// They are auto-enrolled for gate access (QR + Passcode).

export async function createGateOnlyUser(params: {
  name: string;
  phone?: string;
  department?: string;
  photoUrl: string;
  roleId?: string;
  locationId?: string;
  societyId?: string;
  organizationId?: string;
}): Promise<GateUser> {
  // 1. Generate a clean synthetic email based on name (requested format: name@paradigmfms.com)
  const cleanName = params.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Adding a small random suffix to prevent collisions with same names
  const email = `${cleanName}${Math.floor(Math.random() * 1000)}@paradigmfms.com`;

  // 2. Insert directly into public.users (bypasses Auth entirely)
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert({
      id: crypto.randomUUID(),
      name: params.name,
      email: email,
      phone: params.phone || null,
      role_id: params.roleId || 'gate_only',
      photo_url: params.photoUrl,
      location_id: params.locationId || null,
      society_id: params.societyId || null,
      organization_id: params.organizationId || null,
    })
    .select('id, name, email, photo_url')
    .single();

  if (userError) {
    console.error('[gateApi] Failed to create gate-only user:', userError);
    throw new Error(`Failed to create user: ${userError.message}`);
  }

  console.log('[gateApi] Created gate-only user:', newUser.id, newUser.name);

  // 3. Auto-enroll for gate access (generates QR token + passcode)
  const gateUser = await registerGateUser({
    userId: newUser.id,
    photoUrl: params.photoUrl,
    department: params.department || 'General',
  });

  return gateUser;
}
