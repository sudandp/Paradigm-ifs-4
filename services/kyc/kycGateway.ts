/**
 * kycGateway.ts
 * THE single entry point for all KYC verification calls.
 *
 * HOW TO SWITCH VENDORS:
 * Set VITE_KYC_VENDOR in .env.local to: 'hyperverge' | 'signzy' | 'decentro'
 * No code changes needed — the gateway auto-selects the adapter.
 *
 * IDEMPOTENCY:
 * Penny drop and other expensive calls check the local Supabase cache first
 * to prevent duplicate API billing on re-verification attempts.
 *
 * TRANSLITERATION:
 * HyperVerge is the only vendor supporting server-side transliteration.
 * When using Signzy/Decentro, the gateway falls back to the `any-ascii` npm
 * module for best-effort romanisation (installed separately as needed).
 */

import { hypervergeAdapter } from './hypervergeAdapter';
import { signzyAdapter } from './signzyAdapter';
import { decentroAdapter } from './decentroAdapter';
import { supabase } from '../supabase';
import type {
  IKYCAdapter,
  KYCVendor,
  PennyDropRequest, PennyDropResult,
  UANVerifyRequest, UANVerifyResult,
  UANGenerateRequest, UANGenerateResult,
  ESICVerifyRequest, ESICVerifyResult,
  TransliterateRequest, TransliterateResult,
  VerificationCacheRecord,
} from './kycTypes';

// ─── Vendor Registry ────────────────────────────────────────────────────────
const ADAPTERS: Record<KYCVendor, IKYCAdapter> = {
  hyperverge: hypervergeAdapter,
  signzy: signzyAdapter,
  decentro: decentroAdapter,
};

function getActiveVendor(): KYCVendor {
  const v = import.meta.env.VITE_KYC_VENDOR as KYCVendor | undefined;
  if (v && ADAPTERS[v]) return v;
  console.warn('[KYCGateway] VITE_KYC_VENDOR not set or invalid. Defaulting to hyperverge.');
  return 'hyperverge';
}

function getAdapter(): IKYCAdapter {
  return ADAPTERS[getActiveVendor()];
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────
const CACHE_TTL_HOURS = 24;

async function checkCache(idempotencyKey: string): Promise<VerificationCacheRecord | null> {
  const { data } = await supabase
    .from('verification_cache')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data ?? null;
}

async function writeCache(record: Omit<VerificationCacheRecord, 'expiresAt'>): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await supabase.from('verification_cache').upsert({
    employee_id: record.employeeId,
    check_type: record.checkType,
    idempotency_key: record.idempotencyKey,
    result: record.result,
    verified_at: record.verifiedAt,
    expires_at: expiresAt,
  }, { onConflict: 'idempotency_key' });
}

// ─── Public Gateway API ───────────────────────────────────────────────────────

export const kycGateway = {

  /** Returns the currently configured vendor name — use in UI to show which provider is active. */
  activeVendor(): KYCVendor {
    return getActiveVendor();
  },

  /**
   * Penny Drop Bank Verification.
   * Automatically caches results by employeeId to prevent re-billing on retry.
   */
  async pennyDrop(req: PennyDropRequest): Promise<PennyDropResult> {
    const idempotencyKey = `penny_drop_${req.employeeId}_${req.accountNumber}_${req.ifsc}`;

    // Check cache first
    const cached = await checkCache(idempotencyKey);
    if (cached) {
      return { ...(cached.result as PennyDropResult), cachedHit: true };
    }

    const adapter = getAdapter();
    const result = await adapter.pennyDrop(req);

    // Write to cache only on success
    if (result.success) {
      await writeCache({
        employeeId: req.employeeId,
        checkType: 'penny_drop',
        idempotencyKey,
        result,
        verifiedAt: new Date().toISOString(),
      });
    }

    return result;
  },

  /**
   * UAN / EPFO OTP Verification.
   */
  async verifyUAN(req: UANVerifyRequest, employeeId: string): Promise<UANVerifyResult> {
    const idempotencyKey = `uan_${employeeId}_${req.uan}`;
    const cached = await checkCache(idempotencyKey);
    if (cached) return cached.result as UANVerifyResult;

    const result = await getAdapter().verifyUAN(req);
    if (result.success) {
      await writeCache({
        employeeId,
        checkType: 'uan',
        idempotencyKey,
        result,
        verifiedAt: new Date().toISOString(),
      });
    }
    return result;
  },

  /**
   * Generate a new UAN for first-time formal workers.
   * NOTE: Only HyperVerge supports this. If another vendor is active,
   * the call falls back to HyperVerge automatically.
   */
  async generateUAN(req: UANGenerateRequest, employeeId: string): Promise<UANGenerateResult> {
    // Always route UAN generation to HyperVerge — only vendor supporting it
    const adapter = getActiveVendor() === 'hyperverge' ? hypervergeAdapter : hypervergeAdapter;
    const result = await adapter.generateUAN(req);
    if (result.success && result.newUAN) {
      await writeCache({
        employeeId,
        checkType: 'uan_generate',
        idempotencyKey: `uan_generate_${employeeId}`,
        result,
        verifiedAt: new Date().toISOString(),
      });
    }
    return result;
  },

  /**
   * ESIC Registry Verification.
   */
  async verifyESIC(req: ESICVerifyRequest, employeeId: string): Promise<ESICVerifyResult> {
    const idempotencyKey = `esic_${employeeId}_${req.esicNumber}`;
    const cached = await checkCache(idempotencyKey);
    if (cached) return cached.result as ESICVerifyResult;

    const result = await getAdapter().verifyESIC(req);
    if (result.success) {
      await writeCache({
        employeeId,
        checkType: 'esic',
        idempotencyKey,
        result,
        verifiedAt: new Date().toISOString(),
      });
    }
    return result;
  },

  /**
   * Transliterate regional language text to English.
   * HyperVerge handles server-side. Signzy/Decentro return the original text —
   * layer a local library (e.g., `any-ascii`) in the caller for those vendors.
   */
  async transliterate(req: TransliterateRequest): Promise<TransliterateResult> {
    return getAdapter().transliterate(req);
  },
};

export type { KYCVendor, PennyDropResult, UANVerifyResult, ESICVerifyResult, UANGenerateResult };
