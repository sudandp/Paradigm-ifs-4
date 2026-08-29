import React from 'react';
import type { OnboardingData } from '../../types';

interface StatusChipProps {
  status: OnboardingData['status'];
}

const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const statusStyles: Record<OnboardingData['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200',
    draft: 'bg-slate-100 text-slate-800 border-slate-300',
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
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${styleClass} uppercase tracking-wider shadow-2xs`}>
      <span className="text-[9px]">{icon}</span>
      <span>{status}</span>
    </span>
  );
};

export default StatusChip;