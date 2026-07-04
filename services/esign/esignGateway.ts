/**
 * esignGateway.ts
 * THE single entry point for all e-Sign operations.
 *
 * HOW TO SWITCH VENDORS:
 * Set VITE_ESIGN_VENDOR in .env.local to: 'digio' | 'leegality' | 'signdesk'
 *
 * CLIENT NDA FLOW:
 * When a worker is being deployed to a client site, pass `clientNDA` in the
 * ESignInitiateRequest. The gateway fetches the NDA template from Supabase,
 * merges it with the base contract PDF, then initiates signing on the combined doc.
 *
 * STATUS POLLING:
 * Use pollUntilSigned() in the UI with a timeout. The signing webview triggers
 * a redirect back to the app; on return, call getStatus() once to confirm.
 */

import { digioAdapter } from './digioAdapter';
import { leegalityAdapter } from './leegalityAdapter';
import { signDeskAdapter } from './signDeskAdapter';
import { supabase } from '../supabase';
import type {
  IESignAdapter,
  ESignVendor,
  ESignInitiateRequest,
  ESignSession,
  ESignStatusResult,
  ClientNDATemplate,
} from './esignTypes';

// ─── Vendor Registry ────────────────────────────────────────────────────────
const ADAPTERS: Record<ESignVendor, IESignAdapter> = {
  digio: digioAdapter,
  leegality: leegalityAdapter,
  signdesk: signDeskAdapter,
};

function getActiveVendor(): ESignVendor {
  const v = import.meta.env.VITE_ESIGN_VENDOR as ESignVendor | undefined;
  if (v && ADAPTERS[v]) return v;
  console.warn('[ESignGateway] VITE_ESIGN_VENDOR not set. Defaulting to digio.');
  return 'digio';
}

function getAdapter(): IESignAdapter {
  return ADAPTERS[getActiveVendor()];
}

// ─── Client NDA Resolver ─────────────────────────────────────────────────────
/**
 * Fetches the NDA template for a given client site from the `client_nda_templates`
 * Supabase table. Returns null if no NDA is configured for that site.
 */
async function resolveClientNDA(clientSiteId: string): Promise<ClientNDATemplate | null> {
  const { data } = await supabase
    .from('client_nda_templates')
    .select('*')
    .eq('client_site_id', clientSiteId)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return null;

  return {
    clientSiteId: data.client_site_id,
    clientName: data.client_name,
    ndaDocumentUrl: data.nda_document_url,
    codeOfConductUrl: data.code_of_conduct_url ?? undefined,
  };
}

// ─── Handshake Log Writer ────────────────────────────────────────────────────
async function logHandshake(
  employeeId: string,
  type: string,
  status: string,
  payload: unknown,
  response: unknown,
): Promise<void> {
  await supabase.from('handshake_logs').insert({
    employee_id: employeeId,
    handshake_type: type,
    status,
    payload,
    response,
    attempted_at: new Date().toISOString(),
  });
}

// ─── Public Gateway API ───────────────────────────────────────────────────────
export const esignGateway = {

  /** Returns the currently configured vendor name — display in UI settings. */
  activeVendor(): ESignVendor {
    return getActiveVendor();
  },

  /**
   * Initiate an e-Sign session.
   * Automatically resolves and appends Client NDA if the worker is deployed
   * to a client site (pass `organization.site` ID in the request context).
   */
  async initiateSign(
    req: ESignInitiateRequest,
    clientSiteId?: string,
  ): Promise<ESignSession> {
    let finalReq = { ...req };

    // Resolve Client NDA dynamically if a site is provided
    if (clientSiteId) {
      const nda = await resolveClientNDA(clientSiteId);
      if (nda) finalReq = { ...finalReq, clientNDA: nda };
    }

    const session = await getAdapter().initiateSign(finalReq);

    await logHandshake(
      req.employeeId,
      'esign_initiate',
      session.status,
      { vendor: getActiveVendor(), clientSiteId },
      { requestId: session.requestId, signingUrl: session.signingUrl },
    );

    return session;
  },

  /**
   * Poll the signing status.
   * Call this after the in-app webview returns or on a manual refresh.
   */
  async getStatus(requestId: string, employeeId: string): Promise<ESignStatusResult> {
    const result = await getAdapter().getStatus(requestId);

    if (result.status === 'signed') {
      // Update handshake log to completed
      await supabase
        .from('handshake_logs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), response: result })
        .eq('employee_id', employeeId)
        .eq('handshake_type', 'esign_initiate');

      // Store signed document URL in onboarding submission
      await supabase
        .from('onboarding_submissions')
        .update({ esign_document_url: result.signedDocumentUrl, esign_signed_at: result.signedAt })
        .eq('id', employeeId);
    }

    return result;
  },

  /**
   * Download the signed document as a Blob for local storage or PDF preview.
   */
  async downloadSignedDocument(requestId: string): Promise<Blob> {
    return getAdapter().downloadSignedDocument(requestId);
  },

  /**
   * Poll until signed, with a timeout.
   * Recommended: call from a useEffect with a 30-second timeout.
   * @param maxWaitMs Total milliseconds to wait (default 5 minutes)
   * @param intervalMs Polling interval (default 10 seconds)
   */
  async pollUntilSigned(
    requestId: string,
    employeeId: string,
    onUpdate: (status: ESignStatusResult) => void,
    maxWaitMs = 5 * 60 * 1000,
    intervalMs = 10_000,
  ): Promise<ESignStatusResult> {
    const deadline = Date.now() + maxWaitMs;

    return new Promise((resolve, reject) => {
      const poll = setInterval(async () => {
        try {
          const status = await esignGateway.getStatus(requestId, employeeId);
          onUpdate(status);
          if (status.status === 'signed' || status.status === 'failed') {
            clearInterval(poll);
            resolve(status);
          }
          if (Date.now() > deadline) {
            clearInterval(poll);
            reject(new Error('e-Sign session timed out after 5 minutes.'));
          }
        } catch (err) {
          clearInterval(poll);
          reject(err);
        }
      }, intervalMs);
    });
  },
};

export type { ESignVendor, ESignSession, ESignStatusResult, ClientNDATemplate };
