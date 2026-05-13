/** Types for the Gate-Style Attendance Module */

export interface GateUser {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhotoUrl?: string;
  faceDescriptor?: number[];
  faceVersion?: number;
  qrToken: string;
  passcode: string | null;
  photoUrl: string | null;
  department?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GateAttendanceMethod = 'qr' | 'manual' | 'passcode';

export interface GateAttendanceLog {
  id: string;
  userId: string;
  gateUserId?: string;
  userName?: string;
  userPhotoUrl?: string;
  department?: string;
  method: GateAttendanceMethod;
  confidence?: number;
  imageProofUrl?: string;
  markedAt: string;
  deviceInfo?: Record<string, any>;
  location?: { latitude: number; longitude: number } | null;
  notes?: string;
  createdAt: string;
}

export type GateMode = 'qr' | 'manual' | 'passcode';

export interface GateScanResult {
  success: boolean;
  userId?: string;
  userName?: string;
  userPhotoUrl?: string;
  department?: string;
  method: GateAttendanceMethod;
  confidence?: number;
  message: string;
  alreadyMarked?: boolean;
}
