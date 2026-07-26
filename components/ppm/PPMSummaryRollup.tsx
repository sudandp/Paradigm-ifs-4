import React from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, CheckCircle, BarChart3 } from 'lucide-react';
import { PPMObservation, PPMSummaryCounts } from '../../types/ppm';

interface PPMSummaryRollupProps {
  observations: Record<string, PPMObservation>;
  onComplete: () => void;
}

export const PPMSummaryRollup: React.FC<PPMSummaryRollupProps> = ({ observations, onComplete }) => {
  
  // Compute counts
  const counts: PPMSummaryCounts = {
    critical: 0,
    major: 0,
    medium: 0,
    minor: 0,
    total: 0
  };

  let okCount = 0;
  let naCount = 0;

  Object.values(observations).forEach(obs => {
    if (!obs.severity) return;
    
    counts.total++;
    switch (obs.severity) {
      case 'CRITICAL': counts.critical++; break;
      case 'MAJOR': counts.major++; break;
      case 'MEDIUM': counts.medium++; break;
      case 'MINOR': counts.minor++; break;
      case 'OK': okCount++; break;
      case 'NA': naCount++; break;
    }
  });

  const cards = [
    { label: 'Critical Issues', count: counts.critical, icon: <ShieldAlert className="w-5 h-5" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
    { label: 'Major Issues', count: counts.major, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
    { label: 'Medium Issues', count: counts.medium, icon: <AlertCircle className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
    { label: 'Minor Issues', count: counts.minor, icon: <Info className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
    { label: 'OK / Verified', count: okCount, icon: <CheckCircle className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' }
  ];

  const issuesFound = counts.critical + counts.major + counts.medium + counts.minor > 0;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg overflow-hidden relative">
        <BarChart3 className="absolute -right-8 -bottom-8 w-48 h-48 text-slate-700/30 opacity-50 pointer-events-none" />
        
        <div className="relative z-10">
          <h3 className="text-2xl font-extrabold mb-2">Audit Summary Roll-up</h3>
          <p className="text-slate-300 max-w-lg mb-8">
            Review the severity distribution of your observations before submitting the audit. 
            {counts.critical > 0 && <span className="font-bold text-red-400 ml-1">Critical issues will automatically trigger Snag List entries.</span>}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {cards.map((card, idx) => (
              <div key={idx} className={`rounded-xl border p-4 ${card.bg} ${card.border}`}>
                <div className={`flex items-center gap-2 mb-3 ${card.color}`}>
                  {card.icon}
                  <span className="font-bold text-sm tracking-wide">{card.label}</span>
                </div>
                <div className={`text-4xl font-black ${card.color}`}>
                  {card.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 text-center shadow-sm">
        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          {issuesFound ? 'Ready to raise snags and complete audit?' : 'Excellent! No issues found.'}
        </h4>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
          By submitting this audit, any Critical or Major issues will be pushed to the operations dashboard for immediate resolution.
        </p>

        <button 
          onClick={onComplete}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
        >
          Submit Audit Report
        </button>
      </div>
    </div>
  );
};
