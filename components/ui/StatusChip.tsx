import React from 'react';
import type { OnboardingData } from '../../types';

interface StatusChipProps {
  status: OnboardingData['status'];
}

const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const statusStyles: Record<OnboardingData['status'], string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    verified: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rejected: 'bg-rose-50 text-rose-700 border-rose-100',
    draft: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  const styleClass = statusStyles[status] || statusStyles.draft;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${styleClass} uppercase tracking-wider`}>
      {status}
    </span>
  );
};

export default StatusChip;