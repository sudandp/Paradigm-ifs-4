import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  Camera, 
  CreditCard, 
  Building, 
  MapPin, 
  PenTool, 
  FileQuestion, 
  Send, 
  Bell,
  UserCheck
} from 'lucide-react';
import type { OnboardingData } from '../../types';

interface RejectReasonModalProps {
  isOpen: boolean;
  submission: OnboardingData | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

const PRESET_REASONS = [
  {
    id: 'photo_mismatch',
    label: 'Profile Photo Mismatch',
    icon: Camera,
    description: 'The uploaded profile photo does not match the ID proof (Aadhaar/PAN) or is unclear/inappropriate.',
    color: 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
    selectedColor: 'border-rose-600 bg-rose-100 text-rose-900 ring-2 ring-rose-500/20'
  },
  {
    id: 'aadhaar_mismatch',
    label: 'Aadhaar / ID Proof Issue',
    icon: CreditCard,
    description: 'Aadhaar or ID proof document is blurred, cropped, expired, or name/DOB does not match.',
    color: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
    selectedColor: 'border-amber-600 bg-amber-100 text-amber-900 ring-2 ring-amber-500/20'
  },
  {
    id: 'pan_mismatch',
    label: 'PAN Details Mismatch',
    icon: Building,
    description: 'PAN number or name does not match the statutory compliance records.',
    color: 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100',
    selectedColor: 'border-blue-600 bg-blue-100 text-blue-900 ring-2 ring-blue-500/20'
  },
  {
    id: 'bank_unclear',
    label: 'Bank Proof Unclear',
    icon: Building,
    description: 'Bank passbook / cancelled cheque is illegible, or IFSC / Account Number does not match.',
    color: 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
    selectedColor: 'border-indigo-600 bg-indigo-100 text-indigo-900 ring-2 ring-indigo-500/20'
  },
  {
    id: 'address_incomplete',
    label: 'Address Proof Incomplete',
    icon: MapPin,
    description: 'Present or permanent address proof is missing or incomplete.',
    color: 'border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100',
    selectedColor: 'border-teal-600 bg-teal-100 text-teal-900 ring-2 ring-teal-500/20'
  },
  {
    id: 'signature_missing',
    label: 'Signature Blurred / Missing',
    icon: PenTool,
    description: 'Candidate digital signature is missing, blank, or improperly drawn.',
    color: 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100',
    selectedColor: 'border-purple-600 bg-purple-100 text-purple-900 ring-2 ring-purple-500/20'
  },
  {
    id: 'other',
    label: 'Other / Custom Reason',
    icon: FileQuestion,
    description: 'Specify a custom reason and detailed instructions below.',
    color: 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100',
    selectedColor: 'border-slate-700 bg-slate-200 text-slate-900 ring-2 ring-slate-500/20'
  }
];

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  isOpen,
  submission,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('photo_mismatch');
  const [customNotes, setCustomNotes] = useState<string>('');

  if (!isOpen || !submission) return null;

  const candidateName = `${submission.personal?.firstName || ''} ${submission.personal?.lastName || ''}`.trim() || 'Candidate';
  const employeeId = submission.personal?.employeeId || submission.id || 'N/A';
  const siteName = submission.organizationName || submission.organization?.organizationName || 'Site Location';
  const designation = submission.organization?.designation || 'Staff';

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const preset = PRESET_REASONS.find(p => p.id === selectedPresetId);
    let fullReason = preset ? preset.label : 'Changes Requested';
    if (customNotes.trim()) {
      fullReason = `${fullReason}: ${customNotes.trim()}`;
    }
    await onConfirm(fullReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-700 via-rose-800 to-rose-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Reject Onboarding Submission
              </h3>
              <p className="text-xs text-rose-200">
                Specify reason & alert the field officer who filled this form
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Candidate Summary Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs">
                {(submission.personal?.firstName?.[0] || 'C') + (submission.personal?.lastName?.[0] || 'A')}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{candidateName}</h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {employeeId}
                  </span>
                  <span>•</span>
                  <span>{designation}</span>
                  <span>•</span>
                  <span className="truncate max-w-[140px]">{siteName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preset Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Select Primary Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_REASONS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`text-left p-2.5 rounded-xl border transition-all duration-150 flex items-start gap-2.5 ${
                      isSelected ? preset.selectedColor : preset.color
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white shadow-2xs' : 'bg-white/60'} shrink-0 mt-0.5`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-tight flex items-center justify-between">
                        <span>{preset.label}</span>
                        {isSelected && <span className="text-[10px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded-full">Selected</span>}
                      </div>
                      <p className="text-[10.5px] opacity-80 mt-1 leading-snug line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Custom Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Additional Instructions / Comments (Optional)
            </label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g., The uploaded profile photo is a group picture and does not match the candidate on the Aadhaar card. Please capture a clear live selfie of the candidate."
              className="w-full text-xs text-slate-800 p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder-slate-400 bg-white"
            />
          </div>

          {/* Submitter Alert Callout */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold">Instant Submitter Alert: </span>
              An urgent in-app alert and notification will be sent to the user who filled this onboarding form with the exact rejection reason so they can update and re-submit immediately.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Rejecting & Alerting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Confirm Rejection & Send Alert
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
