import React, { useState } from 'react';
import type { User } from '../../types/user';
import Button from '../ui/Button';
import { UserMinus, Calendar, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MarkAsLeftModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onConfirm: (data: {
    exitDate: string;
    exitReason: string;
    releaseEmail: boolean;
    notes?: string;
  }) => Promise<void>;
  isSaving: boolean;
}

export const MarkAsLeftModal: React.FC<MarkAsLeftModalProps> = ({
  isOpen,
  onClose,
  user,
  onConfirm,
  isSaving,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [exitDate, setExitDate] = useState(todayStr);
  const [exitReason, setExitReason] = useState('Resigned');
  const [releaseEmail, setReleaseEmail] = useState(true);
  const [notes, setNotes] = useState('');

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      exitDate,
      exitReason,
      releaseEmail,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-[#0A2619] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
              <UserMinus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Mark Employee as Left / Relieved</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Record employee exit and manage role email reassignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold p-1 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Employee Card Preview */}
          <div className="p-3.5 bg-slate-50 dark:bg-black/30 rounded-xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">{user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{user.role || 'Employee'}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">{user.email}</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              Exit Flow
            </span>
          </div>

          {/* Exit Date Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Exit / Relieving Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-black/20 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Exit Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Reason for Exit <span className="text-red-500">*</span>
            </label>
            <select
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-black/20 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
            >
              <option value="Resigned">Resigned</option>
              <option value="Promotion / Role Change">Promotion / Role Change</option>
              <option value="Relieved / Contract Ended">Relieved / Contract Ended</option>
              <option value="Terminated">Terminated</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Release Email Address Checkbox */}
          <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={releaseEmail}
                onChange={(e) => setReleaseEmail(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Release email address ({user.email}) for reassignment
                </p>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-0.5 leading-relaxed">
                  Safely archives this user's email while preserving 100% of their historical work, audits, and attendance records. Immediately frees up <span className="font-mono font-bold">{user.email}</span> so you can assign it to a new or promoted employee without duplicate key errors.
                </p>
              </div>
            </label>
          </div>

          {/* Handover / Additional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Handover / Exit Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Promoted to another unit / handed over to new team member"
              className="w-full p-3 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-black/20 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Safety Notice */}
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300 text-[11px]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>Login access for this account will be deactivated upon exit confirmation.</span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              isLoading={isSaving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-900/10 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirm Employee Exit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarkAsLeftModal;
