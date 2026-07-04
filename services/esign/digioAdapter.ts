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

const BASE_URL = 'https://api.digio.in';

const getAuthHeader = (): string => {
  const credentials = `${import.meta.env.VITE_ESIGN_DIGIO_CLIENT_ID}:${import.meta.env.VITE_ESIGN_DIGIO_CLIENT_SECRET}`;
  return `Basic ${btoa(credentials)}`;
};

export const digioAdapter: IESignAdapter = {
  vendor: 'digio',

  async initiateSign(req: ESignInitiateRequest): Promise<ESignSession> {
    // Step 1: Create a signing request document
    const docRes = await fetch(`${BASE_URL}/v2/client/document/uploadpdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({
        file_name: `Paradigm_Employment_Agreement_${req.employeeId}.pdf`,
        file_url: req.clientNDA
          ? null // Merged PDF URL will be generated
          : req.baseContractUrl,
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
    const docData = await docRes.json();
    const requestId: string = docData?.id ?? '';

    return {
      requestId,
      signingUrl: docData?.signing_parties?.[0]?.sign_link ?? '',
      status: 'initiated',
      vendor: 'digio',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  async getStatus(requestId: string): Promise<ESignStatusResult> {
    const res = await fetch(`${BASE_URL}/v2/client/document/${requestId}`, {
      headers: { Authorization: getAuthHeader() },
    });
    const data = await res.json();
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
    return res.blob();
  },
};
