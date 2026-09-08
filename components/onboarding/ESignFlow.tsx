/**
 * ESignFlow.tsx
 * In-app e-Sign flow component for employment agreement signing.
 *
 * Usage:
 *   <ESignFlow employeeId={data.id} employeeName="..." mobile="..." clientSiteId="..." />
 *
 * Flow:
 *  1. "Initiate Signing" → calls esignGateway.initiateSign()
 *  2. Opens signing URL in an in-app Capacitor Browser (on-device) or modal iframe (web)
 *  3. On return → calls esignGateway.getStatus() to confirm
 *  4. Signed document URL is stored to Supabase automatically by the gateway
 *  5. Emits onSigned(signedDocUrl) callback to parent
 *
 * Vendor shown at bottom — switches automatically with VITE_ESIGN_VENDOR env var.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Loader2, FileSignature, CheckCircle2, XCircle, ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { esignGateway } from '../../services/esign/esignGateway';
import type { ESignSession, ESignStatusResult } from '../../services/esign/esignGateway';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ESignFlowProps {
  employeeId: string;
  employeeName: string;
  mobile: string;
  signerEmail?: string;
  baseContractUrl: string;    // URL of the Paradigm standard employment agreement PDF
  clientSiteId?: string;      // If set, Client NDA will be auto-appended
  onSigned?: (signedDocUrl: string) => void;
  onError?: (message: string) => void;
}

type FlowState = 'idle' | 'initiating' | 'awaiting_sign' | 'confirming' | 'signed' | 'failed' | 'expired';

// ─── Component ────────────────────────────────────────────────────────────────

const ESignFlow: React.FC<ESignFlowProps> = ({
  employeeId,
  employeeName,
  mobile,
  signerEmail,
  baseContractUrl,
  clientSiteId,
  onSigned,
  onError,
}) => {
  const [state, setState] = useState<FlowState>('idle');
  const [session, setSession] = useState<ESignSession | null>(null);
  const [statusResult, setStatusResult] = useState<ESignStatusResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSimModal, setShowSimModal] = useState(false);
  const [isSimSigning, setIsSimSigning] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop any ongoing polling
  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // ─── Step 1: Initiate Signing ──────────────────────────────────────────────
  const handleInitiate = useCallback(async () => {
    setState('initiating');
    setErrorMsg('');
    setStatusResult(null);

    try {
      const newSession = await esignGateway.initiateSign(
        {
          employeeId,
          employeeName,
          mobile,
          signerEmail,
          baseContractUrl,
          preferredMethod: 'aadhaar_otp',
          language: 'en',
        },
        clientSiteId,
      );

      setSession(newSession);
      setState('awaiting_sign');

      // Check if running in Sandbox Simulation Mode
      if (newSession.signingUrl.startsWith('#simulated-')) {
        setShowSimModal(true);
        return;
      }

      // Open signing URL in Capacitor In-App Browser (on device)
      // On web, falls back to new tab
      const isCapacitor = !!(window as any).Capacitor;
      if (isCapacitor) {
        await Browser.open({ url: newSession.signingUrl, presentationStyle: 'popover' });

        // Listen for browser close event (user returned from signing)
        const listener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            await listener.remove();
            await handleConfirmStatus(newSession.requestId);
          }
        });
      } else {
        // Web: open in new tab, start polling
        window.open(newSession.signingUrl, '_blank', 'noopener');
        startPolling(newSession.requestId);
      }
    } catch (err: any) {
      setState('failed');
      const msg = err?.message ?? 'e-Sign initiation failed. Check vendor configuration.';
      setErrorMsg(msg);
      onError?.(msg);
    }
  }, [employeeId, employeeName, mobile, signerEmail, baseContractUrl, clientSiteId, onError]);

  // ─── Step 2: Confirm Status (called on app resume or manual poll) ──────────
  const handleConfirmStatus = useCallback(async (requestId: string) => {
    setState('confirming');
    clearPoll();
    try {
      const result = await esignGateway.getStatus(requestId, employeeId);
      setStatusResult(result);

      if (result.status === 'signed') {
        setState('signed');
        if (result.signedDocumentUrl) onSigned?.(result.signedDocumentUrl);
      } else if (result.status === 'expired') {
        setState('expired');
        setErrorMsg('Signing session expired. Please initiate again.');
      } else if (result.status === 'failed') {
        setState('failed');
        setErrorMsg('Signing was rejected or failed. Please retry.');
      } else {
        // Still pending — go back to awaiting
        setState('awaiting_sign');
      }
    } catch {
      setState('awaiting_sign'); // network blip, let user retry manually
    }
  }, [employeeId, onSigned, clearPoll]);

  // ─── Polling (web fallback) ────────────────────────────────────────────────
  const startPolling = useCallback((requestId: string) => {
    clearPoll();
    let attempts = 0;
    pollTimer.current = setInterval(async () => {
      attempts++;
      if (attempts > 30) { // 5 minutes max (30 × 10s)
        clearPoll();
        setState('expired');
        setErrorMsg('Signing session expired. Please initiate again.');
        return;
      }
      const result = await esignGateway.getStatus(requestId, employeeId).catch(() => null);
      if (!result) return;
      setStatusResult(result);
      if (result.status === 'signed' || result.status === 'failed' || result.status === 'expired') {
        clearPoll();
        if (result.status === 'signed') {
          setState('signed');
          if (result.signedDocumentUrl) onSigned?.(result.signedDocumentUrl);
        } else {
          setState(result.status);
        }
      }
    }, 10_000);
  }, [employeeId, onSigned, clearPoll]);

  // ─── Manual "I've signed — check status" ──────────────────────────────────
  const handleManualCheck = useCallback(() => {
    if (session) handleConfirmStatus(session.requestId);
  }, [session, handleConfirmStatus]);

  // ─── Render ────────────────────────────────────────────────────────────────
  const vendor = esignGateway.activeVendor();

  return (
    <div id="esign-flow-container" className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-accent" />
          <span className="font-semibold text-primary-text">Digital Employment Agreement</span>
        </div>
        <span className="text-[10px] text-muted uppercase tracking-widest border border-border rounded px-2 py-0.5">
          via {vendor}
        </span>
      </div>

      {/* Idle */}
      {state === 'idle' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            The worker will sign the employment agreement digitally using Aadhaar-OTP.
            {clientSiteId && ' Client NDA will be appended automatically for this site.'}
          </p>
          <button
            id="esign-initiate-btn"
            type="button"
            onClick={handleInitiate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors w-fit"
          >
            <ShieldCheck className="h-4 w-4" />
            Initiate Signing
          </button>
        </div>
      )}

      {/* Initiating */}
      {state === 'initiating' && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating signing session with {vendor}…
        </div>
      )}

      {/* Awaiting signature — webview opened */}
      {state === 'awaiting_sign' && session && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-500 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            {session.signingUrl.startsWith('#simulated-')
              ? 'Ready to sign via sandbox simulation…'
              : 'Waiting for worker to sign in the browser window…'}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {session.signingUrl.startsWith('#simulated-') ? (
              <button
                id="esign-sim-open-btn"
                type="button"
                onClick={() => setShowSimModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-sm"
              >
                <ShieldCheck className="h-4 w-4" />
                Complete Sandbox Signature
              </button>
            ) : (
              <button
                id="esign-reopen-btn"
                type="button"
                onClick={() => window.open(session.signingUrl, '_blank', 'noopener')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Re-open signing link
              </button>
            )}
            <button
              id="esign-check-btn"
              type="button"
              onClick={handleManualCheck}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-primary-text text-sm font-medium hover:bg-accent/30 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              I've signed — check status
            </button>
          </div>
          <p className="text-xs text-muted">
            Session ID: <span className="font-mono">{session.requestId}</span>
            &nbsp;·&nbsp;Expires: {new Date(session.expiresAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      )}

      {/* Confirming */}
      {state === 'confirming' && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Confirming signature with {vendor}…
        </div>
      )}

      {/* Signed ✅ */}
      {state === 'signed' && statusResult && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
            <CheckCircle2 className="h-5 w-5" />
            Document signed successfully
          </div>
          {statusResult.signedDocumentUrl && (
            <a
              href={statusResult.signedDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-accent underline w-fit"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Download Signed Agreement
            </a>
          )}
          {statusResult.signedAt && (
            <p className="text-xs text-muted">
              Signed at: {new Date(statusResult.signedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
          {statusResult.auditTrailUrl && (
            <a href={statusResult.auditTrailUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline">
              View Audit Trail
            </a>
          )}
        </div>
      )}

      {/* Failed / Expired */}
      {(state === 'failed' || state === 'expired') && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
            <XCircle className="h-4 w-4" />
            {errorMsg || 'Signing failed. Please retry.'}
          </div>
          <button
            id="esign-retry-btn"
            type="button"
            onClick={() => { setState('idle'); setSession(null); setErrorMsg(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors w-fit"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Signing
          </button>
        </div>
      )}

      {/* Sandbox Simulation Modal */}
      {showSimModal && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#041b0f] border border-emerald-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-4 border-b border-emerald-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Digio Aadhaar e-Sign</h3>
                  <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">Sandbox Simulation Mode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-sm">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Signer Name</span>
                  <span className="font-semibold text-white">{employeeName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Registered Mobile</span>
                  <span className="font-mono text-emerald-300">+91 {mobile}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Document</span>
                  <span className="text-slate-200">Employment Contract & Client NDA</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Auth Method</span>
                  <span className="text-emerald-400 font-medium">Aadhaar OTP (Simulated)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 leading-relaxed">
                ⚡ Digio API keys are currently pending. This instant simulation signs the agreement with simulated Aadhaar OTP verification so you can submit your onboarding application immediately.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 text-slate-300 text-xs font-semibold hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSimSigning}
                onClick={async () => {
                  setIsSimSigning(true);
                  await new Promise((r) => setTimeout(r, 600));
                  await handleConfirmStatus(session.requestId);
                  setIsSimSigning(false);
                  setShowSimModal(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {isSimSigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Sign Agreement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ESignFlow;
