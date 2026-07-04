/**
 * signzyAdapter.ts
 * KYC vendor adapter for Signzy.
 * Docs: https://docs.signzy.com
 *
 * Set VITE_KYC_SIGNZY_API_KEY and VITE_KYC_SIGNZY_PATIENT_ID in .env.local
 */

import type {
  IKYCAdapter,
  PennyDropRequest, PennyDropResult,
  UANVerifyRequest, UANVerifyResult,
  UANGenerateRequest, UANGenerateResult,
  ESICVerifyRequest, ESICVerifyResult,
  TransliterateRequest, TransliterateResult,
} from './kycTypes';

const BASE_URL = 'https://preproduction.signzy.app/api/v2';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: import.meta.env.VITE_KYC_SIGNZY_API_KEY ?? '',
});

export const signzyAdapter: IKYCAdapter = {
  vendor: 'signzy',

  async pennyDrop(req: PennyDropRequest): Promise<PennyDropResult> {
    const res = await fetch(`${BASE_URL}/bankaccountverifications`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        patientId: import.meta.env.VITE_KYC_SIGNZY_PATIENT_ID,
        callbackUrl: '',
        service: {
          name: 'bankAccountVerification',
          fetchType: 'paymentVerification',
          inputs: [req.accountNumber, req.ifsc],
        },
      }),
    });
    const data = await res.json();
    const nameReturned: string | null = data?.response?.result?.accountName ?? null;
    return {
      success: !!nameReturned,
      nameReturned,
      nameMatchScore: null, // Signzy does not return a score; use string similarity on caller side
      rawResponse: data,
      vendor: 'signzy',
      cachedHit: false,
    };
  },

  async verifyUAN(req: UANVerifyRequest): Promise<UANVerifyResult> {
    const res = await fetch(`${BASE_URL}/uanverification`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        patientId: import.meta.env.VITE_KYC_SIGNZY_PATIENT_ID,
        service: {
          name: 'uanVerification',
          inputs: { uan: req.uan, otp: req.otp },
        },
      }),
    });
    const data = await res.json();
    return {
      success: data?.response?.statusCode === 200,
      memberName: data?.response?.result?.memberName ?? null,
      employerHistory: [],
      rawResponse: data,
      vendor: 'signzy',
    };
  },

  async generateUAN(_req: UANGenerateRequest): Promise<UANGenerateResult> {
    // Signzy does not directly support UAN generation; fallback to HyperVerge for this
    return {
      success: false,
      newUAN: null,
      rawResponse: { error: 'Signzy does not support UAN generation. Switch KYC vendor to HyperVerge for this operation.' },
      vendor: 'signzy',
    };
  },

  async verifyESIC(req: ESICVerifyRequest): Promise<ESICVerifyResult> {
    const res = await fetch(`${BASE_URL}/esicverification`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        patientId: import.meta.env.VITE_KYC_SIGNZY_PATIENT_ID,
        service: { name: 'esicVerification', inputs: { esicNumber: req.esicNumber } },
      }),
    });
    const data = await res.json();
    return {
      success: data?.response?.statusCode === 200,
      memberName: data?.response?.result?.name ?? null,
      dispensary: data?.response?.result?.dispensary ?? null,
      status: data?.response?.result?.status === 'Active' ? 'active' : 'inactive',
      rawResponse: data,
      vendor: 'signzy',
    };
  },

  async transliterate(req: TransliterateRequest): Promise<TransliterateResult> {
    // Signzy does not offer transliteration; use browser-native Intl API as fallback
    return {
      originalText: req.text,
      transliteratedText: req.text, // caller should layer a local transliteration library
      vendor: 'signzy',
    };
  },
};
