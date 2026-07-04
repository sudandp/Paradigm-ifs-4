/**
 * leegalityAdapter.ts
 * e-Sign adapter for Leegality.
 * Docs: https://docs.leegality.com
 *
 * Set VITE_ESIGN_LEEGALITY_AUTH_TOKEN in .env.local
 */

import type {
  IESignAdapter,
  ESignInitiateRequest, ESignSession, ESignStatusResult,
} from './esignTypes';

const BASE_URL = 'https://sandbox.leegality.com/api/v3.0';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `${import.meta.env.VITE_ESIGN_LEEGALITY_AUTH_TOKEN}`,
});

export const leegalityAdapter: IESignAdapter = {
  vendor: 'leegality',

  async initiateSign(req: ESignInitiateRequest): Promise<ESignSession> {
    const res = await fetch(`${BASE_URL}/sign/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        file: {
          url: req.baseContractUrl,
          name: `Paradigm_Agreement_${req.employeeId}`,
        },
        signers: [
          {
            name: req.employeeName,
            phone: req.mobile,
            email: req.signerEmail ?? `${req.mobile}@paradigm.temp`,
            sequence: 1,
            aadhaarESign: req.preferredMethod !== 'biometric',
            deliveryMode: 'SMS',
          },
        ],
        expiryDays: 3,
        sendSignLink: true,
        document_delivery_mode: 'EMAIL_AND_DOWNLOAD',
      }),
    });
    const data = await res.json();
    return {
      requestId: data?.data?.documentId ?? '',
      signingUrl: data?.data?.signers?.[0]?.signUrl ?? '',
      status: 'initiated',
      vendor: 'leegality',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  async getStatus(requestId: string): Promise<ESignStatusResult> {
    const res = await fetch(`${BASE_URL}/sign/document/${requestId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    const signer = data?.data?.signers?.[0];
    const isSigned = signer?.signStatus === 'SIGNED';

    return {
      requestId,
      status: isSigned ? 'signed' : 'initiated',
      signedDocumentUrl: isSigned ? data?.data?.signedFileUrl : undefined,
      signedAt: signer?.signedAt ?? undefined,
      auditTrailUrl: data?.data?.auditTrailUrl ?? undefined,
      vendor: 'leegality',
    };
  },

  async downloadSignedDocument(requestId: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/sign/document/${requestId}/download`, {
      headers: getHeaders(),
    });
    return res.blob();
  },
};
