import React, { useState } from 'react';
import { api } from '../../services/api';
import type { User } from '../../types';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import { UserMinus, Calendar, Mail, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface BulkMarkAsLeftModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: User[];
  onSuccess: () => void;
}

export const BulkMarkAsLeftModal: React.FC<BulkMarkAsLeftModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  onSuccess
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [exitDate, setExitDate] = useState(todayStr);
  const [exitReason, setExitReason] = useState('Resigned');
  const [releaseEmail, setReleaseEmail] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    let successCount = 0;

    for (const user of selectedUsers) {
      try {
        await api.markUserAsLeft({
          userId: user.id,
          exitDate,
          exitReason,
          releaseEmail,
          notes: notes.trim() || undefined
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to mark user ${user.name} as left:`, err);
      }
    }

    setToast({
      message: `Successfully marked ${successCount} of ${selectedUsers.length} employees as Left.`,
      type: 'success'
    });

    setTimeout(() => {
      setIsSaving(false);
      onSuccess();
      onClose();
    }, 1200);
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" aria-modal="true" role="dialog">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Mark Employees as Left / Relieved</h3>
                <p className="text-xs text-slate-500">Record exit for {selectedUsers.length} selected employees</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Selected Users Summary */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex justify-between">
                <span>Selected Employees ({selectedUsers.length})</span>
              </div>
              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 text-xs text-slate-600 pr-1">
                {selectedUsers.map(u => (
                  <div key={u.id} className="py-1 flex items-center justify-between">
                    <span className="font-semibold text-slate-800 truncate">{u.name}</span>
                    <span className="font-mono text-slate-400 text-[11px] truncate">{u.email}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Exit Date Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Exit / Relieving Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Exit Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Exit <span className="text-red-500">*</span>
              </label>
              <select
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
              >
                <option value="Resigned">Resigned</option>
                <option value="Promotion / Role Change">Promotion / Role Change</option>
                <option value="Relieved / Contract Ended">Relieved / Contract Ended</option>
                <option value="Terminated">Terminated</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Release Email Address Checkbox */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={releaseEmail}
                  onChange={(e) => setReleaseEmail(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" />
                    Release email addresses for future onboarding
                  </p>
                  <p className="text-[11px] text-emerald-800/80 mt-0.5 leading-relaxed">
                    Safely archives previous email addresses so you can reuse them for replacement staff without duplicate conflicts. Historical records remain fully preserved.
                  </p>
                </div>
              </label>
            </div>

            {/* Handover / Additional Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Handover / Exit Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bulk team relocation / handover completed"
                className="w-full p-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Warning */}
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-[11px]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>Login credentials for all {selectedUsers.length} accounts will be deactivated upon confirmation.</span>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirm Exit for {selectedUsers.length} Employees
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default BulkMarkAsLeftModal;
