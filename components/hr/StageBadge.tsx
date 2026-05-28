import React from 'react';
import { CandidateStage } from '../../types';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface StageBadgeProps {
  stage: CandidateStage;
  className?: string;
}

const STAGE_CONFIGS: Record<CandidateStage, {
  bgLight: string; textLight: string; borderLight: string;
  bgDark: string; textDark: string; borderDark: string;
  label: string;
}> = {
  new: {
    bgLight: 'bg-slate-50',
    textLight: 'text-slate-700',
    borderLight: 'border-slate-200',
    bgDark: 'bg-slate-500/10',
    textDark: 'text-slate-300',
    borderDark: 'border-slate-500/20',
    label: 'New Lead'
  },
  contacted: {
    bgLight: 'bg-blue-50',
    textLight: 'text-blue-700',
    borderLight: 'border-blue-200',
    bgDark: 'bg-blue-500/10',
    textDark: 'text-blue-400',
    borderDark: 'border-blue-500/20',
    label: 'Contacted'
  },
  screened: {
    bgLight: 'bg-amber-50',
    textLight: 'text-amber-700',
    borderLight: 'border-amber-200',
    bgDark: 'bg-amber-500/10',
    textDark: 'text-amber-400',
    borderDark: 'border-amber-500/20',
    label: 'Screened'
  },
  interview: {
    bgLight: 'bg-cyan-50',
    textLight: 'text-cyan-700',
    borderLight: 'border-cyan-200',
    bgDark: 'bg-cyan-500/10',
    textDark: 'text-cyan-400',
    borderDark: 'border-cyan-500/20',
    label: 'Interview'
  },
  shortlisted: {
    bgLight: 'bg-teal-50',
    textLight: 'text-teal-700',
    borderLight: 'border-teal-200',
    bgDark: 'bg-teal-500/10',
    textDark: 'text-teal-400',
    borderDark: 'border-teal-500/20',
    label: 'Shortlisted'
  },
  offer: {
    bgLight: 'bg-orange-50',
    textLight: 'text-orange-700',
    borderLight: 'border-orange-200',
    bgDark: 'bg-orange-500/10',
    textDark: 'text-orange-400',
    borderDark: 'border-orange-500/20',
    label: 'Offer Out'
  },
  joined: {
    bgLight: 'bg-emerald-50',
    textLight: 'text-emerald-700',
    borderLight: 'border-emerald-200',
    bgDark: 'bg-emerald-500/10',
    textDark: 'text-emerald-400',
    borderDark: 'border-emerald-500/20',
    label: 'Joined'
  },
  rejected: {
    bgLight: 'bg-red-50',
    textLight: 'text-red-700',
    borderLight: 'border-red-200',
    bgDark: 'bg-red-500/10',
    textDark: 'text-red-400',
    borderDark: 'border-red-500/20',
    label: 'Rejected'
  }
};

const StageBadge: React.FC<StageBadgeProps> = ({ stage, className = '' }) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const config = STAGE_CONFIGS[stage] || STAGE_CONFIGS.new;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
        isMobile
          ? `${config.bgDark} ${config.textDark} ${config.borderDark}`
          : `${config.bgLight} ${config.textLight} ${config.borderLight}`
      } ${className}`}
    >
      {config.label}
    </span>
  );
};

export default StageBadge;
