import React from 'react';
import { Database, Globe, Lock, ExternalLink, Check, Compass, ArrowRight, Paperclip, Camera, Loader2 } from 'lucide-react';
import type {
  AssistAction,
  AssistMessage,
  AssistRoute,
  AssistClarification,
  AssistClarificationOption,
  AssistTable,
  AssistUpload,
  AssistWebSource
} from '../../store/assistStore';
import { openExternal } from '../../utils/urlHandler';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { compressImageFile, CLIENT_COMPRESSION_PRESETS } from '../../utils/imageCompression';

/**
 * Reusable pieces for Paradigm Assist role-aware data answers (route / sourceBadge / clarification /
 * denied / table / webSources). Every prop is optional-tolerant: messages reloaded from server history
 * carry none of these fields, and each part then renders nothing.
 *
 * `tone` = 'dark' matches the full-page assistant (#212121 background, #ececec text);
 * 'light' is for light surfaces such as the copilot drawer in light theme.
 */
export type DataPartTone = 'dark' | 'light';

/** True when the server answered from the database or the web (the source badge replaces "Verified Grounding"). */
export const isDataOrWebRoute = (route?: AssistRoute | string | null): boolean =>
  route === 'database' || route === 'web';

/** Whether a message carries any data-answer extras worth rendering. */
export const hasDataAnswerParts = (msg: Partial<AssistMessage>): boolean =>
  !!(msg.sourceBadge || isDataOrWebRoute(msg.route) || msg.clarification || msg.denied || msg.table || (msg.webSources && msg.webSources.length) || (msg.actions && msg.actions.length));

// ── Source badge ──────────────────────────────────────────────────────────────
export const SourceBadge: React.FC<{ route?: AssistRoute; text?: string; tone?: DataPartTone; className?: string }> = ({
  route,
  text,
  tone = 'dark',
  className = ''
}) => {
  if (route !== 'database' && route !== 'web') return null;
  const isDb = route === 'database';
  const isGuide = isDb && !!text && /^App guide/i.test(text.trim());
  const Icon = isGuide ? Compass : isDb ? Database : Globe;
  const label = text && text.trim() ? text.trim() : isDb ? 'Paradigm database' : 'From the web';

  const toneCls = isDb
    ? tone === 'dark'
      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : tone === 'dark'
      ? 'bg-sky-500/10 border-sky-500/25 text-sky-300'
      : 'bg-sky-50 border-sky-200 text-sky-700';

  return (
    <div
      className={`inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold leading-tight ${toneCls} ${className}`}
      title={label}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </div>
  );
};

// ── Web sources ───────────────────────────────────────────────────────────────
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const WebSources: React.FC<{ sources?: AssistWebSource[]; tone?: DataPartTone; className?: string }> = ({
  sources,
  tone = 'dark',
  className = ''
}) => {
  if (!sources || sources.length === 0) return null;
  const linkCls = tone === 'dark'
    ? 'bg-white/5 border-white/10 text-sky-300 hover:bg-white/10 hover:text-sky-200'
    : 'bg-slate-50 border-slate-200 text-sky-700 hover:bg-slate-100';
  const labelCls = tone === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`flex flex-wrap gap-1.5 items-center ${className}`}>
      <span className={`text-[10px] uppercase tracking-wider font-bold mr-1 ${labelCls}`}>Sources:</span>
      {sources.map((src, i) => (
        <a
          key={`${src.url}_${i}`}
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Opens in a new tab on web and in the in-app browser on Capacitor native.
            e.preventDefault();
            openExternal(src.url);
          }}
          className={`inline-flex max-w-full items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${linkCls}`}
          title={src.url}
        >
          <span className="truncate max-w-[14rem]">{src.title || hostOf(src.url)}</span>
          <span className="opacity-60 hidden sm:inline">· {hostOf(src.url)}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
};

// ── Denied ────────────────────────────────────────────────────────────────────
export const DeniedNotice: React.FC<{ tone?: DataPartTone; className?: string; children: React.ReactNode }> = ({
  tone = 'dark',
  className = '',
  children
}) => {
  const cls = tone === 'dark'
    ? 'bg-white/[0.03] border-white/10 text-slate-300'
    : 'bg-slate-50 border-slate-200 text-slate-600';
  const iconCls = tone === 'dark' ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500';
  return (
    <div className={`flex gap-3 items-start px-3.5 py-3 rounded-2xl border ${cls} ${className}`} role="note">
      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${iconCls}`}>
        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">{children}</div>
    </div>
  );
};

// ── Clarification chips ───────────────────────────────────────────────────────
export const ClarificationChips: React.FC<{
  clarification?: AssistClarification;
  /** Already answered (chips disabled; chosen one highlighted). */
  resolved?: boolean;
  /** Label of the chosen option. */
  chosenLabel?: string;
  /** Temporarily disable (e.g. while a request is in flight). */
  disabled?: boolean;
  onSelect?: (option: AssistClarificationOption) => void;
  /** Show the clarification question above the chips (hide it when the message body already says it). */
  showQuestion?: boolean;
  tone?: DataPartTone;
  className?: string;
}> = ({ clarification, resolved, chosenLabel, disabled, onSelect, showQuestion = true, tone = 'dark', className = '' }) => {
  const questionId = React.useId();
  if (!clarification || !clarification.options || clarification.options.length === 0) return null;
  const isLocked = !!resolved || !!disabled;
  const dark = tone === 'dark';

  return (
    <div className={`space-y-2 ${className}`}>
      {showQuestion && clarification.question && (
        <p id={questionId} className={`text-[13px] font-medium ${dark ? 'text-[#ececec]' : 'text-slate-700'}`}>
          {clarification.question}
        </p>
      )}
      <div
        role="group"
        aria-labelledby={showQuestion && clarification.question ? questionId : undefined}
        aria-label={showQuestion && clarification.question ? undefined : 'Choose an option'}
        className="flex flex-wrap gap-2"
      >
        {clarification.options.map((opt, i) => {
          const isChosen = !!resolved && !!chosenLabel && opt.label === chosenLabel;
          const base = 'group inline-flex max-w-full min-h-[40px] items-center gap-2 px-3.5 py-2 rounded-2xl border text-left text-[13px] leading-snug transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70';
          let toneCls: string;
          if (isChosen) {
            toneCls = dark
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
              : 'bg-emerald-50 border-emerald-400 text-emerald-800';
          } else if (isLocked) {
            toneCls = dark
              ? 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed';
          } else {
            toneCls = dark
              ? 'bg-white/5 border-white/10 text-[#ececec] hover:bg-emerald-500/10 hover:border-emerald-500/40 cursor-pointer'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer';
          }
          const subCls = isChosen
            ? dark ? 'text-emerald-300/80' : 'text-emerald-700/80'
            : dark ? 'text-slate-400' : 'text-slate-500';

          return (
            <button
              key={`${opt.label}_${i}`}
              type="button"
              disabled={isLocked}
              aria-pressed={isChosen}
              onClick={() => !isLocked && onSelect?.(opt)}
              className={`${base} ${toneCls}`}
            >
              {isChosen && <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />}
              <span className="min-w-0">
                <span className="font-semibold break-words">{opt.label}</span>
                {opt.sublabel && (
                  <span className={`block text-[11px] font-normal break-words ${subCls}`}>{opt.sublabel}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── Upload certificate (Sick Leave) ───────────────────────────────────────────
/**
 * File picker + camera for the Sick Leave medical certificate. Mirrors the Apply Leave form:
 * images are compressed with the same DOCUMENT preset, the size limit is checked after compression, and the file is uploaded
 * with the user's OWN Supabase session through api.uploadDocument(file, 'onboarding-documents')
 * → `${userId}/documents/${timestamp}/${name}`. The server re-verifies the path/object before using it.
 */
const SAFE_NAME = (name: string) => {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : '';
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'certificate';
  return ext ? `${base}.${ext}` : base;
};

export const UploadCertificate: React.FC<{
  upload?: AssistUpload;
  /** Already answered / not the latest step: render nothing. */
  resolved?: boolean;
  disabled?: boolean;
  onUploaded?: (path: string, fileName: string) => void;
  tone?: DataPartTone;
  className?: string;
}> = ({ upload, resolved, disabled, onUploaded, tone = 'dark', className = '' }) => {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const camRef = React.useRef<HTMLInputElement>(null);
  const [phase, setPhase] = React.useState<'idle' | 'preparing' | 'uploading' | 'done'>('idle');
  const [error, setError] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [lastFile, setLastFile] = React.useState<File | null>(null);
  if (!upload || resolved) return null;
  const dark = tone === 'dark';
  const busy = phase === 'preparing' || phase === 'uploading';
  const locked = !!disabled || busy || phase === 'done';
  const allowed = upload.accept.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const maxBytes = upload.maxMb * 1024 * 1024;

  const run = async (raw: File) => {
    setError(''); setLastFile(raw); setFileName(raw.name);
    const t = (raw.type || '').toLowerCase();
    const extOk = /\.(jpe?g|png|webp|pdf)$/i.test(raw.name);
    // phone cameras may give HEIC/odd image types: any raster image is accepted and re-encoded by the compressor, like the app form
    if (!(allowed.includes(t) || (t.startsWith('image/') && !t.includes('svg') && !t.includes('gif')) || (!t && extOk))) {
      setError('Only JPG, PNG or PDF files are accepted.'); return;
    }
    try {
      setPhase('preparing');
      let file = raw;
      if (t.startsWith('image/')) {
        try { file = await compressImageFile(raw, CLIENT_COMPRESSION_PRESETS.DOCUMENT); } catch { file = raw; }
      }
      if (file.size > maxBytes) { setPhase('idle'); setError(`File size must be less than ${upload.maxMb} MB.`); return; }
      if (file.size === 0) { setPhase('idle'); setError('That file looks empty. Please choose another one.'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setPhase('idle'); setError('Your session has expired. Please sign in again.'); return; }
      setPhase('uploading');
      const safe = new File([file], SAFE_NAME(file.name), { type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') });
      const { path } = await api.uploadDocument(safe, 'onboarding-documents');
      if (!path || !path.startsWith(`${session.user.id}/`)) throw new Error('Upload did not return a valid file path.');
      setPhase('done');
      onUploaded?.(path, safe.name);
    } catch (e: any) {
      setPhase('idle');
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setError(offline ? 'You are offline. Please reconnect and try again.' : `Upload failed${e?.message ? ` (${String(e.message).slice(0, 120)})` : ''}. Please try again.`);
    }
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (f) void run(f);
  };
  const btn = `inline-flex min-h-[40px] items-center justify-center gap-2 px-3.5 py-2 rounded-2xl border text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
    locked
      ? (dark ? 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed')
      : (dark ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer' : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer')}`;

  return (
    <div className={`space-y-2 ${className}`} role="group" aria-label={upload.label}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={locked} onClick={() => fileRef.current?.click()}>
          <Paperclip className="w-4 h-4" aria-hidden="true" /> Upload certificate
        </button>
        <button type="button" className={btn} disabled={locked} onClick={() => camRef.current?.click()}>
          <Camera className="w-4 h-4" aria-hidden="true" /> Take photo
        </button>
      </div>
      <input ref={fileRef} type="file" accept={upload.accept} className="hidden" onChange={onPick} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <p className={`text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>JPG, PNG or PDF · up to {upload.maxMb} MB</p>
      {busy && (
        <div role="status" aria-live="polite" className={`text-[12px] ${dark ? 'text-emerald-200' : 'text-emerald-800'}`}>
          <div className={`h-1.5 w-full overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-emerald-100'}`}>
            <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-500" />
          </div>
          <span className="mt-1 inline-flex items-center gap-1.5 break-all"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            {phase === 'preparing' ? 'Preparing' : 'Uploading'} {fileName}…</span>
        </div>
      )}
      {phase === 'done' && <p className={`text-[12px] break-all ${dark ? 'text-emerald-200' : 'text-emerald-800'}`}><Check className="inline w-3.5 h-3.5 mr-1" aria-hidden="true" />Uploaded {fileName}</p>}
      {error && (
        <div role="alert" className={`flex flex-wrap items-center gap-2 text-[12px] ${dark ? 'text-red-300' : 'text-red-600'}`}>
          <span className="min-w-0 break-words">{error}</span>
          {lastFile && !busy && <button type="button" className={btn} disabled={!!disabled} onClick={() => void run(lastFile)}>Retry</button>}
        </div>
      )}
    </div>
  );
};

// ── Data table ────────────────────────────────────────────────────────────────
const isNumericCell = (v: string | number | null): boolean =>
  typeof v === 'number' || (typeof v === 'string' && /^[-+]?[₹$]?\s?[\d,]+(\.\d+)?%?$/.test(v.trim()));

export const DataTable: React.FC<{ table?: AssistTable; tone?: DataPartTone; className?: string; maxRows?: number }> = ({
  table,
  tone = 'dark',
  className = '',
  maxRows = 200
}) => {
  if (!table || !Array.isArray(table.columns) || table.columns.length === 0) return null;
  const rows = Array.isArray(table.rows) ? table.rows.slice(0, maxRows) : [];
  const dark = tone === 'dark';
  const wrapCls = dark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white';
  const headCls = dark ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-600';
  const rowCls = dark ? 'border-white/5 text-[#ececec]' : 'border-slate-100 text-slate-700';

  // Numeric columns are right-aligned when every non-empty cell looks numeric.
  const numericCols = table.columns.map((_, ci) => {
    const vals = rows.map(r => r[ci]).filter(v => v !== null && v !== undefined && v !== '');
    return vals.length > 0 && vals.every(v => isNumericCell(v as string | number));
  });

  return (
    <div className={`w-full max-w-full overflow-x-auto rounded-xl border ${wrapCls} ${className}`}>
      <table className="min-w-full text-[12px] border-collapse">
        <thead>
          <tr className={headCls}>
            {table.columns.map((col, ci) => (
              <th
                key={ci}
                scope="col"
                className={`px-3 py-2 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap ${numericCols[ci] ? 'text-right' : 'text-left'}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className={rowCls}>
              <td colSpan={table.columns.length} className="px-3 py-3 text-center opacity-70">No rows</td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} className={`border-t ${rowCls}`}>
                {table.columns.map((_, ci) => {
                  const v = row[ci];
                  return (
                    <td
                      key={ci}
                      className={`px-3 py-1.5 align-top whitespace-nowrap ${numericCols[ci] ? 'text-right tabular-nums' : 'text-left'}`}
                    >
                      {v === null || v === undefined || v === '' ? <span className="opacity-40">—</span> : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {Array.isArray(table.rows) && table.rows.length > rows.length && (
        <div className={`px-3 py-1.5 text-[10px] border-t ${rowCls} opacity-70`}>
          Showing {rows.length} of {table.rows.length} rows
        </div>
      )}
    </div>
  );
};

// ── In-app action buttons ("Open Apply Leave") ────────────────────────────────
/** Only in-app router paths are followed ("/leaves/apply", "/finance?tab=site"). */
const isInAppRoute = (route: unknown): route is string =>
  typeof route === 'string' && /^\/(?!\/)[^\s]*$/.test(route);

export const ActionButtons: React.FC<{
  actions?: AssistAction[];
  /** Called with the in-app route (e.g. react-router `navigate`). */
  onNavigate?: (route: string) => void;
  tone?: DataPartTone;
  className?: string;
}> = ({ actions, onNavigate, tone = 'dark', className = '' }) => {
  const valid = (actions || []).filter(a => a && typeof a.label === 'string' && isInAppRoute(a.route));
  if (valid.length === 0 || !onNavigate) return null;
  const dark = tone === 'dark';
  const cls = dark
    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25 hover:border-emerald-400/70'
    : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700';
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {valid.map((a, i) => (
        <button
          key={`${a.route}_${i}`}
          type="button"
          onClick={() => onNavigate(a.route)}
          className={`inline-flex max-w-full min-h-[40px] items-center gap-2 px-4 py-2 rounded-2xl border text-[13px] font-semibold leading-snug transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${cls}`}
        >
          <span className="break-words text-left">{a.label}</span>
          <ArrowRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
};
