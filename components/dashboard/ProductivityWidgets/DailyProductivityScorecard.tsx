import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  Check, 
  Award, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle,
  Plus,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';

export interface DailyChecklistItem {
  id: string;
  task: string;
  category: string;
  weight: number;
  isCompleted: boolean;
  timeHint?: string;
}

const DEFAULT_TASKS: DailyChecklistItem[] = [
  {
    id: 'CHK-1',
    task: 'Verify Shift A Guard Muster & Biometric Punch Sync',
    category: 'Manpower & Security',
    weight: 20,
    isCompleted: true,
    timeHint: '08:30 AM'
  },
  {
    id: 'CHK-2',
    task: 'Inspect DG Diesel Reserve & Battery Voltage (DG-01 & DG-02)',
    category: 'Equipment & MEP',
    weight: 20,
    isCompleted: true,
    timeHint: '10:00 AM'
  },
  {
    id: 'CHK-3',
    task: 'Log STP/WTP Raw vs Treated Water pH & Residual Chlorine',
    category: 'Water & Utilities',
    weight: 20,
    isCompleted: true,
    timeHint: '11:30 AM'
  },
  {
    id: 'CHK-4',
    task: 'Execute Daily Scheduled PPM Tasks & Scan Asset QR Codes',
    category: 'Preventive Maintenance',
    weight: 20,
    isCompleted: false,
    timeHint: '02:00 PM'
  },
  {
    id: 'CHK-5',
    task: 'Verify Afternoon Shift Handover Log & Sign Gate Pass Register',
    category: 'Shift Handover',
    weight: 20,
    isCompleted: false,
    timeHint: '03:30 PM'
  }
];

export const DailyProductivityScorecard: React.FC<{
  siteName?: string;
}> = ({ siteName = 'All Assigned Sites' }) => {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<DailyChecklistItem[]>(() => {
    try {
      const todayKey = `paradigm_daily_tasks_${new Date().toISOString().split('T')[0]}`;
      const saved = localStorage.getItem(todayKey);
      return saved ? JSON.parse(saved) : DEFAULT_TASKS;
    } catch {
      return DEFAULT_TASKS;
    }
  });

  const saveTasks = (newTasks: DailyChecklistItem[]) => {
    setTasks(newTasks);
    try {
      const todayKey = `paradigm_daily_tasks_${new Date().toISOString().split('T')[0]}`;
      localStorage.setItem(todayKey, JSON.stringify(newTasks));
    } catch (e) {
      console.warn('Failed to save daily tasks', e);
    }
  };

  const handleToggle = (id: string) => {
    const updated = tasks.map(t => {
      if (t.id !== id) return t;
      return { ...t, isCompleted: !t.isCompleted };
    });
    saveTasks(updated);
  };

  const { score, completedCount, totalCount } = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.isCompleted).length;
    const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
    const earnedWeight = tasks.filter(t => t.isCompleted).reduce((sum, t) => sum + t.weight, 0);
    const calculatedScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
    return { score: calculatedScore, completedCount: completed, totalCount: total };
  }, [tasks]);

  // Color & status based on score
  const badgeConfig = useMemo(() => {
    if (score >= 80) {
      return {
        label: 'Optimal Operational Velocity',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        strokeColor: '#006B3F'
      };
    }
    if (score >= 50) {
      return {
        label: 'Satisfactory Progress',
        bg: 'bg-amber-50 text-amber-800 border-amber-300',
        strokeColor: '#D97706'
      };
    }
    return {
      label: 'Attention Required: Incomplete Duties',
      bg: 'bg-rose-50 text-rose-800 border-rose-300',
      strokeColor: '#E11D48'
    };
  }, [score]);

  // SVG circle calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006B3F] text-white flex items-center justify-center shadow-xs">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Daily Duty & Productivity Scorecard
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006B3F]">
                Today's Roster
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard operating checklist for site supervisors, MEP engineers, and back office.
            </p>
          </div>
        </div>
      </div>

      {/* Score Summary Gauge Banner */}
      <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Radial Progress Ring */}
          <div className="relative w-[88px] h-[88px] shrink-0 flex items-center justify-center">
            <svg 
              width="88" 
              height="88" 
              viewBox="0 0 88 88" 
              className="w-[88px] h-[88px] -rotate-90 overflow-visible"
            >
              <circle
                cx="44"
                cy="44"
                r={radius}
                className="stroke-slate-200"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="44"
                cy="44"
                r={radius}
                stroke={badgeConfig.strokeColor}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap={score === 0 ? 'butt' : 'round'}
                fill="none"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xl font-black text-slate-900 leading-none">
                {score}%
              </span>
              <span className="text-[10px] font-bold text-slate-500 mt-1">
                Completed
              </span>
            </div>
          </div>

          <div>
            <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-1.5 ${badgeConfig.bg}`}>
              {badgeConfig.label}
            </span>
            <p className="text-xs font-semibold text-slate-700">
              {completedCount} of {totalCount} standard duties verified today
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Target 100% before shift handover to maintain ISO 27001 compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Checklist items */}
      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[360px] flex-1">
        {tasks.map(task => (
          <div 
            key={task.id}
            onClick={() => handleToggle(task.id)}
            className={`p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors flex items-start gap-3 cursor-pointer select-none ${
              task.isCompleted ? 'bg-emerald-50/20' : ''
            }`}
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                task.isCompleted 
                  ? 'bg-[#006B3F] border-[#006B3F] text-white shadow-2xs' 
                  : 'border-slate-300 hover:border-emerald-600 bg-white'
              }`}
            >
              {task.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {task.category}
                </span>
                {task.timeHint && (
                  <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {task.timeHint}
                  </span>
                )}
              </div>

              <h4 className={`text-xs sm:text-sm font-semibold text-slate-900 mt-0.5 leading-snug ${
                task.isCompleted ? 'line-through text-slate-400' : ''
              }`}>
                {task.task}
              </h4>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
