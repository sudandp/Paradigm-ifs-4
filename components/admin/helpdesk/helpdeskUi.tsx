import React from 'react';

export const inputCls =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-primary-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent';
export const labelCls = 'block text-xs font-semibold text-muted mb-1';
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary-text hover:bg-page disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors';
export const cardCls = 'rounded-xl border border-border bg-card';

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label, hint, children, className,
}) => (
  <label className={`block ${className || ''}`}>
    <span className={labelCls}>{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
  </label>
);

const badgeTones: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  gray: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const Badge: React.FC<{ tone?: keyof typeof badgeTones; children: React.ReactNode }> = ({ tone = 'gray', children }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeTones[tone]}`}>
    {children}
  </span>
);

export const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{children}</div>
);

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
