import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Lock, Loader2, X, KeyRound, Clock, CheckCircle2, XCircle, Send, History } from 'lucide-react';
import { ExportAccessLog } from './ExportAccessLog';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { isAdmin } from '@/utils/auth';
import {
  ONBOARDING_EXPORT_RECORD_ID,
  REPORT_UNLOCK_WINDOW_MS,
  extractPasscode,
  generateDeterministicPasscode,
  parseAccessComments,
} from '@/utils/reportAccess';

interface AccessRequest {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  comments?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface Props {
  /** Runs the actual Excel export. Only called once the user is allowed to export.
   *  Return false if nothing was exported (so no download is logged). */
  onExport: () => Promise<boolean | void>;
  /** Number of rows that will be exported (shown on the button). */
  rowCount: number;
  /** Short description of active filters, recorded in the access log. */
  filtersLabel?: string;
}

const storageKey = (userId: string) => `onboarding_export_unlocked_${userId}`;

/**
 * Excel export for onboarding submissions, gated by the same passcode approval flow
 * used for attendance reports: request → admin approves in Approvals Inbox → user
 * receives a 6-digit passcode by notification → enters it here → export unlocked for 2h.
 * Admins bypass the gate.
 */
export const OnboardingExportButton: React.FC<Props> = ({ onExport, rowCount, filtersLabel }) => {
  const { user } = useAuthStore();
  const bypass = !!user && isAdmin(user.role);

  const [open, setOpen] = useState(false);
  const [latestRequest, setLatestRequest] = useState<AccessRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [unlockedUntil, setUnlockedUntil] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const isUnlocked = bypass || unlockedUntil > Date.now();

  // Restore unlock state (valid only while not expired).
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(storageKey(user.id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { requestId: string; until: number };
      if (parsed?.until > Date.now()) setUnlockedUntil(parsed.until);
      else localStorage.removeItem(storageKey(user.id));
    } catch { /* ignore */ }
  }, [user?.id]);

  // Request id we already auto-opened the dialog for (so it pops up once per approval).
  const autoOpenedForRef = useRef<string | null>(null);

  const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
    Promise.race([
      Promise.resolve(p),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ]);

  /**
   * Status comes from two sources, whichever answers:
   *  1. the ops_approval_requests row (authoritative), and
   *  2. the approval/rejection notification sent to the user (contains the passcode).
   * The notification fallback keeps the dialog working even if (1) is slow.
   */
  const fetchLatestRequest = useCallback(async () => {
    if (!user?.id || bypass) return;
    setLoadingRequest(true);
    setLoadError('');

    const requestQuery = withTimeout(
      supabase
        .from('ops_approval_requests')
        .select('id, status, comments, created_at, updated_at')
        .eq('requested_by', user.id)
        .eq('module_name', 'ReportAccess')
        .eq('record_id', ONBOARDING_EXPORT_RECORD_ID)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data, error: err }) => {
          if (err) throw err;
          return ((data && data[0]) as AccessRequest | undefined) || null;
        }),
      10000
    );

    const notificationQuery = withTimeout(
      supabase
        .from('notifications')
        .select('id, message, created_at, metadata')
        .eq('user_id', user.id)
        .ilike('message', '%Onboarding Submissions Export%')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data, error: err }) => {
          if (err) throw err;
          const n: any = data && data[0];
          if (!n) return null;
          const msg: string = n.message || '';
          const code = msg.match(/passcode\s+(\d{6})/i)?.[1];
          if (/approved/i.test(msg) && code) {
            return {
              id: n.metadata?.requestId || `notif-${n.id}`,
              status: 'Approved',
              comments: `Passcode: ${code}`,
              created_at: n.created_at,
              updated_at: n.created_at,
            } as AccessRequest;
          }
          if (/rejected/i.test(msg)) {
            return {
              id: n.metadata?.requestId || `notif-${n.id}`,
              status: 'Rejected',
              comments: msg.split(/Reason:/i)[1]?.trim() || null,
              created_at: n.created_at,
              updated_at: n.created_at,
            } as AccessRequest;
          }
          return null;
        }),
      10000
    );

    const [reqResult, notifResult] = await Promise.allSettled([requestQuery, notificationQuery]);
    const fromRequest = reqResult.status === 'fulfilled' ? reqResult.value : null;
    const fromNotif = notifResult.status === 'fulfilled' ? notifResult.value : null;

    // Prefer the request row; use the notification if the row is missing/slow or
    // the notification is newer (e.g. approval landed but the row read lagged).
    let req: AccessRequest | null = fromRequest;
    if (fromNotif) {
      const notifTime = new Date(fromNotif.updated_at || fromNotif.created_at).getTime();
      const reqTime = fromRequest ? new Date(fromRequest.updated_at || fromRequest.created_at).getTime() : 0;
      if (!fromRequest || (fromRequest.status === 'Pending' && notifTime >= new Date(fromRequest.created_at).getTime()) || notifTime > reqTime) {
        req = fromNotif;
      }
    }

    if (reqResult.status === 'rejected' && notifResult.status === 'rejected') {
      console.error('[OnboardingExport] Failed to load access status:', reqResult.reason, notifResult.reason);
      setLoadError((reqResult.reason as any)?.message || 'Could not check request status.');
    }

    setLatestRequest(req);

    // If the admin revoked/rejected after unlock, lock again.
    if (req && req.status !== 'Approved') {
      setUnlockedUntil(0);
      try { localStorage.removeItem(storageKey(user.id)); } catch { /* ignore */ }
    }
    setLoadingRequest(false);
  }, [user?.id, bypass]);

  // Watch in the background (dialog open or not): initial check + live updates on
  // both the request row and the user's notifications.
  useEffect(() => {
    if (!user?.id || bypass) return;
    fetchLatestRequest();
    const channel = supabase
      .channel(`onboarding-export-access-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ops_approval_requests', filter: `requested_by=eq.${user.id}` },
        () => fetchLatestRequest()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if ((payload?.new?.message || '').includes('Onboarding Submissions Export')) fetchLatestRequest();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, bypass, fetchLatestRequest]);

  // Re-check whenever the dialog is opened.
  useEffect(() => {
    if (open) fetchLatestRequest();
  }, [open, fetchLatestRequest]);

  const approvedAt = latestRequest?.status === 'Approved'
    ? new Date(latestRequest.updated_at || latestRequest.created_at).getTime()
    : 0;
  const approvalExpired = approvedAt > 0 && Date.now() - approvedAt > REPORT_UNLOCK_WINDOW_MS;
  const canEnterPasscode = latestRequest?.status === 'Approved' && !approvalExpired;
  const isPending = latestRequest?.status === 'Pending';

  // Approval arrived → pop the dialog open once with the passcode filled in.
  useEffect(() => {
    if (!canEnterPasscode || !latestRequest || isUnlocked) return;
    if (autoOpenedForRef.current === latestRequest.id) return;
    autoOpenedForRef.current = latestRequest.id;
    setPasscode(extractPasscode(latestRequest.comments) || generateDeterministicPasscode(latestRequest.id));
    setError('');
    setOpen(true);
  }, [canEnterPasscode, latestRequest, isUnlocked]);

  const notifyAdmins = async () => {
    try {
      const { data: admins } = await supabase.from('users').select('id').in('role_id', ['admin', 'super_admin']);
      if (!admins || admins.length === 0) return;
      const adminIds = admins.map((a: any) => a.id);
      const message = `${user?.name || 'User'} requested passcode for Onboarding Submissions Export`;
      const link = '/enterprise/approvals';
      await supabase.from('notifications').insert(adminIds.map((adminId: string) => ({
        user_id: adminId,
        message,
        type: 'approval_request',
        link_to: link,
        severity: 'High',
        metadata: { employeeName: user?.name, employeePhoto: (user as any)?.photoUrl, employeeId: user?.id, link },
      })));
      await supabase.functions.invoke('send-notification', {
        body: { userIds: adminIds, title: 'Report Passcode Request', message, data: { link, employeeId: user?.id } },
      });
    } catch (e) {
      console.error('[OnboardingExport] Failed to notify admins:', e);
    }
  };

  const handleRequest = async () => {
    if (!user?.id || submitting) return;
    const text = reason.trim();
    if (!text) { setError('Please enter a reason for the export.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { error: err } = await supabase.from('ops_approval_requests').insert({
        module_name: 'ReportAccess',
        record_id: ONBOARDING_EXPORT_RECORD_ID,
        title: `Access Request: Onboarding Submissions Export for ${user.name}`,
        required_role: 'admin',
        requested_by: user.id,
        approval_stage: 1,
        status: 'Pending',
        comments: text,
      });
      if (err) throw err;
      setReason('');
      await notifyAdmins();
      await fetchLatestRequest();
    } catch (e: any) {
      setError(e?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = () => {
    if (!latestRequest || !user?.id) return;
    const expected = extractPasscode(latestRequest.comments) || generateDeterministicPasscode(latestRequest.id);
    if (passcode.trim() !== expected) {
      setError('Invalid passcode. Check the code sent to you in notifications.');
      return;
    }
    const until = approvedAt + REPORT_UNLOCK_WINDOW_MS;
    setUnlockedUntil(until);
    try { localStorage.setItem(storageKey(user.id), JSON.stringify({ requestId: latestRequest.id, until })); } catch { /* ignore */ }
    setPasscode('');
    setError('');
    // Passcode accepted — start the download straight away.
    void runExport();
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const ok = await onExport();
      setOpen(false);
      if (ok !== false && user?.id) {
        // Record the download in the access log (audit_logs; readable by admins).
        void supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'export_excel',
          table_name: 'onboarding_submissions',
          record_id: latestRequest?.id && !latestRequest.id.startsWith('notif-') ? latestRequest.id : null,
          diff: {
            rows: rowCount,
            filters: filtersLabel || null,
            viaApproval: !bypass,
            requestId: latestRequest?.id || null,
          },
        }).then(({ error: e }) => { if (e) console.warn('[OnboardingExport] Failed to log download:', e); });
      }
    } finally {
      setExporting(false);
    }
  };

  const minutesLeft = Math.max(0, Math.round((unlockedUntil - Date.now()) / 60000));

  return (
    <>
      <button
        onClick={() => setShowLog(true)}
        className="px-2.5 py-2.5 bg-white hover:bg-slate-100 dark:bg-[#092c19] dark:hover:bg-[#134426] text-slate-700 dark:text-white rounded-xl text-xs font-bold transition-all duration-200 flex items-center border border-slate-200 dark:border-[#134426] shadow-xs cursor-pointer"
        title="Export access log: requests, approvals and downloads"
      >
        <History className="w-3.5 h-3.5 text-slate-500" />
      </button>
      {user?.id && (
        <ExportAccessLog open={showLog} onClose={() => setShowLog(false)} userId={user.id} isAdminView={bypass} />
      )}
      <button
        onClick={() => (isUnlocked ? runExport() : setOpen(true))}
        disabled={exporting}
        className="px-3.5 py-2.5 bg-white hover:bg-slate-100 dark:bg-[#092c19] dark:hover:bg-[#134426] text-slate-700 dark:text-white rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border border-slate-200 dark:border-[#134426] shadow-xs cursor-pointer disabled:opacity-60"
        title={
          !isUnlocked
            ? 'Export requires admin approval'
            : bypass
              ? 'Export filtered submissions to Excel'
              : `Export unlocked — ${minutesLeft} min left`
        }
      >
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isUnlocked ? <Download className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
        Export Excel ({rowCount})
      </button>

      {open && !isUnlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#092c19] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#134426] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200"><Lock className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Export locked</h3>
                  <p className="text-xs text-slate-500 dark:text-white/60">Excel export needs admin approval and a passcode.</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#134426] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {loadError && (
              <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                <span>Couldn't check approval status: {loadError}</span>
                <button onClick={fetchLatestRequest} className="underline cursor-pointer shrink-0">Retry</button>
              </div>
            )}
            {loadingRequest && !latestRequest && !loadError ? (
              <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
            ) : canEnterPasscode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" /> Approved! Your passcode is filled in. Click Unlock to download.
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={passcode}
                      onChange={(e) => { setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                      inputMode="numeric"
                      placeholder="Passcode"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-[#134426] bg-white dark:bg-[#041b0f] font-mono tracking-widest text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button onClick={handleUnlock} disabled={passcode.length !== 6} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">Unlock</button>
                </div>
                <p className="text-[11px] text-slate-500">Export stays unlocked until 2 hours after approval.</p>
              </div>
            ) : isPending ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4" /> Request sent {new Date(latestRequest!.created_at).toLocaleString()}. Waiting for admin approval.
                </div>
                <p className="text-[11px] text-slate-500">This dialog updates automatically when the admin approves.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {latestRequest?.status === 'Rejected' && (
                  <div className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    <XCircle className="w-4 h-4 shrink-0" /> Last request was rejected{(() => { const note = parseAccessComments(latestRequest.comments, 'Rejected').reviewerNote; return note ? `: ${note}` : '.'; })()}
                  </div>
                )}
                {approvalExpired && (
                  <div className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    Your previous approval has expired. Request a new passcode.
                  </div>
                )}
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setError(''); }}
                  rows={3}
                  placeholder="Reason for exporting onboarding data…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#134426] bg-white dark:bg-[#041b0f] text-sm focus:outline-none focus:border-emerald-500"
                />
                <button onClick={handleRequest} disabled={submitting || !reason.trim()} className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Request Passcode
                </button>
              </div>
            )}

            {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default OnboardingExportButton;
