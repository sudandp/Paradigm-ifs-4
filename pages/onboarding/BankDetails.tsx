import React, { useEffect, useState, useRef } from 'react';
// Fix: Use inline type import for SubmitHandler
import { useForm, Controller, type SubmitHandler, type Resolver } from 'react-hook-form';
// The named import from react-router-dom is correct. No changes were needed.
import { useOutletContext } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { BankDetails, UploadedFile } from '../../types';
import FormHeader from '../../components/onboarding/FormHeader';
import UploadDocument from '../../components/UploadDocument';
import { Type } from '@google/genai';
import VerifiedInput from '../../components/ui/VerifiedInput';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { AlertTriangle, CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { kycGateway } from '../../services/kyc/kycGateway';

const formatNameToTitleCase = (value: string | undefined) => {
    if (!value) return '';
    return value.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase());
}

const nameValidation = yup.string().matches(/^[a-zA-Z\s.'-]*$/, 'Name can only contain letters and spaces').transform(formatNameToTitleCase);

// Fix: Removed generic type argument from yup.object and yup.mixed
export const bankDetailsSchema = yup.object({
    accountHolderName: nameValidation.required('Account holder name is required'),
    accountNumber: yup.string().required('Account number is required').matches(/^[0-9]+$/, "Must be only digits"),
    confirmAccountNumber: yup.string()
        .oneOf([yup.ref('accountNumber')], 'Account numbers must match')
        .required('Please confirm your account number'),
    ifscCode: yup.string().required('IFSC code is required').transform(v => v.toUpperCase()).matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g., SBIN0123456)'),
    bankName: yup.string().required('Bank name is required'),
    branchName: yup.string().required('Branch name is required'),
    bankProof: yup.mixed().optional().nullable(),
    nameMismatchReason: yup.string().optional().nullable(),
    nameMismatchAcknowledged: yup.boolean().optional(),
    nameMismatchAcknowledgedBy: yup.string().optional().nullable(),
    nameMismatchAcknowledgedAt: yup.string().optional().nullable(),
    verifiedStatus: yup.object().optional(),
}).defined();

interface OutletContext {
  onValidated: () => Promise<void>;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

type PennyDropState = 'idle' | 'loading' | 'matched' | 'mismatch' | 'error';

const MISMATCH_REASONS = [
    "Employee has no bank account — Father's account provided",
    "Employee has no bank account — Mother's account provided",
    "Employee has no bank account — Spouse's account provided",
    "Joint account with family member",
    "Spelling variation / Initial difference in bank record",
];

const BankDetails = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { user } = useAuthStore();
    const { data, updateBank, setBankVerifiedStatus } = useOnboardingStore();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [pennyDropState, setPennyDropState] = useState<PennyDropState>('idle');
    const [pennyDropName, setPennyDropName] = useState<string | null>(null);
    const [mismatchErrors, setMismatchErrors] = useState<{ reason?: string; ack?: string }>({});

    const { register, handleSubmit, formState: { errors }, control, setValue, watch, reset } = useForm<BankDetails>({
        // FIX: Cast resolver to resolve type incompatibility between yup and react-hook-form.
        resolver: yupResolver(bankDetailsSchema) as unknown as Resolver<BankDetails>,
        defaultValues: data.bank,
    });
    
    const loadedRecordIdRef = useRef<string | null>(null);

    useEffect(() => {
        const currentRecordId = data.id || 'new';
        if (loadedRecordIdRef.current !== currentRecordId) {
            loadedRecordIdRef.current = currentRecordId;
            reset(data.bank);
        }
    }, [data.id, data.bank, reset]);
    
    // This effect syncs the form state back to the Zustand store on change, with a debounce.
    useEffect(() => {
        let debounceTimer: number;
        const subscription = watch((value) => {
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                updateBank(value as BankDetails);
            }, 500);
        });
        return () => {
            subscription.unsubscribe();
            clearTimeout(debounceTimer);
        };
    }, [watch, updateBank]);

    const bankData = watch();

    // If account holder name is empty (e.g. user didn't upload bank proof), auto-align with personal full name
    useEffect(() => {
        if (!bankData.accountHolderName && !data.bank.accountHolderName) {
            const fullName = `${data.personal.firstName || ''} ${data.personal.lastName || ''}`.trim();
            if (fullName) {
                const formatted = formatNameToTitleCase(fullName);
                setValue('accountHolderName', formatted, { shouldValidate: true });
                updateBank({ accountHolderName: formatted });
            }
        }
    }, [data.personal.firstName, data.personal.lastName, data.bank.accountHolderName, bankData.accountHolderName, setValue, updateBank]);

    const employeeFullName = `${data.personal.firstName || ''} ${data.personal.lastName || ''}`.trim().toLowerCase();
    const accountHolderNameLower = (bankData.accountHolderName || '').trim().toLowerCase();
    const isNameMismatch = !!(bankData.accountHolderName && employeeFullName && accountHolderNameLower !== employeeFullName);

    useEffect(() => {
        if (!isNameMismatch && (mismatchErrors.reason || mismatchErrors.ack)) {
            setMismatchErrors({});
        }
    }, [isNameMismatch, mismatchErrors.reason, mismatchErrors.ack]);

    useEffect(() => {
        const ifsc = bankData.ifscCode;
        if (!ifsc) return;
        const normalizedIfsc = ifsc.toUpperCase().trim();
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (ifscRegex.test(normalizedIfsc)) {
            const fetchBankDetails = async () => {
                try {
                    const response = await fetch(`https://ifsc.razorpay.com/${normalizedIfsc}`);
                    if (response.ok) {
                        const resData = await response.json();
                        if (resData.BANK) {
                            setValue('bankName', resData.BANK, { shouldValidate: true });
                        }
                        if (resData.BRANCH) {
                            setValue('branchName', resData.BRANCH, { shouldValidate: true });
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch bank details from IFSC:", err);
                }
            };
            fetchBankDetails();
        }
    }, [bankData.ifscCode, setValue]);

    const onSubmit: SubmitHandler<BankDetails> = async (formData) => {
        // Enforce Name Mismatch Verification & Field Officer Acknowledgement
        if (isNameMismatch) {
            const reason = (formData.nameMismatchReason || watch('nameMismatchReason') || '').trim();
            const acknowledged = Boolean(formData.nameMismatchAcknowledged ?? watch('nameMismatchAcknowledged'));

            const newErrors: { reason?: string; ack?: string } = {};
            if (!reason) {
                newErrors.reason = 'Please provide a valid reason explaining why the bank account name differs from the employee profile name.';
            }
            if (!acknowledged) {
                newErrors.ack = 'Field Officer acknowledgement is mandatory before proceeding to the next stage.';
            }

            if (newErrors.reason || newErrors.ack) {
                setMismatchErrors(newErrors);
                setToast({
                    message: 'Name mismatch detected: Please provide a reason and confirm Field Officer acknowledgement before proceeding.',
                    type: 'error'
                });
                const section = document.getElementById('name-mismatch-section');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return; // STOP THERE ONLY! Do NOT allow proceeding.
            }
        }

        const officerName = user?.name || 'Field Officer';
        const updatedPayload: BankDetails = {
            ...formData,
            nameMismatchReason: isNameMismatch ? (formData.nameMismatchReason || watch('nameMismatchReason') || '').trim() : undefined,
            nameMismatchAcknowledged: isNameMismatch ? true : false,
            nameMismatchAcknowledgedBy: isNameMismatch ? officerName : undefined,
            nameMismatchAcknowledgedAt: isNameMismatch ? (data.bank.nameMismatchAcknowledgedAt || new Date().toISOString()) : undefined,
        };

        updateBank(updatedPayload);
        await onValidated();
    };

    const handlePennyDrop = async () => {
        const { accountNumber, ifscCode } = bankData;
        if (!accountNumber || !ifscCode) {
            setToast({ message: 'Enter account number and IFSC code before verifying.', type: 'error' });
            return;
        }
        setPennyDropState('loading');
        setPennyDropName(null);
        try {
            const result = await kycGateway.pennyDrop({
                accountNumber,
                ifsc: ifscCode.toUpperCase(),
                employeeId: data.id,
            });
            if (result.success && result.nameReturned) {
                setPennyDropName(result.nameReturned);
                // Name match: compare returned bank name vs employee name (case-insensitive)
                const bankName = result.nameReturned.toLowerCase().trim();
                const empName = `${data.personal.firstName} ${data.personal.lastName}`.toLowerCase().trim();
                const isMatch = bankName.includes(empName.split(' ')[0]) || empName.includes(bankName.split(' ')[0]);
                if (isMatch) {
                    setPennyDropState('matched');
                    setBankVerifiedStatus({ accountNumber: true });
                    setToast({ message: `Account verified ✓ Name: ${result.nameReturned}${result.cachedHit ? ' (cached)' : ''}`, type: 'success' });
                } else {
                    setPennyDropState('mismatch');
                    setToast({ message: `Name mismatch — Bank: "${result.nameReturned}" vs Profile: "${data.personal.firstName} ${data.personal.lastName}"`, type: 'error' });
                }
            } else {
                setPennyDropState('error');
                setToast({ message: 'Bank account verification failed. Check account number and IFSC.', type: 'error' });
            }
        } catch (err) {
            setPennyDropState('error');
            setToast({ message: 'Verification service unavailable. Try again.', type: 'error' });
        }
    };

    const handleNameBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setValue('accountHolderName', formatNameToTitleCase(value), { shouldValidate: true });
    };

     const handleManualInput = (fieldsToUnverify: Array<keyof BankDetails['verifiedStatus']>) => {
        const statusUpdate: Partial<BankDetails['verifiedStatus']> = {};
        fieldsToUnverify.forEach(field => {
            statusUpdate[field] = false;
        });
        setBankVerifiedStatus(statusUpdate);
    };

    const handleOcrComplete = (extractedData: any) => {
        const bankUpdate: Partial<BankDetails> = {};
        const newVerifiedStatus: Partial<BankDetails['verifiedStatus']> = {};

        if (extractedData.accountHolderName) {
            const formattedName = formatNameToTitleCase(extractedData.accountHolderName);
            setValue('accountHolderName', formattedName, { shouldValidate: true });
            bankUpdate.accountHolderName = formattedName;
            newVerifiedStatus.accountHolderName = true;
        }
        if (extractedData.accountNumber) {
            const acNum = extractedData.accountNumber.replace(/\D/g, '');
            setValue('accountNumber', acNum, { shouldValidate: true });
            setValue('confirmAccountNumber', acNum, { shouldValidate: true });
            bankUpdate.accountNumber = acNum;
            bankUpdate.confirmAccountNumber = acNum;
            newVerifiedStatus.accountNumber = true;
        }
        if (extractedData.ifscCode) {
            const ifsc = extractedData.ifscCode.toUpperCase().replace(/\s/g, '');
            setValue('ifscCode', ifsc, { shouldValidate: true });
            bankUpdate.ifscCode = ifsc;
            newVerifiedStatus.ifscCode = true;
        }
        if (extractedData.bankName) {
            setValue('bankName', extractedData.bankName, { shouldValidate: true });
            bankUpdate.bankName = extractedData.bankName;
        }
        if (extractedData.branchName) {
            setValue('branchName', extractedData.branchName, { shouldValidate: true });
            bankUpdate.branchName = extractedData.branchName;
        }

        if (Object.keys(bankUpdate).length > 0) {
            updateBank(bankUpdate);
        }
        setBankVerifiedStatus(newVerifiedStatus);
        setToast({ message: 'Bank details extracted. Please review.', type: 'success' });
    };

    const bankProofSchema = {
        type: Type.OBJECT,
        properties: {
            accountHolderName: { type: Type.STRING, description: "The account holder's full name." },
            accountNumber: { type: Type.STRING, description: "The full bank account number." },
            ifscCode: { type: Type.STRING, description: "The bank's IFSC code." },
            bankName: { type: Type.STRING, description: "The name of the bank (e.g., 'State Bank of India')." },
            branchName: { type: Type.STRING, description: "The name of the bank branch (e.g., 'Koramangala Branch')." },
        },
        required: ["accountHolderName", "accountNumber", "ifscCode", "bankName", "branchName"],
    };

    const renderNameMismatchSection = () => {
        if (!isNameMismatch) return null;

        const officerName = user?.name || 'Field Officer';
        const currentReason = watch('nameMismatchReason') || '';
        const currentAck = watch('nameMismatchAcknowledged') || false;

        return (
            <div 
                id="name-mismatch-section" 
                className="rounded-xl border-2 border-amber-400/80 dark:border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/30 p-4 sm:p-5 shadow-sm transition-all"
            >
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5 border border-amber-300 dark:border-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                                Account Name Mismatch Resolution Required
                            </h4>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                Action Required
                            </span>
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                            The bank account holder name differs from the candidate's profile name. Under company policy, crediting salary to a family member's or third-party account requires an authorized reason and Field Officer acknowledgement before proceeding.
                        </p>

                        {/* Name Comparison Pill Box */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white/90 dark:bg-slate-900/80 p-3 rounded-lg border border-amber-200 dark:border-amber-900/60">
                            <div>
                                <span className="text-muted block text-[10px] uppercase font-semibold">Employee Profile Name</span>
                                <span className="font-semibold text-primary-text text-sm">
                                    {data.personal.firstName || ''} {data.personal.lastName || ''}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted block text-[10px] uppercase font-semibold">Bank Account Holder Name</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400 text-sm">
                                    {bankData.accountHolderName || '-'}
                                </span>
                            </div>
                        </div>

                        {/* Quick Reason Selector Chips */}
                        <div className="mt-3.5">
                            <label className="block text-xs font-semibold text-amber-950 dark:text-amber-100 mb-1.5">
                                Select Common Reason (Click to auto-fill):
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {MISMATCH_REASONS.map((preset) => {
                                    const isSelected = currentReason === preset;
                                    return (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => {
                                                setValue('nameMismatchReason', preset, { shouldValidate: true, shouldDirty: true });
                                                setMismatchErrors(prev => ({ ...prev, reason: undefined }));
                                            }}
                                            className={`text-xs px-3 py-1.5 rounded-lg border text-left transition-all ${
                                                isSelected 
                                                    ? 'bg-amber-600 text-white border-amber-600 shadow font-semibold' 
                                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-amber-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Textarea for Reason */}
                        <div className="mt-3">
                            <label htmlFor="nameMismatchReason" className="block text-xs font-semibold text-amber-950 dark:text-amber-100 mb-1">
                                Specific Reason for Name Mismatch <span className="text-red-500 font-bold">*</span>
                            </label>
                            <textarea
                                id="nameMismatchReason"
                                rows={2}
                                placeholder="E.g., Employee does not have an active bank account. Father's account provided with candidate's consent."
                                {...register('nameMismatchReason', {
                                    onChange: () => {
                                        if (mismatchErrors.reason) {
                                            setMismatchErrors(prev => ({ ...prev, reason: undefined }));
                                        }
                                    }
                                })}
                                className={`w-full text-xs rounded-lg border p-2.5 bg-white dark:bg-slate-900 text-primary-text placeholder-muted transition-colors ${
                                    mismatchErrors.reason 
                                        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                                        : 'border-amber-300 dark:border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                                }`}
                            />
                            {mismatchErrors.reason && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                                    {mismatchErrors.reason}
                                </p>
                            )}
                        </div>

                        {/* Field Officer Acknowledgement Checkbox */}
                        <div className={`mt-3.5 p-3 rounded-lg border transition-all ${
                            currentAck 
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700' 
                                : mismatchErrors.ack 
                                    ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700' 
                                    : 'bg-white/90 dark:bg-slate-900/80 border-amber-300 dark:border-slate-700'
                        }`}>
                            <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="nameMismatchAcknowledged"
                                    {...register('nameMismatchAcknowledged', {
                                        onChange: (e) => {
                                            if (e.target.checked) {
                                                setMismatchErrors(prev => ({ ...prev, ack: undefined }));
                                            }
                                        }
                                    })}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div className="text-xs">
                                    <span className="font-bold text-primary-text block">
                                        Field Officer Verification & Acknowledgement <span className="text-red-500 font-bold">*</span>
                                    </span>
                                    <span className="text-muted block mt-0.5 leading-relaxed">
                                        I, <strong className="text-primary-text">{officerName}</strong> (Field Officer), confirm and acknowledge that I have verified the relationship with the candidate and inspected relationship proof. I verify the candidate's consent to credit salary into this account.
                                    </span>
                                </div>
                            </label>
                            {mismatchErrors.ack && (
                                <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                                    {mismatchErrors.ack}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    
    if (isMobile) {
        return (
            <form onSubmit={handleSubmit(onSubmit)} id="bank-form">
                <p className="text-sm text-gray-400 mb-6">Your salary will be credited to this account.</p>
                <div className="space-y-4">
                    <div>
                        <input placeholder="Account Holder Name" {...register('accountHolderName')} onBlur={handleNameBlur} className="form-input w-full"/>
                        {isNameMismatch && (
                            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0 text-yellow-500" />
                                Name mismatch: Profile name is "{data.personal.firstName || ''} {data.personal.lastName || ''}"
                            </p>
                        )}
                    </div>
                    <input placeholder="Bank Name" {...register('bankName')} className="form-input"/>
                    <input placeholder="Account Number" {...register('accountNumber')} className="form-input"/>
                    <input placeholder="Confirm Account Number" {...register('confirmAccountNumber')} className="form-input"/>
                    <input placeholder="IFSC Code" {...register('ifscCode')} className="form-input"/>
                    <input placeholder="Branch Name" {...register('branchName')} className="form-input"/>
                    <Controller name="bankProof" control={control} render={({ field }) => (
                        <UploadDocument label="Upload Bank Proof (Optional)" file={field.value} onFileChange={field.onChange} allowCapture docType="Bank" onOcrComplete={handleOcrComplete} ocrSchema={bankProofSchema} setToast={setToast} />
                    )}/>
                    {renderNameMismatchSection()}
                </div>
            </form>
        );
    }


    return (
        <form onSubmit={handleSubmit(onSubmit)} id="bank-form">
            <FormHeader title="Bank Details" subtitle="Your salary will be credited to this account." />
            
            <div className="space-y-6">
                <Controller name="bankProof" control={control} render={({ field }) => (
                    <UploadDocument
                        label="Upload Bank Proof (Cancelled Cheque / Cheque Book)"
                        file={field.value}
                        onFileChange={field.onChange}
                        onOcrComplete={handleOcrComplete}
                        ocrSchema={bankProofSchema}
                        setToast={setToast}
                        docType="Bank"
                    />
                )}/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t">
                    <div>
                        <VerifiedInput 
                            label="Account Holder Name" 
                            id="accountHolderName" 
                            hasValue={!!bankData.accountHolderName}
                            isVerified={data.bank.verifiedStatus?.accountHolderName === true}
                            onManualInput={() => handleManualInput(['accountHolderName'])}
                            error={errors.accountHolderName?.message} 
                            registration={register('accountHolderName')} 
                            onBlur={handleNameBlur}
                        />
                        {isNameMismatch && (
                            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0 text-yellow-500" />
                                Name mismatch: Profile name is "{data.personal.firstName || ''} {data.personal.lastName || ''}"
                            </p>
                        )}
                    </div>
                    <VerifiedInput label="Bank Name" id="bankName" hasValue={!!bankData.bankName} isVerified={false} error={errors.bankName?.message} registration={register('bankName')} />
                    <VerifiedInput label="Account Number" id="accountNumber" hasValue={!!bankData.accountNumber} isVerified={data.bank.verifiedStatus?.accountNumber === true} onManualInput={() => handleManualInput(['accountNumber'])} error={errors.accountNumber?.message} registration={register('accountNumber')} />
                    <VerifiedInput label="Confirm Account Number" id="confirmAccountNumber" hasValue={!!bankData.confirmAccountNumber} isVerified={data.bank.verifiedStatus?.accountNumber === true} onManualInput={() => handleManualInput(['accountNumber'])} error={errors.confirmAccountNumber?.message} registration={register('confirmAccountNumber')} />
                    <VerifiedInput label="IFSC Code" id="ifscCode" hasValue={!!bankData.ifscCode} isVerified={data.bank.verifiedStatus?.ifscCode === true} onManualInput={() => handleManualInput(['ifscCode'])} error={errors.ifscCode?.message} registration={register('ifscCode')} />
                    <VerifiedInput label="Branch Name" id="branchName" hasValue={!!bankData.branchName} isVerified={false} error={errors.branchName?.message} registration={register('branchName')} />
                </div>

                {/* ── Account Name Mismatch Resolution Section ── */}
                {renderNameMismatchSection()}

                {/* ── Penny Drop Verification Button ── */}
                <div className="pt-4 border-t flex flex-col gap-3">
                    <button
                        id="penny-drop-verify-btn"
                        type="button"
                        onClick={handlePennyDrop}
                        disabled={pennyDropState === 'loading' || !bankData.accountNumber || !bankData.ifscCode}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50 hover:bg-accent/90 transition-colors w-fit"
                    >
                        {pennyDropState === 'loading' ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Verifying Account…</>
                        ) : (
                            <><ShieldCheck className="h-4 w-4" /> Verify Bank Account (Penny Drop)</>  
                        )}
                    </button>

                    {pennyDropState === 'matched' && (
                        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                            Account verified — Bank name: <span className="font-bold">{pennyDropName}</span>
                            <span className="text-xs text-muted ml-1">({kycGateway.activeVendor()})</span>
                        </div>
                    )}
                    {pennyDropState === 'mismatch' && (
                        <div className="flex items-start gap-2 text-sm text-amber-600 font-medium">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>Name mismatch — Bank returned: <span className="font-bold">{pennyDropName}</span>. Manual review required.</span>
                        </div>
                    )}
                    {pennyDropState === 'error' && (
                        <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
                            <XCircle className="h-4 w-4" /> Verification failed — check account details and retry.
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
};

export default BankDetails;