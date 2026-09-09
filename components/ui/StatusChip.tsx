import React from 'react';
import type { OnboardingData } from '../../types';

interface StatusChipProps {
  status: OnboardingData['status'];
}

const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const statusStyles: Record<OnboardingData['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    verified: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    draft: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-[#041b0f] dark:text-white/70 dark:border-[#134426]',
  };

  const statusIcons: Partial<Record<OnboardingData['status'], string>> = {
    pending: '⏳',
    verified: '✓',
    rejected: '✕',
    draft: '📝',
  };

  const styleClass = statusStyles[status] || statusStyles.draft;
  const icon = statusIcons[status] || '•';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${styleClass} uppercase tracking-wider shadow-sm`}>
      <span className="text-[9px] opacity-80">{icon}</span>
      <span>{status}</span>
    </span>
  );
};

export default StatusChip;