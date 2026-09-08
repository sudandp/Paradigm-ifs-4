import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  FileSignature, 
  ShieldCheck, 
  Building2, 
  Phone, 
  User, 
  Briefcase, 
  ExternalLink,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { OnboardingData } from '../../types';
import ESignFlow from './ESignFlow';

interface ApproveSubmissionModalProps {
  isOpen: boolean;
  submission: OnboardingData | null;
  onClose: () => void;
  onConfirmApprove: (id: string, esignUrl?: string) => Promise<void>;
  isApproving?: boolean;
}

export const ApproveSubmissionModal: React.FC<ApproveSubmissionModalProps> = ({
  isOpen,
  submission,
  onClose,
  onConfirmApprove,
  isApproving = false,
}) => {
  const [signedDocUrl, setSignedDocUrl] = useState<string | null>(null);
  const [overrideWithoutSign, setOverrideWithoutSign] = useState(false);

  if (!isOpen || !submission) return null;

  const employeeName = `${submission.personal?.firstName || ''} ${submission.personal?.lastName || ''}`.trim() || 'Candidate';
  const siteName = submission.organization?.site || submission.organization?.organizationName || 'Paradigm Office';
  const designation = submission.organization?.designation || 'Staff';
  const mobile = submission.personal?.mobile || '';
  const email = submission.personal?.email || '';

  const existingSignedUrl = submission.esign_document_url || submission.esignDocUrl || signedDocUrl;
  const isSigned = !!existingSignedUrl;

  const handleApprove = async () => {
    if (!submission.id) return;
    await onConfirmApprove(submission.id, existingSignedUrl || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Approve Submission & Digital Signature
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify documents and execute the digital employment agreement before final approval.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isApproving}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Candidate Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <User className="w-3 h-3 text-emerald-600" /> Candidate
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{employeeName}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Briefcase className="w-3 h-3 text-emerald-600" /> Designation
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{designation}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Building2 className="w-3 h-3 text-emerald-600" /> Site / Client
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{siteName}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Phone className="w-3 h-3 text-emerald-600" /> Aadhaar Mobile
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{mobile || 'N/A'}</p>
            </div>
          </div>

          {/* Digital Signature Execution Block */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Digital Employment Agreement (Aadhaar e-Sign)
                </h3>
              </div>
              {isSigned ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Agreement Signed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Pending Signature
                </span>
              )}
            </div>

            {isSigned ? (
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Legally Binding Agreement Executed
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Standard employment contract with site NDA signed digitally.
                    </p>
                  </div>
                </div>
                {existingSignedUrl && (
                  <a
                    href={existingSignedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View PDF
                  </a>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                  Initiate Aadhaar-based OTP signature for <strong>{employeeName}</strong> on mobile <strong>{mobile}</strong>. Client NDA for <em>{siteName}</em> will be merged automatically.
                </p>
                <ESignFlow
                  employeeId={submission.id!}
                  employeeName={employeeName}
                  mobile={mobile}
                  signerEmail={email}
                  baseContractUrl={import.meta.env.VITE_EMPLOYMENT_AGREEMENT_PDF_URL ?? ''}
                  clientSiteId={siteName}
                  onSigned={(url) => setSignedDocUrl(url)}
                />
              </div>
            )}
          </div>

          {/* Fallback Option */}
          {!isSigned && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overrideWithoutSign}
                  onChange={(e) => setOverrideWithoutSign(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-300">Waiver / Physical Contract Option:</strong> Approve without digital e-Sign if physical paperwork was collected manually on-site.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isApproving}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={(!isSigned && !overrideWithoutSign) || isApproving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 shadow-sm ${
              (!isSigned && !overrideWithoutSign) || isApproving
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
            }`}
          >
            {isApproving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Approving Submission...
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                Confirm & Approve Submission
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ApproveSubmissionModal;
