/**
 * kycTypes.ts
 * Shared type contracts for the vendor-agnostic KYC gateway.
 * All three vendor adapters (HyperVerge, Signzy, Decentro) MUST conform to these interfaces.
 */

// --- Vendor Selector ---
export type KYCVendor = 'hyperverge' | 'signzy' | 'decentro';
export type ESignVendor = 'digio' | 'leegality' | 'signdesk';

// --- Penny Drop ---
export interface PennyDropRequest {
  accountNumber: string;
  ifsc: string;
  employeeId: string; // used as idempotency key
}

export interface PennyDropResult {
  success: boolean;
  nameReturned: string | null;
  nameMatchScore: number | null; // 0-100
  rawResponse: Record<string, unknown>;
  vendor: KYCVendor;
  cachedHit: boolean;
}

// --- UAN / EPFO ---
export interface UANVerifyRequest {
  uan: string;
  otp: string;
  mobile: string;
}

export interface UANVerifyResult {
  success: boolean;
  employerHistory: EPFOEmployer[];
  memberName: string | null;
  rawResponse: Record<string, unknown>;
  vendor: KYCVendor;
}

export interface EPFOEmployer {
  name: string;
  dateOfJoining: string;
  dateOfExit: string | null;
  membershipId: string;
}

export interface UANGenerateRequest {
  aadhaarNumber: string;
  name: string;
  dob: string; // YYYY-MM-DD
  mobile: string;
  employerName: string;
  employerPFCode: string;
}

export interface UANGenerateResult {
  success: boolean;
  newUAN: string | null;
  rawResponse: Record<string, unknown>;
  vendor: KYCVendor;
}

// --- ESIC Registry ---
export interface ESICVerifyRequest {
  esicNumber: string;
}

export interface ESICVerifyResult {
  success: boolean;
  memberName: string | null;
  dispensary: string | null;
  status: 'active' | 'inactive' | 'unknown';
  rawResponse: Record<string, unknown>;
  vendor: KYCVendor;
}

// --- Transliteration ---
export interface TransliterateRequest {
  text: string;
  sourceLanguage: string; // e.g., 'hi', 'ta', 'te', 'kn', 'ml'
  targetLanguage: 'en';
}

export interface TransliterateResult {
  originalText: string;
  transliteratedText: string;
  vendor: KYCVendor;
}

// --- Aadhaar OVSE Offline ---
export interface AadhaarOVSEResult {
  isValid: boolean;
  signatureVerified: boolean;
  aadhaarData: {
    name: string;
    dob: string;
    gender: string;
    address: string;
    photo?: string; // base64 for face match
    lastFourDigits: string;
  } | null;
  vendor: KYCVendor;
}

// --- Verification Cache Record ---
export interface VerificationCacheRecord {
  employeeId: string;
  checkType: 'penny_drop' | 'uan' | 'esic' | 'aadhaar' | 'uan_generate';
  idempotencyKey: string;
  result: PennyDropResult | UANVerifyResult | ESICVerifyResult | UANGenerateResult | AadhaarOVSEResult;
  verifiedAt: string;
  expiresAt: string;
}

// --- Vendor Adapter Interface ---
export interface IKYCAdapter {
  vendor: KYCVendor;
  pennyDrop(req: PennyDropRequest): Promise<PennyDropResult>;
  verifyUAN(req: UANVerifyRequest): Promise<UANVerifyResult>;
  generateUAN(req: UANGenerateRequest): Promise<UANGenerateResult>;
  verifyESIC(req: ESICVerifyRequest): Promise<ESICVerifyResult>;
  transliterate(req: TransliterateRequest): Promise<TransliterateResult>;
}
