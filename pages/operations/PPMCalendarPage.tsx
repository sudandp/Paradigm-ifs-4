import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HTPpmCalendarView, HTPpmCalendarViewHandle } from '../../components/ht-yard/HTPpmCalendarView';
import { Calendar, ArrowLeft, Sparkles } from 'lucide-react';

export const PPMCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const calendarRef = useRef<HTPpmCalendarViewHandle>(null);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 space-y-6">
      {/* Top Header Card — Styled identical to Audit Change Log */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <button
            type="button"
            onClick={() => navigate('/operations/ht-yard-audits')}
            className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Audits Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Planned Preventive Maintenance (PPM) Calendar
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Supabase Synced
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Automated recurring maintenance schedules, daily/weekly/monthly/quarterly/yearly checklists & technician signoffs.
              </p>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => calendarRef.current?.handleAutoGenerateSchedules()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" /> Auto-Schedule From Equipment Fleet
          </button>
        </div>
      </div>

      {/* Main Interactive PPM Calendar */}
      <HTPpmCalendarView ref={calendarRef} hideHeaderBanner={true} />
    </div>
  );
};

export default PPMCalendarPage;
