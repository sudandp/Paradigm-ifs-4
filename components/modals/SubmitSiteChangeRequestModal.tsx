import React, { useState } from 'react';
import { Lock, ShieldAlert, Send, X, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { dispatchNotificationFromRules } from '../../services/notificationService';
import Toast from '../ui/Toast';

interface SubmitSiteChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordType: 'attendance' | 'finance';
  requestType: 'ADD' | 'EDIT' | 'DELETE';
  recordId?: string;
  siteName?: string;
  companyName?: string;
  targetMonth?: string;
  targetYear?: string;
  proposedData?: Record<string, any>;
  originalData?: Record<string, any>;
  originalRecord?: any;
  onSuccess?: () => void;
}

const SubmitSiteChangeRequestModal: React.FC<SubmitSiteChangeRequestModalProps> = ({
  isOpen,
  onClose,
  recordType,
  requestType,
  recordId,
  siteName,
  companyName,
  targetMonth,
  targetYear,
  proposedData,
  originalData,
  originalRecord,
  onSuccess
}) => {
  const effectiveSiteName = siteName || originalRecord?.siteName || '';
  const effectiveCompanyName = companyName || originalRecord?.companyName || '';
  const effectiveTargetMonth = targetMonth || originalRecord?.month || '';
  const effectiveTargetYear = targetYear || originalRecord?.year || '';
  const effectiveRecordId = recordId || originalRecord?.id;
  const effectiveProposedData = proposedData || originalRecord || {};
  const effectiveOriginalData = originalData || originalRecord;

  const { user } = useAuthStore();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setToast({ message: 'Please provide a justification reason for this change request.', type: 'error' });
      return;
    }

    if (!user) return;

    setIsSubmitting(true);
    try {
      await api.submitSiteChangeRequest({
        recordType,
        requestType,
        recordId: effectiveRecordId,
        siteName: effectiveSiteName,
        companyName: effectiveCompanyName,
        targetMonth: String(effectiveTargetMonth),
        targetYear: String(effectiveTargetYear),
        proposedData: effectiveProposedData,
        originalData: effectiveOriginalData,
        reason: reason.trim(),
        requestedBy: user.id,
        requestedByName: user.name || 'Staff',
        requestedByRole: user.role,
        reportingManagerId: user.reportingManagerId
      });

      // Dispatch notification to reporting manager / admins
      await dispatchNotificationFromRules('site_change_request', {
        actorName: user.name,
        actionText: `submitted a historical ${requestType} change request for ${effectiveSiteName} (${effectiveTargetMonth}/${effectiveTargetYear})`,
        locString: effectiveSiteName,
        title: 'Historical Record Change Request',
        link: '/enterprise?tab=approvals',
        actor: {
          id: user.id,
          name: user.name,
          reportingManagerId: user.reportingManagerId,
          role: user.role
        }
      });

      setToast({ message: 'Change request submitted successfully! Awaiting reporting manager approval.', type: 'success' });
      
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Submit change request error:', err);
      setToast({ message: err?.message || 'Failed to submit change request', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="relative w-full max-w-lg bg-[#06251c] md:bg-white border border-white/10 md:border-gray-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white md:text-gray-900">Historical Period Locked</h3>
              <p className="text-xs text-amber-400 md:text-amber-700 font-semibold mt-0.5">Manager Approval Required to Modify</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-400/40 hover:text-white md:text-gray-400 md:hover:text-gray-600 hover:bg-white/5 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lock Explanation Alert */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 md:text-amber-800 leading-relaxed space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Past-Month Data Protection Gate Active
          </p>
          <p className="text-[11px] opacity-90">
            Records for <strong>{targetMonth}/{targetYear}</strong> are locked to prevent inadvertent overwrites. Submitting this request sends it to your Reporting Manager. Once approved, it will be automatically applied to the live app & database.
          </p>
        </div>

        {/* Request Summary Card */}
        <div className="bg-[#041b0f] md:bg-gray-50 border border-white/5 md:border-gray-200 rounded-xl p-3.5 text-xs space-y-2 text-white md:text-gray-900">
          <div className="flex justify-between items-center py-0.5 border-b border-white/5 md:border-gray-200">
            <span className="text-emerald-400/60 md:text-gray-500">Site Name:</span>
            <span className="font-bold">{siteName}</span>
          </div>
          {companyName && (
            <div className="flex justify-between items-center py-0.5 border-b border-white/5 md:border-gray-200">
              <span className="text-emerald-400/60 md:text-gray-500">Company:</span>
              <span className="font-semibold">{companyName}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-0.5 border-b border-white/5 md:border-gray-200">
            <span className="text-emerald-400/60 md:text-gray-500">Target Cycle:</span>
            <span className="font-semibold">{targetMonth}/{targetYear}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-emerald-400/60 md:text-gray-500">Requested Action:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              requestType === 'DELETE' 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {requestType} RECORD
            </span>
          </div>
        </div>

        {/* Reason Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-emerald-400/80 md:text-gray-700 mb-1">
              Reason / Justification for Modification <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this past-period entry needs to be added, changed, or deleted (e.g. client reconciliation, late biometric punch adjustment, invoice revision)..."
              className="w-full h-24 p-3 bg-[#041b0f] md:bg-white border border-white/10 md:border-gray-200 rounded-xl text-xs text-white md:text-gray-900 focus:outline-none focus:border-[#00D27F] transition-all resize-none shadow-sm"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-emerald-400/60 md:text-gray-600 hover:bg-white/5 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="h-10 px-5 inline-flex items-center justify-center gap-2 text-xs font-bold text-[#041b0f] md:text-white bg-[#00D27F] md:bg-emerald-600 hover:bg-[#00b86e] md:hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Submit for Approval</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default SubmitSiteChangeRequestModal;
