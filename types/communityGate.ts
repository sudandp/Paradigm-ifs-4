/**
 * Paradigm Gate & Community OS Types
 * Complete specification for MyGate replication (Units, Residents, Daily Help, Entries, Passes, Patrols)
 */

export type GateVisitorType = 'guest' | 'cab' | 'delivery' | 'daily_help' | 'service_technician' | 'vendor';

export type GateApprovalStatus = 'pending' | 'approved' | 'denied' | 'auto_preapproved' | 'guard_override';

export type GateApprovalChannel = 'app_push' | 'exotel_ivr' | 'guard_phone_call' | 'pre_invite_qr' | 'guard_manual';

export type GateMovementType = 'inward' | 'outward' | 'move_in' | 'move_out';

export type GatePassStatus = 'draft' | 'issued' | 'gate_verified' | 'completed' | 'rejected';

export type GateEmergencyType = 'fire' | 'medical' | 'security_threat' | 'lift_entrapment' | 'gas_leak' | 'general_panic';

export interface GateUnit {
  id: string;
  organization_id: string;
  entity_id?: string;
  location_id?: string;
  block_tower: string;
  floor_number?: number;
  unit_number: string;
  intercom_code?: string;
  area_sqft?: number;
  occupancy_status: 'occupied' | 'vacant' | 'under_renovation';
  created_at?: string;
}

export interface GateResident {
  id: string;
  organization_id: string;
  unit_id: string;
  user_id?: string;
  full_name: string;
  phone: string;
  email?: string;
  resident_type: 'owner' | 'tenant' | 'family_member';
  is_primary: boolean;
  fcm_device_token?: string;
  ivr_opt_in: boolean;
  active: boolean;
  created_at?: string;
  gate_units?: Partial<GateUnit>;
}

export interface GateDailyHelper {
  id: string;
  organization_id: string;
  helper_code: string;
  full_name: string;
  helper_type: 'Maid' | 'Cook' | 'Driver' | 'Gardener' | 'Nanny' | 'Car Cleaner';
  phone?: string;
  photo_url?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  police_verified: boolean;
  current_status: 'inside' | 'outside';
  last_status_change?: string;
  active: boolean;
  rating?: number;
  assigned_units?: string[];
}

export interface GateEntry {
  id: string;
  organization_id: string;
  unit_id?: string;
  location_id?: string;
  visitor_type: GateVisitorType;
  visitor_name: string;
  visitor_phone?: string;
  vehicle_number?: string;
  company_name?: string;
  visitor_photo_url?: string;
  helper_id?: string;
  entry_gate_name: string;
  exit_gate_name?: string;
  guard_user_id?: string;
  entry_time: string;
  exit_time?: string;
  approval_status: GateApprovalStatus;
  approved_by_resident_id?: string;
  approval_channel?: GateApprovalChannel;
  approval_timestamp?: string;
  exotel_call_sid?: string;
  ivr_call_status?: string;
  ivr_call_timestamp?: string;
  pre_invite_code?: string;
  is_pre_approved?: boolean;
  offline_id?: string;
  is_synced?: boolean;
  created_at?: string;
  gate_units?: {
    block_tower: string;
    unit_number: string;
  };
}

export interface GateMaterialPass {
  id: string;
  organization_id: string;
  unit_id: string;
  pass_number: string;
  movement_type: GateMovementType;
  is_returnable: boolean;
  expected_return_date?: string;
  items_description: Array<{
    item: string;
    qty: number;
    serial?: string;
  }>;
  transporter_name?: string;
  vehicle_number?: string;
  office_noc_approved: boolean;
  status: GatePassStatus;
  created_at?: string;
}

export interface GatePatrolCheckpoint {
  id: string;
  organization_id: string;
  location_id?: string;
  checkpoint_code: string;
  checkpoint_name: string;
  qr_hash: string;
  nfc_tag_uid?: string;
  expected_latitude?: number;
  expected_longitude?: number;
  sequence_order: number;
  active: boolean;
}

export interface GatePatrolScan {
  id: string;
  organization_id: string;
  checkpoint_id: string;
  guard_id: string;
  scan_time: string;
  latitude?: number;
  longitude?: number;
  is_within_geofence: boolean;
  remarks?: string;
}

export interface GateEmergencyAlert {
  id: string;
  organization_id: string;
  unit_id?: string;
  alert_type: GateEmergencyType;
  location_description?: string;
  is_active: boolean;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface OfflineGateCache {
  units: GateUnit[];
  residents: GateResident[];
  helpers: GateDailyHelper[];
  cachedAt: number;
  organizationId: string;
}
