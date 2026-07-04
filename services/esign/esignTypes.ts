/**
 * esignTypes.ts
 * Shared type contracts for the vendor-agnostic e-Sign gateway.
 * All three adapters (Digio, Leegality, SignDesk) MUST conform to these interfaces.
 */

export type ESignVendor = 'digio' | 'leegality' | 'signdesk';
export type ESignMethod = 'aadhaar_otp' | 'biometric' | 'dsc';
export type ESignStatus = 'initiated' | 'signed' | 'failed' | 'expired';

// --- Client NDA Annexure ---
export interface ClientNDATemplate {
  clientSiteId: string;
  clientName: string;
  ndaDocumentUrl: string;    // Hosted PDF of the client NDA
  codeOfConductUrl?: string; // Optional code of conduct doc
}

// --- Initiate E-Sign Request ---
export interface ESignInitiateRequest {
  employeeId: string;
  employeeName: string;
  mobile: string;            // For OTP delivery
  baseContractUrl: string;   // Paradigm's standard employment agreement PDF
  clientNDA?: ClientNDATemplate; // If deployed to client site, appended before signing
  signerEmail?: string;
  preferredMethod?: ESignMethod;
  language?: string;         // ISO 639-1 code e.g. 'hi', 'ta', 'en'
}

// --- E-Sign Session Result ---
export interface ESignSession {
  requestId: string;          // Vendor-issued tracking ID
  signingUrl: string;         // Redirect URL for in-app webview
  status: ESignStatus;
  vendor: ESignVendor;
  expiresAt: string;          // ISO timestamp
}

// --- Status Poll Result ---
export interface ESignStatusResult {
  requestId: string;
  status: ESignStatus;
  signedDocumentUrl?: string; // Available when status = 'signed'
  signedAt?: string;
  auditTrailUrl?: string;     // Tamper-proof audit log
  vendor: ESignVendor;
}

// --- Vendor Adapter Interface ---
export interface IESignAdapter {
  vendor: ESignVendor;
  initiateSign(req: ESignInitiateRequest): Promise<ESignSession>;
  getStatus(requestId: string): Promise<ESignStatusResult>;
  downloadSignedDocument(requestId: string): Promise<Blob>;
}
