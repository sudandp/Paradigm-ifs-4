/**
 * hypervergeAdapter.ts
 * KYC vendor adapter for HyperVerge.
 * Docs: https://docs.hyperverge.co
 *
 * Set VITE_KYC_HYPERVERGE_APP_ID and VITE_KYC_HYPERVERGE_APP_KEY in .env.local
 */

import type {
  IKYCAdapter,
  PennyDropRequest, PennyDropResult,
  UANVerifyRequest, UANVerifyResult,
  UANGenerateRequest, UANGenerateResult,
  ESICVerifyRequest, ESICVerifyResult,
  TransliterateRequest, TransliterateResult,
} from './kycTypes';

const BASE_URL = 'https://ind-docs.hyperverge.co/v2.0';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  appid: import.meta.env.VITE_KYC_HYPERVERGE_APP_ID ?? '',
  appkey: import.meta.env.VITE_KYC_HYPERVERGE_APP_KEY ?? '',
});

export const hypervergeAdapter: IKYCAdapter = {
  vendor: 'hyperverge',

  async pennyDrop(req: PennyDropRequest): Promise<PennyDropResult> {
    const res = await fetch(`${BASE_URL}/bankAccountVerify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        accountNumber: req.accountNumber,
        ifsc: req.ifsc,
        // HyperVerge uses 1-rupee penny drop by default
      }),
    });
    const data = await res.json();
    const nameReturned: string | null = data?.result?.details?.nameAtBank ?? null;
    return {
      success: data?.status === 'success',
      nameReturned,
      nameMatchScore: data?.result?.details?.nameMatchScore ?? null,
      rawResponse: data,
      vendor: 'hyperverge',
      cachedHit: false,
    };
  },

  async verifyUAN(req: UANVerifyRequest): Promise<UANVerifyResult> {
    const res = await fetch(`${BASE_URL}/uanVerify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ uan: req.uan, otp: req.otp, mobile: req.mobile }),
    });
    const data = await res.json();
    return {
      success: data?.status === 'success',
      memberName: data?.result?.memberName ?? null,
      employerHistory: data?.result?.employmentHistory?.map((e: Record<string, string>) => ({
        name: e.establishmentName,
        dateOfJoining: e.dateOfJoining,
        dateOfExit: e.dateOfExit ?? null,
        membershipId: e.membershipId,
      })) ?? [],
      rawResponse: data,
      vendor: 'hyperverge',
    };
  },

  async generateUAN(req: UANGenerateRequest): Promise<UANGenerateResult> {
    // HyperVerge proxies EPFO employer portal UAN generation
    const res = await fetch(`${BASE_URL}/uanGenerate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(req),
    });
    const data = await res.json();
    return {
      success: data?.status === 'success',
      newUAN: data?.result?.uan ?? null,
      rawResponse: data,
      vendor: 'hyperverge',
    };
  },

  async verifyESIC(req: ESICVerifyRequest): Promise<ESICVerifyResult> {
    const res = await fetch(`${BASE_URL}/esicVerify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ esicNumber: req.esicNumber }),
    });
    const data = await res.json();
    return {
      success: data?.status === 'success',
      memberName: data?.result?.memberName ?? null,
      dispensary: data?.result?.dispensary ?? null,
      status: data?.result?.memberStatus === 'Active' ? 'active' : 'inactive',
      rawResponse: data,
      vendor: 'hyperverge',
    };
  },

  async transliterate(req: TransliterateRequest): Promise<TransliterateResult> {
    // HyperVerge uses Google Translate internally for transliteration
    const res = await fetch(`${BASE_URL}/transliterate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text: req.text, srcLang: req.sourceLanguage, tgtLang: 'en' }),
    });
    const data = await res.json();
    return {
      originalText: req.text,
      transliteratedText: data?.result?.transliteratedText ?? req.text,
      vendor: 'hyperverge',
    };
  },
};
