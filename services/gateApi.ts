/**
 * Gate Attendance API Service
 * Handles all Supabase operations for the gate attendance module.
 */

import { supabase } from './supabase';
import type { GateUser, GateAttendanceLog, GateAttendanceMethod } from '../types/gate';

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

// Normalize face_descriptor from JSONB — Supabase may return nested/non-array formats
function normalizeFaceDescriptor(raw: any): number[] | null {
  if (!raw) return null;
  // If it's already a flat array of numbers
  if (Array.isArray(raw) && raw.length === 128 && typeof raw[0] === 'number') return raw;
  // If Supabase wraps it in an object with numeric keys (JSONB edge case)
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const keys = Object.keys(raw);
    if (keys.length === 128) {
      const arr = keys.sort((a, b) => Number(a) - Number(b)).map(k => Number(raw[k]));
      if (arr.every(v => !isNaN(v))) return arr;
    }
  }
  // If it's a stringified JSON array
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 128) return parsed.map(Number);
    } catch { /* ignore */ }
  }
  // If it's an array but contains non-numbers, try to convert
  if (Array.isArray(raw) && raw.length === 128) {
    const arr = raw.map(Number);
    if (arr.every(v => !isNaN(v))) return arr;
  }
  return null;
}

export async function fetchGateUsers(): Promise<GateUser[]> {
  const { data, error } = await supabase
    .from('gate_users')
    .select(`
      id, user_id, face_descriptor, qr_token, passcode, photo_url,
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
    faceDescriptor: normalizeFaceDescriptor(row.face_descriptor),
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
      id, user_id, face_descriptor, qr_token, passcode, photo_url,
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
    faceDescriptor: normalizeFaceDescriptor(row.face_descriptor),
    qrToken: row.qr_token,
    passcode: row.passcode,
    photoUrl: row.photo_url,
    department: row.department,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function registerGateUser(params: {
  userId: string;
  faceDescriptor: number[] | null;
  photoUrl?: string;
  department?: string;
}): Promise<GateUser> {
  const qrToken = generateQrToken();
  const passcode = generatePasscode();

  const { data, error } = await supabase
    .from('gate_users')
    .upsert({
      user_id: params.userId,
      face_descriptor: params.faceDescriptor,
      qr_token: qrToken,
      passcode: passcode,
      photo_url: params.photoUrl || null,
      department: params.department || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select(`
      *,
      users:user_id (name, email, photo_url)
    `)
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    userId: data.user_id,
    userName: data.users?.name || 'Unknown',
    userEmail: data.users?.email || '',
    userPhotoUrl: data.users?.photo_url || data.photo_url,
    faceDescriptor: data.face_descriptor,
    qrToken: data.qr_token,
    passcode: data.passcode,
    photoUrl: data.photo_url,
    department: data.department,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateGateUserDescriptor(gateUserId: string, faceDescriptor: number[]): Promise<void> {
  const { error } = await supabase
    .from('gate_users')
    .update({ face_descriptor: faceDescriptor, updated_at: new Date().toISOString() })
    .eq('id', gateUserId);

  if (error) throw new Error(error.message);
}

export async function deleteGateUser(gateUserId: string): Promise<void> {
  // Try hard delete first
  const { error: deleteError } = await supabase
    .from('gate_users')
    .delete()
    .eq('id', gateUserId);

  if (deleteError) {
    // If hard delete fails (e.g. foreign key violation with logs), fallback to soft delete
    const { error: updateError } = await supabase
      .from('gate_users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', gateUserId);

    if (updateError) throw new Error(updateError.message);
  }
}

// ─── Gate Attendance Logs ──────────────────────────────────────────────────────

export async function markGateAttendance(params: {
  userId: string;
  gateUserId?: string;
  method: GateAttendanceMethod;
  confidence?: number;
  imageProofUrl?: string;
  notes?: string;
  deviceName?: string;
}): Promise<GateAttendanceLog> {
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
      id, user_id, face_descriptor, qr_token, passcode, photo_url,
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
    faceDescriptor: data.face_descriptor,
    qrToken: data.qr_token,
    passcode: data.passcode,
    photoUrl: data.photo_url,
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
      id, user_id, face_descriptor, qr_token, passcode, photo_url,
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
    faceDescriptor: data.face_descriptor,
    qrToken: data.qr_token,
    passcode: data.passcode,
    photoUrl: data.photo_url,
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
  return data || [];
}
