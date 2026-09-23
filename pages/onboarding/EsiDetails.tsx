import React, { useEffect, useState } from 'react';
// Fix: Use inline type import for SubmitHandler
import { useForm, Controller, type SubmitHandler, type Resolver } from 'react-hook-form';
import { useOutletContext } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useEnrollmentRulesStore } from '../../store/enrollmentRulesStore';
import type { EsiDetails, UploadedFile } from '../../types';
import Input from '../../components/ui/Input';
import FormHeader from '../../components/onboarding/FormHeader';
import DatePicker from '../../components/ui/DatePicker';
import { Info, Loader2, CheckCircle2, XCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import UploadDocument from '../../components/UploadDocument';
import VerifiedInput from '../../components/ui/VerifiedInput';
import { Type } from '@google/genai';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { kycGateway } from '../../services/kyc/kycGateway';

// Fix: Removed generic type argument from yup.object
export const esiDetailsSchema = yup.object({
    hasEsi: yup.boolean().required(),
    esiNumber: yup.string().when('hasEsi', {
        is: true,
        then: (schema) => schema.required('ESI Number is required').matches(/^(\d{10}|\d{17})$/, 'ESI number must be 10 or 17 digits'),
        otherwise: (schema) => schema.optional().nullable(),
    }),
    esiRegistrationDate: yup.string().optional().nullable()
        .test('not-in-future', 'Registration date cannot be in the future', (value) => {
            if(!value) return true;
            return new Date(value.replace(/-/g, '/')) <= new Date();
        }),
    esicBranch: yup.string().optional().nullable(),
    document: yup.mixed().optional().nullable(),
    verifiedStatus: yup.object().optional(),
});

interface OutletContext {
  onValidated: () => Promise<void>;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

type ESICVerifyState = 'idle' | 'loading' | 'active' | 'inactive' | 'error' | 'mismatch';

const checkNameMatch = (name1?: string | null, name2?: string | null): boolean => {
    if (!name1 || !name2) return false;
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (clean1 === clean2) return true;
    const tokens1 = clean1.split(/\s+/).filter(t => t.length > 0);
    const tokens2 = clean2.split(/\s+/).filter(t => t.length > 0);
    if (tokens1.length === 0 || tokens2.length === 0) return false;
    return tokens1.some(t => tokens2.includes(t)) || tokens2.some(t => tokens1.includes(t));
};

const EsiDetails = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { user } = useAuthStore();
    const { data, updateEsi, setEsiVerifiedStatus } = useOnboardingStore();
    const { esiCtcThreshold } = useEnrollmentRulesStore();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [esicVerifyState, setEsicVerifyState] = useState<ESICVerifyState>('idle');
    const [esicMemberInfo, setEsicMemberInfo] = useState<{ memberName: string | null; dispensary: string | null } | null>(null);
    const [cardMemberName, setCardMemberName] = useState<string | null>(null);
    const [nameMatchStatus, setNameMatchStatus] = useState<'matched' | 'mismatch' | 'none'>('none');
    
    const { register, control, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<EsiDetails>({
        // FIX: Cast resolver to resolve type incompatibility between yup and react-hook-form.
        resolver: yupResolver(esiDetailsSchema) as unknown as Resolver<EsiDetails>,
        defaultValues: {
            hasEsi: data.esi?.hasEsi ?? false,
            esiNumber: data.esi?.esiNumber || '',
            esiRegistrationDate: data.esi?.esiRegistrationDate || '',
            esicBranch: data.esi?.esicBranch || '',
            document: data.esi?.document || null,
            verifiedStatus: data.esi?.verifiedStatus || {},
        }
    });
    
    const hasEsi = watch('hasEsi');
    const esiData = watch();

    const isEligibleForEsi = data.personal.salary == null || data.personal.salary <= (esiCtcThreshold || 21000);

    useEffect(() => {
        // Sync form with global store data
        reset({
            hasEsi: data.esi?.hasEsi ?? false,
            esiNumber: data.esi?.esiNumber || '',
            esiRegistrationDate: data.esi?.esiRegistrationDate || '',
            esicBranch: data.esi?.esicBranch || '',
            document: data.esi?.document || null,
            verifiedStatus: data.esi?.verifiedStatus || {},
        });
    }, [data.esi, reset]);

    // This effect syncs the form state back to the Zustand store on change, with a debounce.
    useEffect(() => {
        let debounceTimer: number;
        const subscription = watch((value) => {
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                updateEsi(value as EsiDetails);
            }, 500);
        });
        return () => {
            subscription.unsubscribe();
            clearTimeout(debounceTimer);
        };
    }, [watch, updateEsi]);

    useEffect(() => {
        // If employee is not eligible for ESI (salary above threshold), clear ESI data
        if (!isEligibleForEsi && data.esi.hasEsi) {
            updateEsi({ hasEsi: false, esiNumber: '', esiRegistrationDate: '', esicBranch: '' });
        }
    }, [isEligibleForEsi, data.esi.hasEsi, updateEsi]);

    const onSubmit: SubmitHandler<EsiDetails> = async (formData) => {
        updateEsi(formData);
        await onValidated();
    };
    
    const handleManualInput = () => {
        setEsiVerifiedStatus({ esiNumber: false });
        setEsicVerifyState('idle');
        setEsicMemberInfo(null);
        setNameMatchStatus('none');
    };

    const handleVerifyESIC = async () => {
        const esiNumber = esiData.esiNumber;
        if (!esiNumber || (esiNumber.length !== 10 && esiNumber.length !== 17)) {
            setToast({ message: 'Enter a valid 10 or 17-digit ESI number before verifying.', type: 'error' });
            return;
        }
        setEsicVerifyState('loading');
        setEsicMemberInfo(null);
        try {
            const employeeFullName = `${data.personal.firstName || ''} ${data.personal.lastName || ''}`.trim();
            // Candidate context passed to adapter (fallback in case of demo mode)
            const candidateName = cardMemberName || employeeFullName;
            const result = await kycGateway.verifyESIC({ 
                esicNumber: esiNumber,
                name: candidateName,
                dispensary: esiData.esicBranch || undefined,
            }, data.id);

            if (result.success) {
                const returnedMemberName = (result.memberName || candidateName || '').trim();
                const returnedDispensary = result.dispensary || esiData.esicBranch || null;
                setEsicMemberInfo({ memberName: returnedMemberName, dispensary: returnedDispensary });

                if (result.status === 'active') {
                    // Check returned member name against employee profile name
                    const targetToCheck = employeeFullName || cardMemberName || '';
                    const isMatch = targetToCheck ? checkNameMatch(returnedMemberName, targetToCheck) : true;

                    if (isMatch) {
                        setEsicVerifyState('active');
                        setNameMatchStatus('matched');
                        setEsiVerifiedStatus({ esiNumber: true });
                        setToast({ 
                            message: `ESI Active & Verified ✓ — ${employeeFullName || returnedMemberName}${returnedDispensary ? ` — ${returnedDispensary}` : ''}`, 
                            type: 'success' 
                        });
                    } else {
                        setEsicVerifyState('mismatch');
                        setNameMatchStatus('mismatch');
                        setEsiVerifiedStatus({ esiNumber: false });
                        setToast({ 
                            message: `Name Mismatch ⚠️ — ESIC Registry has "${returnedMemberName}", but employee profile is "${employeeFullName}".`, 
                            type: 'error' 
                        });
                    }
                } else {
                    setEsicVerifyState('inactive');
                    setEsiVerifiedStatus({ esiNumber: false });
                    setToast({ message: 'ESI number found but status is INACTIVE. Please verify with worker.', type: 'error' });
                }
            } else {
                setEsicVerifyState('error');
                setToast({ message: 'ESI verification failed — check the number and retry.', type: 'error' });
            }
        } catch {
            setEsicVerifyState('error');
            setToast({ message: 'ESIC registry unavailable. Try again.', type: 'error' });
        }
    };

    const handleOcrComplete = (extractedData: any) => {
        console.log('[ESI OCR] Raw extracted data:', JSON.stringify(extractedData, null, 2));

        let rawEsi = (extractedData.esiNumber || '').replace(/\D/g, '');
        let rawDate = extractedData.esiRegistrationDate || '';
        let rawBranch = extractedData.esicBranch || '';

        // Robust client-side fallback if rawText is available or if esiNumber was misidentified as phone
        const rawText = extractedData._rawText || '';
        if (rawText) {
            const phoneInRaw = (extractedData.phone || '').replace(/\D/g, '');
            // If rawEsi matches phone number, or is missing/empty, or is not 10/17 digits
            if (!rawEsi || rawEsi === phoneInRaw || (rawEsi.length !== 10 && rawEsi.length !== 17)) {
                // In e-Pehchan layout, Registration Date is followed directly by 10-digit Insurance No.
                // e.g. "25/11/2025 5044267223"
                const posMatch = rawText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+([0-9]{10})\b/);
                if (posMatch) {
                    rawEsi = posMatch[2];
                    if (!rawDate) rawDate = posMatch[1];
                } else {
                    const labMatch = rawText.match(/(?:Insurance\s*No\.?|ESI\s*(?:No\.?|Number)|IP\s*(?:No\.?|Number)|ESIC\s*No\.?)[:\s]+([0-9]{10,17})\b/i);
                    if (labMatch) rawEsi = labMatch[1].replace(/\D/g, '');
                }
            }

            if (!rawDate) {
                const regDateM = rawText.match(/Registration\s*Date[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i) ||
                                 rawText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+[0-9]{10}\b/);
                if (regDateM) rawDate = regDateM[1];
            }

            if (!rawBranch) {
                const branchM = rawText.match(/(?:[0-9]{6}\s+|Dispensary[^\w]*)([A-Za-z\s]+,\s*[A-Z]{2}\s*\([^)]*(?:ESIS|Disp)[^)]*\))/i) ||
                                rawText.match(/([A-Za-z\s]+,\s*[A-Z]{2}\s*\([^)]*(?:ESIS|Disp)[^)]*\))/i) ||
                                rawText.match(/Dispensary\s*\/\s*IMP\s*for\s*IP[:\s]+([A-Za-z0-9,.(\s)\-]+?)(?:\s+(?:Name\s+of\s+Father|Dispensary|REGISTRATION|$))/i);
                if (branchM) rawBranch = branchM[1].replace(/\s{2,}/g, ' ').trim();
            }
        }

        // Extract Name of IP from document if available
        let docName = (extractedData.name || extractedData.employeeName || '').trim();
        if (!docName && rawText) {
            const nMatch = rawText.match(/\bAadhaar\s+([A-Z][A-Za-z\s]{2,35}?)\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s+(?:Male|Female|Other)\b/i) ||
                           rawText.match(/Name\s*of\s*IP[:\s]+([A-Za-z\s]{2,35}?)(?:\s*(?:Date\s*of\s*Birth|\n|\r|$))/i);
            if (nMatch) docName = nMatch[1].trim();
        }
        if (docName) {
            setCardMemberName(docName);
            const employeeFullName = `${data.personal.firstName || ''} ${data.personal.lastName || ''}`.trim();
            if (employeeFullName) {
                const isMatch = checkNameMatch(docName, employeeFullName);
                if (isMatch) {
                    setNameMatchStatus('matched');
                } else {
                    setNameMatchStatus('mismatch');
                    setToast({ 
                        message: `Name Mismatch ⚠️ — ESI Card belongs to "${docName}", but employee profile is "${employeeFullName}".`, 
                        type: 'error' 
                    });
                }
            }
        }

        console.log('[ESI OCR] Parsed → name:', docName, '| esiNumber:', rawEsi, '| date:', rawDate, '| branch:', rawBranch);

        // Normalise DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD for the date input
        let normDate = rawDate;
        const ddmmyyyy = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyy) {
            normDate = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
        }

        // Auto-switch to "has existing ESI" mode
        setValue('hasEsi', true, { shouldValidate: true });
        updateEsi({ hasEsi: true });

        if (rawEsi.length === 10 || rawEsi.length === 17) {
            setValue('esiNumber', rawEsi, { shouldValidate: true });
            updateEsi({ esiNumber: rawEsi });
            console.log('[ESI OCR] ✅ Applied esiNumber to form:', rawEsi);
        } else {
            console.warn('[ESI OCR] ⚠️ esiNumber invalid length:', rawEsi.length, '— value:', rawEsi);
        }

        if (normDate) {
            setValue('esiRegistrationDate', normDate, { shouldValidate: true });
            updateEsi({ esiRegistrationDate: normDate });
            console.log('[ESI OCR] ✅ Applied esiRegistrationDate to form:', normDate);
        }

        if (rawBranch) {
            setValue('esicBranch', rawBranch, { shouldValidate: true });
            updateEsi({ esicBranch: rawBranch });
            console.log('[ESI OCR] ✅ Applied esicBranch to form:', rawBranch);
        }

        if (rawEsi.length === 10 || rawEsi.length === 17) {
            setEsiVerifiedStatus({ esiNumber: false });
            setToast({ message: `ESI Card scanned ✓ — ESI ${rawEsi}${rawBranch ? `, ${rawBranch}` : ''} filled automatically.`, type: 'success' });
        } else {
            setToast({ message: `OCR ran but ESI number not found (got: "${rawEsi || 'empty'}"). Please fill manually.`, type: 'error' });
        }
    };

    // ── ESI OCR Schema — very specific field labels to prevent AI confusion ──
    // The ESIC e-Pehchan card has multiple numeric fields:
    //   "Insurance No." (10-digit) ← THIS is the ESI number
    //   "Mobile Number" (10-digit) ← NOT the ESI number
    //   "UHID" (alphanumeric)       ← NOT the ESI number
    // The descriptions below must be explicit enough for the AI to pick the right one.
    const esiSchema = {
        type: Type.OBJECT,
        properties: {
            esiNumber: {
                type: Type.STRING,
                description: [
                    "The ESIC Insurance Number (also labeled 'Insurance No.' or 'IP No.' or 'ESI No.').",
                    "On the ESIC e-Pehchan card it appears in the PERSONAL DETAILS table next to the label 'Insurance No.'.",
                    "It is typically a 10-digit number (e.g. 5044267223).",
                    "IMPORTANT: Do NOT return the Mobile Number field. The Mobile Number is a different field.",
                    "IMPORTANT: Do NOT return the UHID (which starts with state code like HP01...).",
                    "Return ONLY the value next to 'Insurance No.' label.",
                ].join(' '),
            },
            esiRegistrationDate: {
                type: Type.STRING,
                description: [
                    "The Registration Date of the ESI card holder.",
                    "On ESIC e-Pehchan card this is labeled 'Registration Date' in the PERSONAL DETAILS section.",
                    "Return the date exactly as printed, in DD/MM/YYYY format (e.g. 25/11/2025).",
                ].join(' '),
            },
            name: {
                type: Type.STRING,
                description: [
                    "The full name of the Insured Person (IP).",
                    "On ESIC e-Pehchan card this appears under 'Name of IP' in the PERSONAL DETAILS section.",
                    "Example: 'DEEPAN GURUNG'.",
                ].join(' '),
            },
            esicBranch: {
                type: Type.STRING,
                description: [
                    "The ESIC Branch or Dispensary name.",
                    "On ESIC e-Pehchan card this is labeled 'Dispensary / IMP for IP' in the REGISTRATION DETAILS section.",
                    "Return the full dispensary name (e.g. 'Marathahalli, KA (ESIS Disp.)').",
                ].join(' '),
            },
        },
        required: ["esiNumber"],
    };

    if (!isEligibleForEsi) {
        const message = `Employee is not eligible for statutory ESI as their salary (₹${data.personal.salary?.toLocaleString()}) is above the ₹20,000 / ₹${(esiCtcThreshold || 21000).toLocaleString()} threshold. Group Medical Cover (GMC) is mandatory and applies instead.`;
        return (
            <form onSubmit={async (e) => { e.preventDefault(); await onValidated(); }} id="esi-form">
                <FormHeader title="ESI Details" subtitle="Employee's State Insurance eligibility." />
                <div className="mt-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-700 dark:text-amber-400">
                    <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                        <p className="text-sm font-semibold">Statutory ESI Not Applicable</p>
                        <p className="text-xs text-muted mt-1">{message}</p>
                    </div>
                </div>
            </form>
        );
    }

    if (isMobile) {
        return (
            <form onSubmit={handleSubmit(onSubmit)} id="esi-form">
                <p className="text-sm text-gray-400 mb-6">Provide your Employee's State Insurance number if applicable.</p>
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-3">
                        <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${hasEsi === true ? 'border-[#32cd32] bg-[#243524]' : 'border-[#374151]'}`}>
                            <input 
                                type="radio" 
                                name="hasEsiMob" 
                                checked={hasEsi === true} 
                                onChange={() => { setValue('hasEsi', true, { shouldValidate: true }); updateEsi({ hasEsi: true }); }} 
                                className="h-4 w-4 text-accent" 
                            />
                            <span className="text-xs font-medium text-white">Existing ESI</span>
                        </label>
                        <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${hasEsi === false ? 'border-[#32cd32] bg-[#243524]' : 'border-[#374151]'}`}>
                            <input 
                                type="radio" 
                                name="hasEsiMob" 
                                checked={hasEsi === false} 
                                onChange={() => { setValue('hasEsi', false, { shouldValidate: true }); updateEsi({ hasEsi: false }); }} 
                                className="h-4 w-4 text-accent" 
                            />
                            <span className="text-xs font-medium text-white">Fresh / New ESI</span>
                        </label>
                     </div>

                    {!hasEsi && (
                        <div className="p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs">
                            ✓ Fresh ESI will be registered and filled manually by HR after onboarding.
                        </div>
                    )}

                    {hasEsi && (
                         <div className="space-y-4 animate-fade-in-down">
                            <div>
                                <input placeholder="ESI Number (10 or 17 digits)" {...register('esiNumber')} className="form-input"/>
                                {errors.esiNumber && <p className="text-xs text-red-500 mt-1">{errors.esiNumber.message}</p>}
                            </div>
                            <input type="date" {...register('esiRegistrationDate')} className="form-input"/>
                            <input placeholder="ESIC Branch (Optional)" {...register('esicBranch')} className="form-input"/>
                            <Controller name="document" control={control} render={({ field }) => (
                                <UploadDocument
                                    label="Upload ESI Card (Optional)"
                                    file={field.value}
                                    onFileChange={field.onChange}
                                    allowCapture
                                    costingItemName="ESI Card OCR"
                                    onOcrComplete={handleOcrComplete}
                                    ocrSchema={esiSchema}
                                    setToast={setToast}
                                    docType="ESI"
                                />
                            )}/>
                        </div>
                    )}
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} id="esi-form">
             <FormHeader title="ESI Details" subtitle="Employee's State Insurance (Statutory Coverage)." />

            <div className="space-y-6">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold">
                            Eligible for Statutory ESI (Salary: ₹{data.personal.salary ? data.personal.salary.toLocaleString() : 'Below 21,000'})
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                            Employees with salary up to ₹21,000 are eligible for ESIC. If candidate has an existing ESI number, feed it below. If fresh worker, select "No / Fresh ESI" and details can be filled manually by HR.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-semibold text-primary-text block">Do you have an existing ESI Number?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${hasEsi === true ? 'border-accent bg-accent-light dark:bg-accent/10' : 'border-border hover:border-slate-300'}`}>
                            <input 
                                type="radio" 
                                name="hasEsiRadio" 
                                checked={hasEsi === true} 
                                onChange={() => { setValue('hasEsi', true, { shouldValidate: true }); updateEsi({ hasEsi: true }); }} 
                                className="h-4 w-4 text-accent mt-1" 
                            />
                            <div className="ml-3">
                                <span className="text-sm font-semibold text-primary-text block">Yes, I have an existing ESI Number</span>
                                <span className="text-xs text-muted">Feed 10 or 17-digit ESI number, dispensary, or upload ESI card</span>
                            </div>
                        </label>

                        <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${hasEsi === false ? 'border-accent bg-accent-light dark:bg-accent/10' : 'border-border hover:border-slate-300'}`}>
                            <input 
                                type="radio" 
                                name="hasEsiRadio" 
                                checked={hasEsi === false} 
                                onChange={() => { setValue('hasEsi', false, { shouldValidate: true }); updateEsi({ hasEsi: false }); }} 
                                className="h-4 w-4 text-accent mt-1" 
                            />
                            <div className="ml-3">
                                <span className="text-sm font-semibold text-primary-text block">No / Fresh ESI Registration Required</span>
                                <span className="text-xs text-muted">Employer will register fresh ESI; details can be filled manually by HR</span>
                            </div>
                        </label>
                    </div>
                </div>

                {hasEsi && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-down pt-2">
                        <div className="space-y-6">
                            <VerifiedInput
                                label="ESI Number (10 or 17 digits)"
                                id="esiNumber"
                                hasValue={!!esiData.esiNumber}
                                isVerified={data.esi.verifiedStatus?.esiNumber === true}
                                onManualInput={handleManualInput}
                                registration={register('esiNumber')}
                                error={errors.esiNumber?.message}
                            />
                            <Controller name="esiRegistrationDate" control={control} render={({ field }) => (
                               <DatePicker label="ESI Registration Date (Optional)" id="esiRegistrationDate" error={errors.esiRegistrationDate?.message} value={field.value} onChange={field.onChange} maxDate={new Date()} />
                            )} />
                            <Input label="ESIC Branch / Dispensary (Optional)" id="esicBranch" registration={register('esicBranch')} error={errors.esicBranch?.message}/>

                            {/* ── ESIC Registry Verify Button ── */}
                            <div className="flex flex-col gap-2 pt-2 border-t">
                                <button
                                    id="esic-verify-btn"
                                    type="button"
                                    onClick={handleVerifyESIC}
                                    disabled={esicVerifyState === 'loading' || !esiData.esiNumber}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50 hover:bg-accent/90 transition-colors w-fit"
                                >
                                    {esicVerifyState === 'loading' ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Verifying ESIC…</>
                                    ) : (
                                        <><ShieldCheck className="h-4 w-4" /> Verify ESI Number</>
                                    )}
                                </button>
                                {esicVerifyState === 'active' && esicMemberInfo && (
                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 animate-fade-in-down">
                                        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                            ESI Active & Verified ✓ — {data.personal.firstName ? `${data.personal.firstName} ${data.personal.lastName}` : esicMemberInfo.memberName}
                                            <span className="text-xs text-muted font-normal">({kycGateway.activeVendor()})</span>
                                        </div>
                                        <p className="text-xs text-muted ml-6">
                                            {esicMemberInfo.memberName ? `Registry: ${esicMemberInfo.memberName}` : ''}
                                            {esicMemberInfo.dispensary ? ` | Dispensary: ${esicMemberInfo.dispensary}` : ''}
                                        </p>
                                    </div>
                                )}
                                {esicVerifyState === 'mismatch' && esicMemberInfo && (
                                    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 animate-fade-in-down">
                                        <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400 font-bold">
                                            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                            Name Mismatch — Not Verified
                                        </div>
                                        <p className="text-xs text-rose-800 dark:text-rose-300 ml-6 leading-relaxed">
                                            ESIC Registry returned <strong>"{esicMemberInfo.memberName}"</strong>, but employee profile has <strong>"{data.personal.firstName} {data.personal.lastName}"</strong>.
                                        </p>
                                        <p className="text-[11px] text-rose-600 dark:text-rose-400 ml-6">
                                            Please verify if this ESI number belongs to this worker, or check candidate identity.
                                        </p>
                                    </div>
                                )}
                                {esicVerifyState === 'inactive' && (
                                    <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                                        <AlertTriangle className="h-4 w-4" /> ESI found but INACTIVE — manual review required.
                                    </div>
                                )}
                                {esicVerifyState === 'error' && (
                                    <div className="flex items-center gap-2 text-sm text-red-600">
                                        <XCircle className="h-4 w-4" /> Verification failed — retry.
                                    </div>
                                )}

                                {/* Document Name Match Status Banner (shown after OCR) */}
                                {cardMemberName && esicVerifyState !== 'active' && esicVerifyState !== 'mismatch' && (
                                    <div className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border ${
                                        nameMatchStatus === 'matched' 
                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                                            : nameMatchStatus === 'mismatch'
                                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 text-rose-700 dark:text-rose-400'
                                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {nameMatchStatus === 'matched' ? (
                                            <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" /> Card Name: <strong>{cardMemberName}</strong> (Matches Employee Profile ✓)</>
                                        ) : nameMatchStatus === 'mismatch' ? (
                                            <><AlertTriangle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" /> Card Name: <strong>{cardMemberName}</strong> vs Profile: <strong>{data.personal.firstName} {data.personal.lastName}</strong> (Mismatch)</>
                                        ) : (
                                            <><Info className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" /> Card Member Name: <strong>{cardMemberName}</strong></>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-0">
                            <Controller name="document" control={control} render={({ field }) => (
                                <UploadDocument
                                    label="Upload ESI Card (Optional)"
                                    file={field.value}
                                    onFileChange={field.onChange}
                                    onOcrComplete={handleOcrComplete}
                                    ocrSchema={esiSchema}
                                    setToast={setToast}
                                    costingItemName="ESI Card OCR"
                                    docType="ESI"
                                />
                            )}/>
                        </div>
                    </div>
                )}
            </div>
        </form>
    );
};

export default EsiDetails;