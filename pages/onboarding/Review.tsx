import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useSettingsStore } from '../../store/settingsStore';
import Button from '../../components/ui/Button';
import FormHeader from '../../components/onboarding/FormHeader';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ShieldCheck, FileText, Save, FileSignature, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import type { VerificationResult, EducationRecord, UploadedFile } from '../../types';
import { useAuthStore } from '../../store/authStore';
import DraftSaveIndicator, { type DraftSaveStatus } from '../../components/onboarding/DraftSaveIndicator';
import ESignFlow from '../../components/onboarding/ESignFlow';
import OnboardingBookletModal from '../../components/onboarding/OnboardingBookletModal';
import ApproveSubmissionModal from '../../components/onboarding/ApproveSubmissionModal';
import hotToast from 'react-hot-toast';
import { useEnrollmentRulesStore, getRulesForDesignation } from '../../store/enrollmentRulesStore';
import { formatDisplayDate } from '../../utils/date';


const DetailItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-muted">{label}</dt>
        <dd className="mt-1 text-sm text-primary-text">{value || '-'}</dd>
    </div>
);

const DetailItemWithStatus: React.FC<{ label: string; value?: string | number | null; status: boolean | null; isVerifying: boolean }> = ({ label, value, status, isVerifying }) => (
    <div>
        <dt className="text-sm font-medium text-muted flex items-center">
            {label}
            {isVerifying && <Loader2 className="h-4 w-4 text-muted animate-spin ml-2" />}
            {!isVerifying && status === true && <span title="Verified from document" className="ml-2"><CheckCircle className="h-4 w-4 text-green-500" /></span>}
            {!isVerifying && status === false && <span title="Verification Failed" className="ml-2"><XCircle className="h-4 w-4 text-red-500" /></span>}
        </dt>
        <dd className="mt-1 text-sm text-primary-text">{value || '-'}</dd>
    </div>
);

const MobileDetailItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
    <div className="flex justify-between items-start py-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-sm text-white font-medium text-right max-w-[60%]">{value || '-'}</span>
    </div>
);


const Review = () => {
    const { onSubmit, isSubmitting } = useOutletContext<{ onSubmit: () => Promise<void>; isSubmitting: boolean }>();
    const { user } = useAuthStore();
    const { data, logVerificationUsage, setPersonalVerifiedStatus, setBankVerifiedStatus, setUanVerifiedStatus, setFormsGenerated } = useOnboardingStore();
    const { perfiosApi } = useSettingsStore();
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [esignDocUrl, setEsignDocUrl] = useState<string | null>((data as any)?.esign_document_url || (data as any)?.esignDocUrl || null);
    const [isBookletModalOpen, setIsBookletModalOpen] = useState(false);

    useEffect(() => {
        const docUrl = (data as any)?.esign_document_url || (data as any)?.esignDocUrl;
        if (docUrl) setEsignDocUrl(docUrl);
    }, [(data as any)?.esign_document_url, (data as any)?.esignDocUrl]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobileView = user?.role === 'field_staff' && isMobile;

    const [verificationState, setVerificationState] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
    const [verificationMessage, setVerificationMessage] = useState('');

    // HR Approval modal state for Review page
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const isHRUser = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'general_manager' || user?.role === 'operations_manager';
    const isPendingApproval = data.status === 'pending';

    const handleConfirmApproveFromReview = async (id: string, esignUrl?: string) => {
        setIsApproving(true);
        try {
            await api.verifySubmission(id, 'manual');
            if (esignUrl) {
                setEsignDocUrl(esignUrl);
            }
            hotToast.success('Submission verified & approved with digital signature!');
            setIsApproveModalOpen(false);
            navigate('/onboarding');
        } catch (e) {
            console.error('Failed to approve', e);
            hotToast.error('Failed to approve submission.');
        } finally {
            setIsApproving(false);
        }
    };

    // Draft save state for the Review page
    const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    const handleSaveAsDraft = useCallback(async () => {
        setDraftSaveStatus('saving');
        try {
            const { draftId } = await api.saveDraft(data);
            if (draftId && draftId !== data.id) {
                useOnboardingStore.getState().setData({ ...data, id: draftId });
            }
            setDraftSaveStatus('saved');
            setLastSavedAt(new Date());
        } catch {
            setDraftSaveStatus('dirty');
        }
    }, [data]);

    const uploadedFingerprints = useMemo(() => {
        return Object.entries(data.biometrics.fingerprints || {})
            .filter(([_, value]) => !!value)
            .map(([fingerName]) => fingerName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));
    }, [data.biometrics.fingerprints]);

    const handleVerification = async () => {
        setVerificationState('verifying');
        setVerificationMessage('');
        let allSuccess = true;
        const messages: string[] = [];

        try {
            // 1. Bank Verification
            if (data.bank.accountNumber && data.bank.ifscCode) {
                logVerificationUsage('Bank AC Verification Advanced');
                const bankResult = await api.verifyBankAccountWithPerfios({
                    name: data.bank.accountHolderName || `${data.personal.firstName} ${data.personal.lastName}`,
                    dob: data.personal.dob || '',
                    aadhaar: resolvedAadhaar || null,
                    pan: resolvedPan || null,
                    bank: {
                        accountNumber: data.bank.accountNumber,
                        ifsc: data.bank.ifscCode,
                    },
                    uan: data.uan.uanNumber || null,
                    esi: data.esi.esiNumber || null,
                });
                messages.push(`Bank: ${bankResult.message}`);
                setBankVerifiedStatus({
                    accountNumber: bankResult.verifiedFields.accountNumber,
                    accountHolderName: bankResult.verifiedFields.accountHolderName,
                });
                if (!bankResult.success) allSuccess = false;
            }

            // 2. Aadhaar Verification
            const aadhaarToVerify = resolvedAadhaar || (data.personal.idProofType === 'Aadhaar' ? data.personal.idProofNumber : '');
            if (aadhaarToVerify) {
                logVerificationUsage('Aadhaar Verification');
                const aadhaarResult = await api.verifyAadhaar(aadhaarToVerify);
                messages.push(`Aadhaar: ${aadhaarResult.message}`);
                setPersonalVerifiedStatus({ aadhaarNumber: aadhaarResult.success, idProofNumber: aadhaarResult.success });
                if (!aadhaarResult.success) allSuccess = false;
            }

            // 3. UAN Verification
            if (data.uan.hasPreviousPf && data.uan.uanNumber) {
                logVerificationUsage('EPF UAN Lookup');
                const uanResult = await api.lookupUan(data.uan.uanNumber);
                messages.push(`UAN: ${uanResult.message}`);
                setUanVerifiedStatus({ uanNumber: uanResult.verifiedFields.uan });
                if (!uanResult.success) allSuccess = false;
            }

            // Persist the updated statuses
            await api.updateOnboarding(useOnboardingStore.getState().data);

            setVerificationMessage(messages.join('\n'));
            setVerificationState(allSuccess ? 'success' : 'failed');

        } catch (error: any) {
            setVerificationState('failed');
            setVerificationMessage(error.message || 'An unexpected error occurred during verification.');
        }
    };

    const handleGenerateForms = () => {
        setIsBookletModalOpen(true);
    };

    const handleConfirmBooklet = async () => {
        setFormsGenerated(true);
        const updated = { ...data, formsGenerated: true };
        useOnboardingStore.getState().setData(updated);
        if (data.id && !data.id.startsWith('draft_')) {
            try {
                await api.updateOnboarding(updated);
            } catch (e) {
                console.warn("Could not sync formsGenerated status:", e);
            }
        }
        setIsBookletModalOpen(false);
    };

    const { rulesByDesignation, fetchRules } = useEnrollmentRulesStore();
    useEffect(() => {
        fetchRules().catch(() => {});
    }, [fetchRules]);

    const designation = data.organization.designation;
    const currentRules = useMemo(() => getRulesForDesignation(rulesByDesignation, designation), [rulesByDesignation, designation]);

    const missingMandatoryDocs = useMemo(() => {
        const missing: { key: string; label: string }[] = [];

        // 1. Candidate Live Photo
        const hasPhoto = !!(data.personal.photo?.preview || data.personal.photo?.file || (typeof data.personal.photo === 'string' && data.personal.photo));
        if (currentRules.documents.photo && !hasPhoto) {
            missing.push({ key: 'photo', label: 'Candidate Live Photo' });
        }

        // 2. Aadhaar Card (Front & Back)
        const hasAadhaarFront = !!(data.personal.idProofFront?.preview || data.personal.idProofFront?.file);
        const hasAadhaarBack = !!(data.personal.idProofBack?.preview || data.personal.idProofBack?.file);
        if (currentRules.documents.aadhaar) {
            if (!hasAadhaarFront) missing.push({ key: 'idProofFront', label: 'Aadhaar Card (Front)' });
            if (!hasAadhaarBack) missing.push({ key: 'idProofBack', label: 'Aadhaar Card (Back)' });
        }

        // 3. Bank Proof
        const hasBankProof = !!(data.bank.bankProof?.preview || data.bank.bankProof?.file);
        if (currentRules.documents.bankProof && !hasBankProof) {
            missing.push({ key: 'bankProof', label: 'Bank Account Proof (Cheque Book / Cancelled Cheque)' });
        }

        // 4. PAN Card
        const hasPanCard = !!(data.personal.panCard?.preview || data.personal.panCard?.file);
        if (currentRules.documents.pan && !hasPanCard) {
            missing.push({ key: 'panCard', label: 'PAN Card' });
        }

        // 5. UAN / PF Proof (if candidate has previous PF and UAN proof is marked mandatory)
        if (currentRules.documents.uanProof && data.uan.hasPreviousPf) {
            const hasUanDoc = !!(data.uan.document?.preview || data.uan.document?.file);
            if (!hasUanDoc) {
                missing.push({ key: 'uanProof', label: 'UAN / PF Document' });
            }
        }

        // 6. Salary Slip (if candidate has previous PF and salary slip is marked mandatory)
        if (currentRules.documents.salarySlip && data.uan.hasPreviousPf) {
            const hasSalarySlip = !!(data.uan.salarySlip?.preview || data.uan.salarySlip?.file);
            if (!hasSalarySlip) {
                missing.push({ key: 'salarySlip', label: 'Previous Salary Slip' });
            }
        }

        // 7. Education Certificate (if marked mandatory)
        if (currentRules.documents.educationCertificate && data.education && data.education.length > 0) {
            const hasMissingEdu = data.education.some(e => !e.document?.preview && !e.document?.file);
            if (hasMissingEdu) {
                missing.push({ key: 'educationCertificate', label: 'Education Certificate' });
            }
        }

        // 8. Family Member Proofs (if marked mandatory)
        if (currentRules.documents.familyAadhaar && data.family && data.family.length > 0) {
            const hasMissingFam = data.family.some(f => !f.idProof?.preview && !f.idProof?.file);
            if (hasMissingFam) {
                missing.push({ key: 'familyAadhaar', label: 'Family Member Proofs' });
            }
        }

        return missing;
    }, [currentRules.documents, data.personal.photo, data.personal.idProofFront, data.personal.idProofBack, data.bank.bankProof, data.personal.panCard, data.uan.hasPreviousPf, data.uan.document, data.uan.salarySlip, data.education, data.family]);

    const canSubmit = (verificationState === 'success' || !perfiosApi.enabled) && data.formsGenerated && missingMandatoryDocs.length === 0;
    
    const resolvedAadhaar = data.personal.aadhaarNumber || (/^\d{12}$/.test(data.personal.idProofNumber || '') ? data.personal.idProofNumber : '');
    const resolvedPan = data.personal.panNumber || (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(data.personal.idProofNumber || '') ? data.personal.idProofNumber : '');

    if (isMobileView) {
        return (
             <form onSubmit={async (e) => { 
                 e.preventDefault(); 
                 if (!canSubmit) {
                     if (missingMandatoryDocs.length > 0) {
                         alert(`Please upload all mandatory documents before submitting:\n• ${missingMandatoryDocs.map(d => d.label).join('\n• ')}`);
                     }
                     return;
                 }
                 await onSubmit(); 
             }} id="review-form">
                <p className="text-sm text-gray-400 mb-4">Please review all your details carefully before submitting.</p>

                {missingMandatoryDocs.length > 0 && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-rose-400">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                            <XCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
                            <span>Missing Mandatory Documents ({missingMandatoryDocs.length})</span>
                        </div>
                        <p className="text-xs text-rose-300/80">
                            Submission is blocked until these mandatory documents are uploaded:
                        </p>
                        <ul className="text-xs list-disc list-inside space-y-1 text-rose-200">
                            {missingMandatoryDocs.map(doc => (
                                <li key={doc.key} className="font-medium">{doc.label}</li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={() => navigate('/onboarding/pre-upload')}
                            className="mt-2 w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                            Upload Missing Documents
                        </button>
                    </div>
                )}

                 <div className="space-y-6">
                    <section>
                        <h4 className="fo-section-title mb-2">Personal Details</h4>
                        <div className="divide-y divide-border">
                             <MobileDetailItem label="Employee ID" value={data.personal.employeeId} />
                             <MobileDetailItem label="Full Name" value={`${data.personal.firstName} ${data.personal.lastName}`} />
                             <MobileDetailItem label="Email" value={data.personal.email} />
                             <MobileDetailItem label="Mobile" value={data.personal.mobile} />
                             <MobileDetailItem label="Date of Birth" value={formatDisplayDate(data.personal.dob)} />
                             {resolvedAadhaar && <MobileDetailItem label="Aadhaar Number" value={resolvedAadhaar} />}
                             {resolvedPan && <MobileDetailItem label="PAN Number" value={resolvedPan} />}
                        </div>
                    </section>
                    <section>
                        <h4 className="fo-section-title mb-2">Organization Details</h4>
                        <div className="divide-y divide-border">
                             <MobileDetailItem label="Site" value={data.organization.organizationName} />
                             <MobileDetailItem label="Designation" value={data.organization.designation} />
                             <MobileDetailItem label="Department" value={data.organization.department} />
                             {data.organization.joiningDate && <MobileDetailItem label="Joining Date" value={formatDisplayDate(data.organization.joiningDate)} />}
                        </div>
                    </section>
                    <section>
                        <h4 className="fo-section-title mb-2">Bank Details</h4>
                         <div className="divide-y divide-border">
                            <MobileDetailItem label="Account Holder" value={data.bank.accountHolderName} />
                            <MobileDetailItem label="Account Number" value={'*'.repeat(Math.max(0, data.bank.accountNumber.length - 4)) + data.bank.accountNumber.slice(-4)} />
                            <MobileDetailItem label="IFSC Code" value={data.bank.ifscCode} />
                         </div>
                    </section>
                    <section>
                        <h4 className="fo-section-title mb-2">Uniform Details</h4>
                        <div className="divide-y divide-border">
                             <MobileDetailItem label="Uniform Required" value={data.uniforms.length > 0 ? 'Yes' : 'No'} />
                             {data.uniforms.map(item => (
                                 <MobileDetailItem key={item.itemId} label={item.itemName} value={`${item.quantity} x Size ${item.sizeLabel} (${item.fit})`} />
                             ))}
                        </div>
                    </section>
                     <section>
                        <h4 className="fo-section-title mb-2">Biometrics</h4>
                        {data.biometrics.signatureImage && (
                            <div className="mb-4">
                                <h5 className="fo-section-title mb-2 text-base">Signature</h5>
                                <img src={data.biometrics.signatureImage.preview} alt="Signature" className="h-24 bg-white border rounded-md mx-auto" />
                            </div>
                        )}
                        {uploadedFingerprints.length > 0 && (
                            <div>
                                <h5 className="fo-section-title mb-2 text-base">Fingerprints</h5>
                                <ul className="text-sm text-center text-gray-400 list-disc list-inside">
                                    {uploadedFingerprints.map(finger => <li key={finger}>{finger}</li>)}
                                </ul>
                            </div>
                        )}
                    </section>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-700">
                    <h3 className="text-base font-semibold text-white mb-2">Generate Official Forms</h3>
                    <div className="p-4 bg-black/20 rounded-xl border border-slate-700/50 flex flex-col gap-3">
                        <div>
                            <p className="font-medium text-sm text-slate-200">Review official employee onboarding forms.</p>
                            <p className="text-xs text-slate-400">Mandatory before final submission.</p>
                        </div>
                        {data.formsGenerated ? (
                            <div className="flex items-center gap-2 font-semibold text-emerald-400 text-sm">
                                <CheckCircle className="h-5 w-5"/>
                                <span>Forms Generated & Confirmed</span>
                            </div>
                        ) : (
                            <Button type="button" onClick={handleGenerateForms} className="w-full">
                                <FileText className="mr-2 h-4 w-4" /> Generate & Review Forms
                            </Button>
                        )}
                    </div>
                </div>                {data.formsGenerated && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSignature className="h-4 w-4 text-emerald-400" />
                                    <h3 className="text-sm font-semibold text-white">Digital Signature & Agreement</h3>
                                </div>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    esignDocUrl 
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                                        : 'bg-slate-700 text-slate-300 border border-slate-600'
                                }`}>
                                    {esignDocUrl ? 'Signed' : 'Scheduled at HR Approval'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                {esignDocUrl 
                                    ? 'Employment Agreement & Client NDA has been digitally signed.' 
                                    : 'Aadhaar-based digital signature will be initiated during HR verification and approval. You can proceed with submitting now.'}
                            </p>
                            {esignDocUrl && (
                                <a 
                                    href={esignDocUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline pt-1"
                                >
                                    <ExternalLink className="h-3 w-3" /> View Signed Agreement
                                </a>
                            )}
                        </div>
                    </div>
                )}

                <OnboardingBookletModal 
                    isOpen={isBookletModalOpen}
                    onClose={() => setIsBookletModalOpen(false)}
                    onConfirm={handleConfirmBooklet}
                    employeeData={data}
                />
            </form>
        );
    }

    return (
        <form onSubmit={async (e) => { 
            e.preventDefault(); 
            if (!canSubmit) {
                if (missingMandatoryDocs.length > 0) {
                    alert(`Please upload all mandatory documents before submitting:\n• ${missingMandatoryDocs.map(d => d.label).join('\n• ')}`);
                }
                return;
            }
            await onSubmit(); 
        }} id="review-form">
            <FormHeader title="Review & Submit" subtitle="Please review all your details carefully before submitting." />
            
            <div className="space-y-8">
                {/* Mandatory Documents Status Section */}
                <section>
                    <div className="flex items-center justify-between border-b pb-2 mb-4">
                        <h4 className="text-md font-semibold text-primary-text">Mandatory Documents Compliance</h4>
                        {missingMandatoryDocs.length === 0 ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                                <CheckCircle className="h-4 w-4" /> All Mandatory Documents Uploaded
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                                <XCircle className="h-4 w-4" /> {missingMandatoryDocs.length} Mandatory Document{missingMandatoryDocs.length > 1 ? 's' : ''} Missing
                            </span>
                        )}
                    </div>
                    
                    {missingMandatoryDocs.length > 0 ? (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl space-y-3">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                                        Application submission is blocked until mandatory documents are uploaded
                                    </p>
                                    <p className="text-xs text-rose-700 dark:text-rose-300">
                                        Mandatory documents required for <span className="font-bold">{designation || 'this role'}</span>:
                                    </p>
                                    <ul className="text-xs list-disc list-inside space-y-1 pt-1 text-rose-800 dark:text-rose-200 font-medium">
                                        {missingMandatoryDocs.map(doc => (
                                            <li key={doc.key}>{doc.label}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="pt-2 flex justify-end">
                                <Button 
                                    type="button" 
                                    variant="secondary"
                                    onClick={() => navigate('/onboarding/pre-upload')}
                                    className="!border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                                >
                                    Upload Missing Documents Now
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 bg-page rounded-lg border border-border flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-xs font-medium text-primary-text">Candidate Photo</span>
                            </div>
                            <div className="p-3 bg-page rounded-lg border border-border flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-xs font-medium text-primary-text">Aadhaar (Front & Back)</span>
                            </div>
                            <div className="p-3 bg-page rounded-lg border border-border flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-xs font-medium text-primary-text">Bank Proof</span>
                            </div>
                            <div className="p-3 bg-page rounded-lg border border-border flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <span className="text-xs font-medium text-primary-text">PAN Card</span>
                            </div>
                        </div>
                    )}
                </section>

                <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Personal Details</h4>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                        <DetailItem label="Employee ID" value={data.personal.employeeId} />
                        <DetailItemWithStatus label="Full Name" value={`${data.personal.firstName} ${data.personal.lastName}`} status={data.personal.verifiedStatus?.name} isVerifying={false} />
                        <DetailItem label="Email" value={data.personal.email} />
                        <DetailItem label="Mobile" value={data.personal.mobile} />
                        <DetailItemWithStatus label="Date of Birth" value={formatDisplayDate(data.personal.dob)} status={data.personal.verifiedStatus?.dob} isVerifying={false} />
                        <DetailItem label="Gender" value={data.personal.gender} />
                        <DetailItemWithStatus 
                            label="Aadhaar Number" 
                            value={resolvedAadhaar || (data.personal.idProofType === 'Aadhaar' ? data.personal.idProofNumber : '')} 
                            status={data.personal.verifiedStatus?.aadhaarNumber ?? (data.personal.idProofType === 'Aadhaar' ? data.personal.verifiedStatus?.idProofNumber : undefined)} 
                            isVerifying={verificationState === 'verifying'} 
                        />
                        {(resolvedPan || (data.personal.idProofType === 'PAN' && data.personal.idProofNumber)) && (
                            <DetailItemWithStatus 
                                label="PAN Number" 
                                value={resolvedPan || (data.personal.idProofType === 'PAN' ? data.personal.idProofNumber : '')} 
                                status={data.personal.verifiedStatus?.panNumber ?? data.personal.verifiedStatus?.panCard ?? (data.personal.idProofType === 'PAN' ? data.personal.verifiedStatus?.idProofNumber : undefined)} 
                                isVerifying={verificationState === 'verifying'} 
                            />
                        )}
                    </dl>
                </section>

                <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Organization Details</h4>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                        <DetailItem label="Site / Client" value={data.organization.organizationName} />
                        <DetailItem label="Designation" value={data.organization.designation} />
                        <DetailItem label="Department" value={data.organization.department} />
                        <DetailItem label="Joining Date" value={formatDisplayDate(data.organization.joiningDate)} />
                    </dl>
                </section>

                 <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Bank & Statutory Details</h4>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                        <DetailItemWithStatus label="Account Holder" value={data.bank.accountHolderName} status={data.bank.verifiedStatus?.accountHolderName} isVerifying={verificationState === 'verifying'} />
                        <DetailItemWithStatus label="Account Number" value={'*'.repeat(Math.max(0, data.bank.accountNumber.length - 4)) + data.bank.accountNumber.slice(-4)} status={data.bank.verifiedStatus?.accountNumber} isVerifying={verificationState === 'verifying'} />
                        <DetailItemWithStatus label="IFSC Code" value={data.bank.ifscCode} status={data.bank.verifiedStatus?.ifscCode} isVerifying={verificationState === 'verifying'} />
                        <DetailItem label="Bank Name" value={data.bank.bankName} />
                        {data.uan.hasPreviousPf && <DetailItemWithStatus label="UAN" value={data.uan.uanNumber} status={data.uan.verifiedStatus?.uanNumber} isVerifying={verificationState === 'verifying'} />}
                        {data.esi.hasEsi && <DetailItemWithStatus label="ESI Number" value={data.esi.esiNumber} status={data.esi.verifiedStatus?.esiNumber} isVerifying={verificationState === 'verifying'} />}
                    </dl>
                </section>
                
                {data.uniforms.length > 0 && (
                  <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Uniform Details</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {data.uniforms.map(item => (
                        <div key={item.itemId} className="bg-page p-3 rounded-md">
                          <p className="font-semibold text-sm">{item.itemName}</p>
                          <p className="text-xs text-muted">Size: {item.sizeLabel} ({item.fit})</p>
                          <p className="text-xs text-muted">Qty: {item.quantity}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {data.biometrics.signatureImage && (
                    <section>
                        <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Biometrics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div>
                                <h5 className="font-semibold text-primary-text">Signature</h5>
                                <div className="mt-2 p-2 border rounded-lg inline-block bg-page">
                                    <img src={data.biometrics.signatureImage.preview} alt="Signature" className="h-24" />
                                </div>
                            </div>
                            {uploadedFingerprints.length > 0 && (
                                <div>
                                    <h5 className="font-semibold text-primary-text">Fingerprints Uploaded</h5>
                                    <ul className="mt-2 list-disc list-inside text-sm text-muted columns-2">
                                        {uploadedFingerprints.map(finger => <li key={finger}>{finger}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
            
            {perfiosApi.enabled && (
                <div className="mt-8 pt-6 border-t">
                    <h3 className="text-lg font-semibold text-primary-text mb-4">Third-Party Verification</h3>
                    <div className="p-4 bg-page rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex-1">
                            <p className="font-medium">Run a background check against official records.</p>
                            <p className="text-sm text-muted">This step is required before you can submit the application.</p>
                            {verificationState === 'failed' && <p className="text-sm text-red-600 mt-2">{verificationMessage}</p>}
                            {verificationState === 'success' && <p className="text-sm text-green-600 mt-2">{verificationMessage}</p>}
                        </div>
                        <Button onClick={handleVerification} isLoading={verificationState === 'verifying'} disabled={verificationState === 'success'}>
                            {verificationState === 'idle' && <><ShieldCheck className="mr-2 h-4 w-4" /> Verify Details</>}
                            {verificationState === 'verifying' && 'Verifying...'}
                            {verificationState === 'failed' && 'Retry Verification'}
                            {verificationState === 'success' && <><CheckCircle className="mr-2 h-4 w-4" /> Verified</>}
                        </Button>
                    </div>
                </div>
            )}
            
            <div className="mt-8 pt-6 border-t">
                <h3 className="text-lg font-semibold text-primary-text mb-4">Generate Official Forms</h3>
                 <div className="p-4 bg-page rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1">
                        <p className="font-medium">Generate and review the official PDF documents.</p>
                        <p className="text-sm text-muted">This step is mandatory before final submission.</p>
                    </div>
                    {data.formsGenerated ? (
                        <div className="flex items-center gap-2 font-semibold text-green-600">
                            <CheckCircle className="h-5 w-5"/>
                            <span>Forms Generated & Confirmed</span>
                        </div>
                    ) : (
                        <Button type="button" onClick={handleGenerateForms}>
                            <FileText className="mr-2 h-4 w-4" /> Generate & Review Forms
                        </Button>
                    )}
                </div>
            </div>

            {/* ── e-Sign: Digital Employment Agreement Notice ── */}
            {data.formsGenerated && (
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <FileSignature className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Digital Signature & Agreement</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                        esignDocUrl 
                                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                    }`}>
                                        {esignDocUrl ? 'Signed' : 'Initiated upon HR Approval'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                                    {esignDocUrl
                                        ? 'The official employment agreement and client NDA have been digitally signed.'
                                        : 'The official digital employment agreement and site NDA will be issued for Aadhaar e-Sign during HR verification and final approval. You can proceed with submitting your application now.'}
                                    {(data as any).ismwFlags?.isMigrant && ' Client NDA will be automatically appended for migrant worker compliance.'}
                                </p>
                                {esignDocUrl && (
                                    <a
                                        href={esignDocUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" /> View Signed Agreement
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-8 pt-6 border-t">
                {!canSubmit && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>
                            To submit application: 
                            {missingMandatoryDocs.length > 0 && ` 1. Upload missing mandatory document(s) (${missingMandatoryDocs.map(d => d.label).join(', ')}).`}
                            {!data.formsGenerated && ` ${missingMandatoryDocs.length > 0 ? '2' : '1'}. Click "Generate & Review Forms" above.`}
                            {perfiosApi.enabled && verificationState !== 'success' && ` ${missingMandatoryDocs.length > 0 ? '3' : '2'}. Complete Third-Party Verification.`}
                        </span>
                    </div>
                )}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <DraftSaveIndicator
                            status={draftSaveStatus}
                            lastSavedAt={lastSavedAt}
                            onManualSave={handleSaveAsDraft}
                        />
                        <p className="text-xs text-muted">All data is auto-saved as you fill each step.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleSaveAsDraft}
                            isLoading={draftSaveStatus === 'saving'}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Save as Draft
                        </Button>
                        {isPendingApproval && isHRUser ? (
                            <Button
                                type="button"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => setIsApproveModalOpen(true)}
                            >
                                <ShieldCheck className="mr-2 h-4 w-4" /> Verify & Approve
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                isLoading={false}
                                disabled={!canSubmit}
                            >
                                Submit Application
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* In-Page Official Forms Booklet Modal */}
            <OnboardingBookletModal 
                isOpen={isBookletModalOpen}
                onClose={() => setIsBookletModalOpen(false)}
                onConfirm={handleConfirmBooklet}
                employeeData={data}
            />

            {/* HR Approval & Digital Signature Modal */}
            <ApproveSubmissionModal
                isOpen={isApproveModalOpen}
                submission={data}
                onClose={() => setIsApproveModalOpen(false)}
                onConfirmApprove={handleConfirmApproveFromReview}
                isApproving={isApproving}
            />
        </form>
    );
};

export default Review;