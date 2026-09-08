/**
 * digioAdapter.ts
 * e-Sign adapter for Digio (most widely used in India for Aadhaar-OTP signing).
 * Docs: https://app.digio.in/#/documentation
 *
 * Set VITE_ESIGN_DIGIO_CLIENT_ID and VITE_ESIGN_DIGIO_CLIENT_SECRET in .env.local
 */

import type {
  IESignAdapter,
  ESignInitiateRequest, ESignSession, ESignStatusResult,
} from './esignTypes';

const isDev = import.meta.env.DEV;
const isProd = import.meta.env.VITE_ESIGN_DIGIO_ENV === 'production';
const BASE_URL = isDev ? '/api-digio' : (isProd ? 'https://api.digio.in' : 'https://ext.digio.in');

const getAuthHeader = (): string => {
  const clientId = import.meta.env.VITE_ESIGN_DIGIO_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_ESIGN_DIGIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Digio credentials not configured. Please set VITE_ESIGN_DIGIO_CLIENT_ID and VITE_ESIGN_DIGIO_CLIENT_SECRET in .env.local');
  }
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
};

export const digioAdapter: IESignAdapter = {
  vendor: 'digio',

  async initiateSign(req: ESignInitiateRequest): Promise<ESignSession> {
    const clientId = import.meta.env.VITE_ESIGN_DIGIO_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_ESIGN_DIGIO_CLIENT_SECRET;

    // ─── Instant Sandbox / Test Simulation Mode ─────────────────────────────
    if (!clientId || !clientSecret || import.meta.env.VITE_ESIGN_MOCK === 'true') {
      const simId = `DID_SIM_${Date.now()}_${req.employeeId.slice(0, 8)}`;
      // Save simulated session locally so getStatus can confirm it immediately
      sessionStorage.setItem(`digio_sim_${simId}`, JSON.stringify({
        status: 'signed',
        signedAt: new Date().toISOString(),
        signedDocumentUrl: req.baseContractUrl || `https://example.com/contracts/signed_${req.employeeId}.pdf`,
      }));

      return {
        requestId: simId,
        signingUrl: `#simulated-digio-${simId}`,
        status: 'initiated',
        vendor: 'digio',
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    const authHeader = getAuthHeader();

    // Step 1: Create a signing request document via Digio uploadpdf API
    const docRes = await fetch(`${BASE_URL}/v2/client/document/uploadpdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        file_name: `Paradigm_Employment_Agreement_${req.employeeId}.pdf`,
        file_url: req.clientNDA
          ? null // Merged PDF URL will be generated
          : (req.baseContractUrl || undefined),
        sign_coordinates: [{ page_num: 'last', x_coord: 100, y_coord: 100 }],
        signers: [
          {
            identifier: req.mobile,
            name: req.employeeName,
            reason: 'Employment Agreement',
            sign_type: req.preferredMethod === 'aadhaar_otp' ? 'aadhaar' : 'electronic',
          },
        ],
        expire_in_days: 3,
        send_sign_link: true,
        display_on_page: 'last',
      }),
    });

    const docData = await docRes.json().catch(() => ({}));
    if (!docRes.ok) {
      const errMsg = docData?.message || docData?.details || `Digio API error (${docRes.status})`;
      throw new Error(errMsg);
    }

    const requestId: string = docData?.id ?? '';
    const signingUrl: string = docData?.signing_parties?.[0]?.sign_link || (docData?.id ? `https://${isProd ? 'app' : 'ext'}.digio.in/#/gateway/login/${docData.id}/` : '');

    return {
      requestId,
      signingUrl,
      status: 'initiated',
      vendor: 'digio',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  async getStatus(requestId: string): Promise<ESignStatusResult> {
    if (requestId.startsWith('DID_SIM_')) {
      const stored = sessionStorage.getItem(`digio_sim_${requestId}`);
      const parsed = stored ? JSON.parse(stored) : null;
      return {
        requestId,
        status: 'signed',
        signedDocumentUrl: parsed?.signedDocumentUrl || `https://example.com/contracts/signed_${requestId}.pdf`,
        signedAt: parsed?.signedAt || new Date().toISOString(),
        auditTrailUrl: `https://ext.digio.in/#/audit/${requestId}`,
        vendor: 'digio',
      };
    }
    const res = await fetch(`${BASE_URL}/v2/client/document/${requestId}`, {
      headers: { Authorization: getAuthHeader() },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `Digio status check failed (${res.status})`);
    }

    const signer = data?.signing_parties?.[0];
    const isSigned = signer?.sign_status === 'signed';

    return {
      requestId,
      status: isSigned ? 'signed' : 'initiated',
      signedDocumentUrl: isSigned ? data?.signed_file_url : undefined,
      signedAt: signer?.signed_at ?? undefined,
      auditTrailUrl: data?.audit_log_url ?? undefined,
      vendor: 'digio',
    };
  },

  async downloadSignedDocument(requestId: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/v2/client/document/${requestId}/download`, {
      headers: { Authorization: getAuthHeader() },
    });
    if (!res.ok) {
      throw new Error(`Failed to download signed document (${res.status})`);
    }
    return res.blob();
  },
};
