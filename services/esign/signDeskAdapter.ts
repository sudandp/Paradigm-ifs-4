/**
 * signDeskAdapter.ts
 * e-Sign adapter for SignDesk.
 * Docs: https://docs.sign-desk.com
 *
 * Set VITE_ESIGN_SIGNDESK_APP_ID and VITE_ESIGN_SIGNDESK_API_KEY in .env.local
 */

import type {
  IESignAdapter,
  ESignInitiateRequest, ESignSession, ESignStatusResult,
} from './esignTypes';

const BASE_URL = 'https://api.sign-desk.com/api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-parse-application-id': import.meta.env.VITE_ESIGN_SIGNDESK_APP_ID ?? '',
  'x-parse-rest-api-key': import.meta.env.VITE_ESIGN_SIGNDESK_API_KEY ?? '',
});

export const signDeskAdapter: IESignAdapter = {
  vendor: 'signdesk',

  async initiateSign(req: ESignInitiateRequest): Promise<ESignSession> {
    const res = await fetch(`${BASE_URL}/esign/v2/request`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        applicant: {
          name: req.employeeName,
          mobile: req.mobile,
          email: req.signerEmail,
        },
        documentDetails: {
          documentUrl: req.baseContractUrl,
          documentName: `Paradigm_Agreement_${req.employeeId}`,
          documentDescription: 'Employment Agreement',
        },
        eSignDetails: {
          eSignType: req.preferredMethod === 'biometric' ? 'biometric' : 'aadhaar',
          expiryInDays: 3,
        },
        notifySignatory: true,
        redirectUrl: '', // In-app webview handles redirect
      }),
    });
    const data = await res.json();
    return {
      requestId: data?.transactionId ?? '',
      signingUrl: data?.redirectUrl ?? '',
      status: 'initiated',
      vendor: 'signdesk',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  async getStatus(requestId: string): Promise<ESignStatusResult> {
    const res = await fetch(`${BASE_URL}/esign/v2/status/${requestId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    const isSigned = data?.eSignStatus === 'SIGNED';

    return {
      requestId,
      status: isSigned ? 'signed' : 'initiated',
      signedDocumentUrl: isSigned ? data?.signedDocUrl : undefined,
      signedAt: data?.signedAt ?? undefined,
      auditTrailUrl: data?.auditTrailUrl ?? undefined,
      vendor: 'signdesk',
    };
  },

  async downloadSignedDocument(requestId: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/esign/v2/download/${requestId}`, {
      headers: getHeaders(),
    });
    return res.blob();
  },
};
