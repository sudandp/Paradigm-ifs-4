import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { CrmLead } from '../../types/crm';

interface LostLeadModalProps {
  lead: CrmLead;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    status: 'Lost';
    lostReason: string;
    notes: string;
    competitor?: string;
    lostDate: string;
    dealValue: number;
  }) => Promise<void>;
}

export const LostLeadModal: React.FC<LostLeadModalProps> = ({ lead, isOpen, onClose, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    lostReason: lead.lostReason || '',
    notes: lead.notes || '',
    competitor: lead.competitor || '',
    lostDate: lead.lostDate || new Date().toISOString().split('T')[0],
    dealValue: lead.dealValue || 0,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.lostReason) {
      setError('Please select a reason for why this lead was lost.');
      return;
    }

    if (!formData.notes) {
      setError('Please provide specific remarks for why this lead was lost.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        status: 'Lost',
        ...formData
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-page rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="text-xl font-bold text-red-500">Mark Lead as Lost</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 text-red-600">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-primary-text mb-2">Lost Reason *</label>
            <select
              required
              value={formData.lostReason}
              onChange={e => setFormData({ ...formData, lostReason: e.target.value })}
              className={`w-full h-12 rounded-xl bg-slate-50 dark:bg-black/20 border ${!formData.lostReason ? 'border-red-500/50' : 'border-border'} px-4 outline-none focus:ring-2 focus:ring-red-500/20`}
            >
              <option value="" disabled>Select Reason...</option>
              <option value="Price Too High">Price Too High</option>
              <option value="Went with Competitor">Went with Competitor</option>
              <option value="Project Cancelled">Project Cancelled</option>
              <option value="Not Responsive">Not Responsive</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-primary-text mb-2">Competitor (If applicable)</label>
            <input
              type="text"
              value={formData.competitor}
              onChange={e => setFormData({ ...formData, competitor: e.target.value })}
              placeholder="Who did they go with?"
              className="w-full h-12 rounded-xl bg-slate-50 dark:bg-black/20 border border-border px-4 outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-primary-text mb-2">Date Lost *</label>
              <input
                type="date"
                required
                value={formData.lostDate}
                onChange={e => setFormData({ ...formData, lostDate: e.target.value })}
                className="w-full h-12 rounded-xl bg-slate-50 dark:bg-black/20 border border-border px-4 outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-primary-text mb-2">Deal Value (Lost) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.dealValue}
                onChange={e => setFormData({ ...formData, dealValue: Number(e.target.value) })}
                className="w-full h-12 rounded-xl bg-slate-50 dark:bg-black/20 border border-border px-4 outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-primary-text mb-2">Remarks / Post-mortem *</label>
            <textarea
              required
              rows={4}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Provide specific details about why we lost this deal..."
              className="w-full rounded-xl bg-slate-50 dark:bg-black/20 border border-border p-4 outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-muted hover:bg-black/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl font-bold bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Mark as Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
