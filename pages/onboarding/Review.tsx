import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useSettingsStore } from '../../store/settingsStore';
import Button from '../../components/ui/Button';
import FormHeader from '../../components/onboarding/FormHeader';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ShieldCheck, FileText, Save } from 'lucide-react';
import { api } from '../../services/api';
import type { VerificationResult, EducationRecord, UploadedFile } from '../../types';
import { useAuthStore } from '../../store/authStore';
import DraftSaveIndicator, { type DraftSaveStatus } from '../../components/onboarding/DraftSaveIndicator';
import ESignFlow from '../../components/onboarding/ESignFlow';
import OnboardingBookletModal from '../../components/onboarding/OnboardingBookletModal';


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
    const [esignDocUrl, setEsignDocUrl] = useState<string | null>(null);
    const [isBookletModalOpen, setIsBookletModalOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobileView = user?.role === 'field_staff' && isMobile;

    const [verificationState, setVerificationState] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
    const [verificationMessage, setVerificationMessage] = useState('');

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

    const canSubmit = (verificationState === 'success' || !perfiosApi.enabled) && data.formsGenerated && !!esignDocUrl;
    
    const resolvedAadhaar = data.personal.aadhaarNumber || (/^\d{12}$/.test(data.personal.idProofNumber || '') ? data.personal.idProofNumber : '');
    const resolvedPan = data.personal.panNumber || (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(data.personal.idProofNumber || '') ? data.personal.idProofNumber : '');

    if (isMobileView) {
        return (
             <form onSubmit={async (e) => { e.preventDefault(); await onSubmit(); }} id="review-form">
                <p className="text-sm text-gray-400 mb-6">Please review all your details carefully before submitting.</p>
                 <div className="space-y-6">
                    <section>
                        <h4 className="fo-section-title mb-2">Personal Details</h4>
                        <div className="divide-y divide-border">
                             <MobileDetailItem label="Full Name" value={`${data.personal.firstName} ${data.personal.lastName}`} />
                             <MobileDetailItem label="Email" value={data.personal.email} />
                             <MobileDetailItem label="Mobile" value={data.personal.mobile} />
                             <MobileDetailItem label="Date of Birth" value={data.personal.dob} />
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
                </div>

                {data.formsGenerated && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <h3 className="text-base font-semibold text-white mb-1">Digital Signature</h3>
                        <p className="text-xs text-slate-400 mb-4">
                            Worker must sign the employment agreement digitally before submission.
                        </p>
                        {esignDocUrl ? (
                            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                                <CheckCircle className="h-5 w-5" />
                                Agreement signed — ready to submit
                            </div>
                        ) : (
                            <ESignFlow
                                employeeId={data.id}
                                employeeName={`${data.personal.firstName} ${data.personal.lastName}`}
                                mobile={data.personal.mobile}
                                signerEmail={data.personal.email}
                                baseContractUrl={import.meta.env.VITE_EMPLOYMENT_AGREEMENT_PDF_URL ?? ''}
                                clientSiteId={data.organization.site ?? data.organization.organizationName}
                                onSigned={(url) => setEsignDocUrl(url)}
                            />
                        )}
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
        <form onSubmit={async (e) => { e.preventDefault(); await onSubmit(); }} id="review-form">
            <FormHeader title="Review & Submit" subtitle="Please review all your details carefully before submitting." />
            
            <div className="space-y-8">
                <section>
                    <h4 className="text-md font-semibold text-primary-text mb-4 border-b pb-2">Personal Details</h4>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                        <DetailItemWithStatus label="Full Name" value={`${data.personal.firstName} ${data.personal.lastName}`} status={data.personal.verifiedStatus?.name} isVerifying={false} />
                        <DetailItem label="Email" value={data.personal.email} />
                        <DetailItem label="Mobile" value={data.personal.mobile} />
                        <DetailItemWithStatus label="Date of Birth" value={data.personal.dob} status={data.personal.verifiedStatus?.dob} isVerifying={false} />
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
                        <DetailItem label="Joining Date" value={data.organization.joiningDate} />
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

            {/* ── e-Sign: Digital Employment Agreement ── */}
            {data.formsGenerated && (
                <div className="mt-8 pt-6 border-t">
                    <h3 className="text-lg font-semibold text-primary-text mb-1">Digital Signature</h3>
                    <p className="text-sm text-muted mb-4">
                        Worker must sign the employment agreement digitally before submission.
                        {(data as any).ismwFlags?.isMigrant && ' (Client NDA will be appended for migrant worker compliance.)'}
                    </p>
                    {esignDocUrl ? (
                        <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                            <CheckCircle className="h-5 w-5" />
                            Agreement signed — ready to submit
                        </div>
                    ) : (
                        <ESignFlow
                            employeeId={data.id}
                            employeeName={`${data.personal.firstName} ${data.personal.lastName}`}
                            mobile={data.personal.mobile}
                            signerEmail={data.personal.email}
                            baseContractUrl={import.meta.env.VITE_EMPLOYMENT_AGREEMENT_PDF_URL ?? ''}
                            clientSiteId={data.organization.site ?? data.organization.organizationName}
                            onSigned={(url) => setEsignDocUrl(url)}
                        />
                    )}
                </div>
            )}

            <div className="mt-8 pt-6 border-t">
                {!canSubmit && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>
                            To submit application: 
                            {!data.formsGenerated && ' 1. Click "Generate & Review Forms" above.'}
                            {data.formsGenerated && !esignDocUrl && ' 2. Complete the Digital Signature below.'}
                            {perfiosApi.enabled && verificationState !== 'success' && ' 3. Complete Third-Party Verification.'}
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
                        <Button
                            type="submit"
                            isLoading={false}
                            disabled={!canSubmit}
                        >
                            Submit Application
                        </Button>
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
        </form>
    );
};

export default Review;