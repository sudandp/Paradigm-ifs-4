import React, { useCallback, useEffect, useState } from 'react';
import { X, History, Loader2, Clock, CheckCircle2, XCircle, Download, RefreshCw, KeyRound } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { ONBOARDING_EXPORT_RECORD_ID, parseAccessComments } from '@/utils/reportAccess';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  /** Admins see every user's export activity (and passcodes); others see only their own. */
  isAdminView: boolean;
}

type Status = 'Pending' | 'Approved' | 'Rejected';

interface RequestRow {
  id: string;
  status: Status;
  comments: string | null;
  created_at: string;
  updated_at: string | null;
  requested_by: string | null;
  approver_id: string | null;
}

interface DownloadRow {
  id: string;
  user_id: string | null;
  created_at: string;
  diff: any;
}

type LogEntry =
  | { kind: 'request'; at: string; row: RequestRow }
  | { kind: 'download'; at: string; row: DownloadRow };

const withTimeout = <T,>(p: PromiseLike<T>, ms = 10000): Promise<T> =>
  Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
  ]);

const fmt = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_STYLE: Record<Status, { cls: string; icon: React.ElementType }> = {
  Pending: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  Approved: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  Rejected: { cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
};

/**
 * Access log for onboarding Excel exports: each request (who, when, why), its
 * approval/rejection (by whom, when, note), and each actual download.
 * Download rows come from audit_logs, which only admins can read.
 */
export const ExportAccessLog: React.FC<Props> = ({ open, onClose, userId, isAdminView }) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    let reqQuery = supabase
      .from('ops_approval_requests')
      .select('id, status, comments, created_at, updated_at, requested_by, approver_id')
      .eq('module_name', 'ReportAccess')
      .eq('record_id', ONBOARDING_EXPORT_RECORD_ID)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!isAdminView) reqQuery = reqQuery.eq('requested_by', userId);

    let dlQuery = supabase
      .from('audit_logs')
      .select('id, user_id, created_at, diff')
      .eq('table_name', 'onboarding_submissions')
      .eq('action', 'export_excel')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!isAdminView) dlQuery = dlQuery.eq('user_id', userId);

    const [reqRes, dlRes] = await Promise.allSettled([
      withTimeout(reqQuery.then(({ data, error: e }) => { if (e) throw e; return (data || []) as RequestRow[]; })),
      withTimeout(dlQuery.then(({ data, error: e }) => { if (e) throw e; return (data || []) as DownloadRow[]; })),
    ]);

    const requests = reqRes.status === 'fulfilled' ? reqRes.value : [];
    const downloads = dlRes.status === 'fulfilled' ? dlRes.value : [];
    if (reqRes.status === 'rejected') {
      console.error('[ExportAccessLog] requests failed:', reqRes.reason);
      setError((reqRes.reason as any)?.message || 'Could not load requests.');
    }

    const merged: LogEntry[] = [
      ...requests.map(r => ({ kind: 'request' as const, at: r.created_at, row: r })),
      ...downloads.map(d => ({ kind: 'download' as const, at: d.created_at, row: d })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setEntries(merged);

    // Resolve requester / approver / downloader names in one lookup.
    const ids = [...new Set([
      ...requests.flatMap(r => [r.requested_by, r.approver_id]),
      ...downloads.map(d => d.user_id),
    ].filter(Boolean) as string[])];
    if (ids.length > 0) {
      try {
        const { data } = await withTimeout(supabase.from('users').select('id, name').in('id', ids));
        const map: Record<string, string> = {};
        (data || []).forEach((u: any) => { map[u.id] = u.name; });
        setNames(map);
      } catch { /* names are optional */ }
    }
    setLoading(false);
  }, [isAdminView, userId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const nameOf = (id?: string | null) => (id && names[id]) || (id ? 'User' : '-');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-[#092c19] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#134426]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-[#134426]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200"><History className="w-4 h-4" /></div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Access Log</h3>
              <p className="text-xs text-slate-500 dark:text-white/60">
                {isAdminView ? 'All onboarding export requests, approvals and downloads' : 'Your export requests, approvals and downloads'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#134426] cursor-pointer" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#134426] cursor-pointer" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Couldn't load requests: {error}
            </div>
          )}
          {loading && entries.length === 0 ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No export activity yet.</p>
          ) : (
            <ol className="relative border-l-2 border-slate-200 dark:border-[#134426] ml-2 space-y-4">
              {entries.map(entry => {
                if (entry.kind === 'download') {
                  const d = entry.row;
                  return (
                    <li key={`d-${d.id}`} className="ml-4">
                      <span className="absolute -left-[9px] mt-1 w-4 h-4 rounded-full bg-sky-100 border-2 border-sky-400" />
                      <div className="flex items-center gap-2 text-sm">
                        <Download className="w-4 h-4 text-sky-600" />
                        <span className="font-semibold text-slate-900 dark:text-white">Downloaded</span>
                        <span className="text-slate-500">by {nameOf(d.user_id)}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {fmt(d.created_at)}
                        {d.diff?.rows != null && <> · {d.diff.rows} record(s)</>}
                        {d.diff?.filters && <> · {d.diff.filters}</>}
                      </div>
                    </li>
                  );
                }

                const r = entry.row;
                const { reason, passcode, reviewerNote } = parseAccessComments(r.comments, r.status);
                const S = STATUS_STYLE[r.status] || STATUS_STYLE.Pending;
                const StatusIcon = S.icon;
                return (
                  <li key={`r-${r.id}`} className="ml-4">
                    <span className="absolute -left-[9px] mt-1 w-4 h-4 rounded-full bg-white border-2 border-emerald-400" />
                    <div className="rounded-xl border border-slate-200 dark:border-[#134426] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-semibold text-slate-900 dark:text-white">Requested</span>
                          <span className="text-slate-500"> by {nameOf(r.requested_by)}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${S.cls}`}>
                          <StatusIcon className="w-3 h-3" /> {r.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{fmt(r.created_at)}</div>
                      {reason && (
                        <div className="mt-2 text-xs text-slate-700 dark:text-white/80">
                          <span className="font-semibold">Reason:</span> {reason}
                        </div>
                      )}
                      {r.status !== 'Pending' && (
                        <div className={`mt-2 text-xs rounded-lg px-2.5 py-1.5 ${r.status === 'Approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                          <span className="font-semibold">{r.status} by {nameOf(r.approver_id)}</span> · {fmt(r.updated_at)}
                          {reviewerNote && <div className="mt-0.5">Note: {reviewerNote}</div>}
                          {r.status === 'Approved' && isAdminView && passcode && (
                            <div className="mt-0.5 flex items-center gap-1">
                              <KeyRound className="w-3 h-3" /> Passcode <span className="font-mono font-bold tracking-wider">{passcode}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {!isAdminView && (
            <p className="mt-4 text-[11px] text-slate-400">Download entries are visible to admins.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportAccessLog;
