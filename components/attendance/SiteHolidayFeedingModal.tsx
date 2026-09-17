import React, { useState } from 'react';
import { format } from 'date-fns';
import { X, Calendar, Plus, Trash2, PartyPopper, CheckCircle2, AlertCircle } from 'lucide-react';

export interface SiteHolidayItem {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  site?: string;
}

interface SiteHolidayFeedingModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteName: string;
  holidays: SiteHolidayItem[];
  onAddHoliday: (item: { date: string; name: string; site: string }) => Promise<void> | void;
  onDeleteHoliday: (id: string) => Promise<void> | void;
}

export const SiteHolidayFeedingModal: React.FC<SiteHolidayFeedingModalProps> = ({
  isOpen,
  onClose,
  siteName,
  holidays,
  onAddHoliday,
  onDeleteHoliday,
}) => {
  const [holidayDate, setHolidayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [holidayName, setHolidayName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSiteHolidays = holidays.filter(
    h => !h.site || h.site === 'all' || h.site.toLowerCase().trim() === siteName.toLowerCase().trim()
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      setErrorMsg('Please select a date and enter a holiday name.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onAddHoliday({
        date: holidayDate,
        name: holidayName.trim(),
        site: siteName,
      });
      setHolidayName('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save holiday');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#072415] rounded-3xl border border-slate-200 dark:border-[#134426] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-[#134426] flex items-center justify-between bg-slate-50/70 dark:bg-[#0a2f1c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <PartyPopper size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Feed Site Holidays
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-bold tracking-wide">
                  Site Level
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70">
                Configure paid holidays for {siteName || 'All Sites'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-[#134426] transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAdd} className="p-5 border-b border-slate-100 dark:border-[#134426] bg-slate-50/30 dark:bg-[#0c2e1c]/40">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
            <Plus size={14} className="text-sky-500" />
            Add New Holiday
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="date"
              value={holidayDate}
              onChange={e => setHolidayDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none"
              required
            />
            <input
              type="text"
              placeholder="e.g. Independence Day, Gandhi Jayanti"
              value={holidayName}
              onChange={e => setHolidayName(e.target.value)}
              className="flex-1 w-full px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#072415] border border-slate-200 dark:border-[#134426] text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none"
              required
            />
            <button
              type="submit"
              disabled={isSubmitting || !holidayName.trim()}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              {isSubmitting ? 'Adding...' : 'Add'}
            </button>
          </div>
          {errorMsg && (
            <p className="text-[11px] text-rose-500 mt-2 flex items-center gap-1">
              <AlertCircle size={12} /> {errorMsg}
            </p>
          )}
        </form>

        {/* Existing Holidays List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-400/60 mb-1 flex items-center justify-between">
            <span>Configured Holidays ({currentSiteHolidays.length})</span>
            <span className="text-sky-600 dark:text-sky-400 font-semibold">{siteName}</span>
          </div>

          {currentSiteHolidays.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-emerald-400/50">
              No holidays added for this site yet. Add one above!
            </div>
          ) : (
            currentSiteHolidays.map(item => (
              <div
                key={item.id}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-[#134426] bg-white dark:bg-[#0c2e1c] flex items-center justify-between group hover:border-sky-300 dark:hover:border-sky-800 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-mono text-xs font-bold">
                    {item.date}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {item.name}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteHoliday(item.id)}
                  className="text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                  title="Remove holiday"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Info Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-[#134426] bg-slate-50/50 dark:bg-[#0a2f1c] flex items-center justify-between">
          <p className="text-[11px] text-slate-400 dark:text-emerald-400/70">
            Staff with no punches on these dates will show <strong>H</strong> (+1 Payable Day).
          </p>
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-200/70 hover:bg-slate-300 dark:bg-[#134426] dark:hover:bg-[#1b5e34] rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
