/**
 * decentroAdapter.ts
 * KYC vendor adapter for Decentro.
 * Docs: https://docs.decentro.tech
 *
 * Set VITE_KYC_DECENTRO_CLIENT_ID, VITE_KYC_DECENTRO_CLIENT_SECRET,
 * VITE_KYC_DECENTRO_MODULE_SECRET, VITE_KYC_DECENTRO_PROVIDER_SECRET in .env.local
 */

import type {
  IKYCAdapter,
  PennyDropRequest, PennyDropResult,
  UANVerifyRequest, UANVerifyResult,
  UANGenerateRequest, UANGenerateResult,
  ESICVerifyRequest, ESICVerifyResult,
  TransliterateRequest, TransliterateResult,
} from './kycTypes';

const BASE_URL = 'https://in.decentro.tech';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  client_id: import.meta.env.VITE_KYC_DECENTRO_CLIENT_ID ?? '',
  client_secret: import.meta.env.VITE_KYC_DECENTRO_CLIENT_SECRET ?? '',
  module_secret: import.meta.env.VITE_KYC_DECENTRO_MODULE_SECRET ?? '',
  provider_secret: import.meta.env.VITE_KYC_DECENTRO_PROVIDER_SECRET ?? '',
});

export const decentroAdapter: IKYCAdapter = {
  vendor: 'decentro',

  async pennyDrop(req: PennyDropRequest): Promise<PennyDropResult> {
    const res = await fetch(`${BASE_URL}/v2/banking/account/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        reference_id: req.employeeId,
        bank_account_number: req.accountNumber,
        bank_account_ifsc: req.ifsc,
        transfer_type: 'PENNY_DROP',
        transfer_amount: 1,
        transfer_note: 'Paradigm employee verification',
        beneficiary_name: '',
      }),
    });
    const data = await res.json();
    const nameReturned: string | null = data?.data?.transactionStatus === 'SUCCESS'
      ? data?.data?.beneficiaryName ?? null
      : null;
    return {
      success: data?.responseCode === 'S00000',
      nameReturned,
      nameMatchScore: null,
      rawResponse: data,
      vendor: 'decentro',
      cachedHit: false,
    };
  },

  async verifyUAN(req: UANVerifyRequest): Promise<UANVerifyResult> {
    const res = await fetch(`${BASE_URL}/v2/kyc/uan/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        reference_id: `UAN_${Date.now()}`,
        uan: req.uan,
        otp: req.otp,
      }),
    });
    const data = await res.json();
    return {
      success: data?.responseCode === 'S00000',
      memberName: data?.data?.name ?? null,
      employerHistory: data?.data?.employmentHistory?.map((e: Record<string, string>) => ({
        name: e.establishmentName,
        dateOfJoining: e.dateOfJoining,
        dateOfExit: e.dateOfExit ?? null,
        membershipId: e.memberId,
      })) ?? [],
      rawResponse: data,
      vendor: 'decentro',
    };
  },

  async generateUAN(_req: UANGenerateRequest): Promise<UANGenerateResult> {
    // Decentro does not support UAN generation; requires EPFO employer portal
    return {
      success: false,
      newUAN: null,
      rawResponse: { error: 'Decentro does not support UAN generation. Use Back-Office UAN Exception Queue.' },
      vendor: 'decentro',
    };
  },

  async verifyESIC(req: ESICVerifyRequest): Promise<ESICVerifyResult> {
    const res = await fetch(`${BASE_URL}/v2/kyc/esic/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        reference_id: `ESIC_${Date.now()}`,
        esic_number: req.esicNumber,
      }),
    });
    const data = await res.json();
    return {
      success: data?.responseCode === 'S00000',
      memberName: data?.data?.name ?? null,
      dispensary: data?.data?.dispensaryName ?? null,
      status: data?.data?.status?.toLowerCase() === 'active' ? 'active' : 'inactive',
      rawResponse: data,
      vendor: 'decentro',
    };
  },

  async transliterate(req: TransliterateRequest): Promise<TransliterateResult> {
    // Decentro does not support transliteration
    return {
      originalText: req.text,
      transliteratedText: req.text,
      vendor: 'decentro',
    };
  },
};
