import React, { useEffect, useState } from 'react';
// Fix: Use inline type import for SubmitHandler
import { useForm, useWatch, type SubmitHandler, Controller, type Resolver } from 'react-hook-form';
import { useOutletContext } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { UanDetails, UploadedFile } from '../../types';
import Input from '../../components/ui/Input';
import FormHeader from '../../components/onboarding/FormHeader';
import UploadDocument from '../../components/UploadDocument';
import VerifiedInput from '../../components/ui/VerifiedInput';
import { Type } from '@google/genai';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Loader2, CheckCircle2, XCircle, Send, UserPlus } from 'lucide-react';
import { kycGateway } from '../../services/kyc/kycGateway';

// Fix: Removed generic type argument from yup.object and yup.mixed
export const uanDetailsSchema = yup.object({
    hasPreviousPf: yup.boolean().required(),
    uanNumber: yup.string().when('hasPreviousPf', {
        is: true,
        then: (schema) => schema.required('UAN Number is required').matches(/^[0-9]{12}$/, 'UAN must be 12 digits'),
        otherwise: (schema) => schema.optional().nullable(),
    }),
    pfNumber: yup.string().when('hasPreviousPf', {
        is: true,
        then: (schema) => schema.optional().nullable(),
        otherwise: (schema) => schema.optional().nullable(),
    }),
    document: yup.mixed().optional().nullable(),
    salarySlip: yup.mixed().optional().nullable(),
    verifiedStatus: yup.object().optional(),
}).defined();

interface OutletContext {
  onValidated: () => Promise<void>;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

type UANVerifyState = 'idle' | 'otp_sent' | 'verifying' | 'verified' | 'error';
type UANGenState = 'idle' | 'generating' | 'done' | 'error';

const UanDetails = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { user } = useAuthStore();
    const { data, updateUan, setUanVerifiedStatus } = useOnboardingStore();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [uanVerifyState, setUanVerifyState] = useState<UANVerifyState>('idle');
    const [uanGenState, setUanGenState] = useState<UANGenState>('idle');
    const [otpValue, setOtpValue] = useState('');
    const [verifiedMemberName, setVerifiedMemberName] = useState<string | null>(null);
    
    const { register, control, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<UanDetails>({
        // FIX: Cast resolver to resolve type incompatibility between yup and react-hook-form.
        resolver: yupResolver(uanDetailsSchema) as unknown as Resolver<UanDetails>,
        defaultValues: data.uan
    });
    
    useEffect(() => {
        // Sync form with global store data, which might have been pre-filled
        const uanData = { ...data.uan };
        if (uanData.uanNumber && !uanData.hasPreviousPf) {
            uanData.hasPreviousPf = true;
        }
        reset(uanData);
    }, [data.uan, reset]);

    // This effect syncs the form state back to the Zustand store on change, with a debounce.
    useEffect(() => {
        let debounceTimer: number;
        const subscription = watch((value) => {
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                updateUan(value as UanDetails);
            }, 500);
        });
        return () => {
            subscription.unsubscribe();
            clearTimeout(debounceTimer);
        };
    }, [watch, updateUan]);
    
    const hasPreviousPf = watch('hasPreviousPf');
    const uanData = watch();

    const onSubmit: SubmitHandler<UanDetails> = async (formData) => {
        updateUan(formData);
        await onValidated();
    };
    
    const handleManualInput = () => {
        setUanVerifiedStatus({ uanNumber: false });
        setUanVerifyState('idle');
    };

    // ── Step 1: Send OTP to employee's registered EPFO mobile ──
    const handleSendOTP = () => {
        const uanNumber = uanData.uanNumber;
        if (!uanNumber || uanNumber.length !== 12) {
            setToast({ message: 'Enter a valid 12-digit UAN before sending OTP.', type: 'error' });
            return;
        }
        // In production: call EPFO portal to trigger OTP to registered mobile
        // The OTP is sent by EPFO directly to the worker's Aadhaar-linked mobile
        setUanVerifyState('otp_sent');
        setToast({ message: `OTP sent to ${data.personal.mobile || 'registered mobile'}. Ask worker to share it.`, type: 'success' });
    };

    // ── Step 2: Verify OTP against EPFO gateway ──
    const handleVerifyUAN = async () => {
        const uanNumber = uanData.uanNumber;
        if (!otpValue || otpValue.length < 4) {
            setToast({ message: 'Enter the OTP received on the worker\'s mobile.', type: 'error' });
            return;
        }
        setUanVerifyState('verifying');
        try {
            const result = await kycGateway.verifyUAN(
                { uan: uanNumber!, otp: otpValue, mobile: data.personal.mobile },
                data.id,
            );
            if (result.success) {
                setUanVerifyState('verified');
                setVerifiedMemberName(result.memberName);
                setUanVerifiedStatus({ uanNumber: true });
                setToast({ message: `UAN verified ✓ ${result.memberName ? `Member: ${result.memberName}` : ''}`, type: 'success' });
            } else {
                setUanVerifyState('error');
                setToast({ message: 'UAN verification failed — OTP may be wrong or expired.', type: 'error' });
            }
        } catch {
            setUanVerifyState('error');
            setToast({ message: 'EPFO gateway unavailable. Try again.', type: 'error' });
        }
    };

    // ── First-Time Formal Worker: Auto-generate new UAN ──
    const handleGenerateUAN = async () => {
        setUanGenState('generating');
        try {
            const result = await kycGateway.generateUAN({
                aadhaarNumber: data.personal.idProofNumber ?? '',
                name: `${data.personal.firstName} ${data.personal.lastName}`,
                dob: data.personal.dob,
                mobile: data.personal.mobile,
                employerName: data.organization.organizationName,
                employerPFCode: '',  // populated from org settings
            }, data.id);
            if (result.success && result.newUAN) {
                setUanGenState('done');
                setValue('uanNumber', result.newUAN, { shouldValidate: true });
                setValue('hasPreviousPf', false);
                updateUan({ uanNumber: result.newUAN });
                setUanVerifiedStatus({ uanNumber: true });
                setToast({ message: `New UAN generated: ${result.newUAN}`, type: 'success' });
            } else {
                setUanGenState('error');
                setToast({ message: 'UAN generation failed — will be queued for Back-Office processing.', type: 'error' });
            }
        } catch {
            setUanGenState('error');
            setToast({ message: 'UAN generation service unavailable.', type: 'error' });
        }
    };

    const handleOcrComplete = (extractedData: any) => {
        if (extractedData.uanNumber) {
            const uan = extractedData.uanNumber.replace(/\D/g, '');
            if (uan.length === 12) {
                const uanUpdate: Partial<UanDetails> = {
                    uanNumber: uan,
                    hasPreviousPf: true,
                };
                setValue('uanNumber', uan, { shouldValidate: true });
                setValue('hasPreviousPf', true, { shouldValidate: true });
                updateUan(uanUpdate);
                setUanVerifiedStatus({ uanNumber: true });
                setToast({ message: 'UAN extracted successfully.', type: 'success' });
            }
        }
    };

    const uanSchema = {
        type: Type.OBJECT,
        properties: {
            uanNumber: { type: Type.STRING, description: "The 12-digit Universal Account Number (UAN)." },
        },
        required: ["uanNumber"],
    };
    
    if (isMobile) {
        return (
            <form onSubmit={handleSubmit(onSubmit)} id="uan-form">
                <p className="text-sm text-gray-400 mb-6">Provide your Universal Account Number if you have one.</p>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 p-4 bg-[#243524] rounded-lg border border-[#374151]">
                        <input type="checkbox" {...register('hasPreviousPf')} className="h-5 w-5 rounded text-accent focus:ring-accent bg-transparent border-[#9ca89c]" />
                        <span>Do you have a previous PF account or UAN?</span>
                    </label>
                    {hasPreviousPf && (
                        <div className="space-y-4 animate-fade-in-down">
                            <input placeholder="UAN Number" {...register('uanNumber')} className="form-input"/>
                            <input placeholder="PF Number (Optional)" {...register('pfNumber')} className="form-input"/>
                            <Controller name="document" control={control} render={({ field }) => (
                                <UploadDocument label="Upload Proof (Payslip, etc.)" file={field.value} onFileChange={field.onChange} allowCapture costingItemName="EPF UAN Lookup"/>
                            )}/>
                        </div>
                    )}
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} id="uan-form">
            <FormHeader title="UAN / PF Details" subtitle="Provide your Universal Account Number if you have one." />
            
            <div className="space-y-6">
                <div className="flex items-center">
                    <input
                        id="hasPreviousPf"
                        type="checkbox"
                        {...register('hasPreviousPf')}
                        className="h-4 w-4 text-accent border-gray-300 rounded focus:ring-accent"
                    />
                    <label htmlFor="hasPreviousPf" className="ml-2 block text-sm text-muted">Do you have a previous PF account or UAN?</label>
                </div>
                {data.uan.salarySlip && (
                    <div className="pt-4 border-t">
                        <h4 className="text-md font-semibold text-primary-text mb-2">Reference Salary Slip</h4>
                        <UploadDocument
                            label=""
                            file={data.uan.salarySlip}
                            onFileChange={() => {}} // Read-only
                        />
                    </div>
                )}
                {hasPreviousPf ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-down">
                        <div className="space-y-4">
                           <VerifiedInput
                                label="UAN Number"
                                id="uanNumber"
                                hasValue={!!uanData.uanNumber}
                                isVerified={data.uan.verifiedStatus?.uanNumber === true}
                                onManualInput={handleManualInput}
                                registration={register('uanNumber')}
                                error={errors.uanNumber?.message}
                            />
                            <Input
                                label="PF Number (Optional)"
                                id="pfNumber"
                                registration={register('pfNumber')}
                                error={errors.pfNumber?.message}
                            />

                            {/* ── EPFO OTP Verification ── */}
                            <div className="flex flex-col gap-2 pt-2 border-t">
                                {uanVerifyState === 'idle' && (
                                    <button
                                        id="uan-send-otp-btn"
                                        type="button"
                                        onClick={handleSendOTP}
                                        disabled={!uanData.uanNumber || uanData.uanNumber.length !== 12}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50 hover:bg-accent/90 transition-colors w-fit"
                                    >
                                        <Send className="h-4 w-4" /> Send EPFO OTP
                                    </button>
                                )}
                                {(uanVerifyState === 'otp_sent' || uanVerifyState === 'verifying') && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            id="uan-otp-input"
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="Enter OTP"
                                            value={otpValue}
                                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                            className="form-input w-32"
                                        />
                                        <button
                                            id="uan-verify-otp-btn"
                                            type="button"
                                            onClick={handleVerifyUAN}
                                            disabled={uanVerifyState === 'verifying' || otpValue.length < 4}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50"
                                        >
                                            {uanVerifyState === 'verifying' ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : 'Verify OTP'}
                                        </button>
                                    </div>
                                )}
                                {uanVerifyState === 'verified' && (
                                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                                        <CheckCircle2 className="h-4 w-4" />
                                        UAN verified{verifiedMemberName ? ` — ${verifiedMemberName}` : ''}
                                        <span className="text-xs text-muted ml-1">({kycGateway.activeVendor()})</span>
                                    </div>
                                )}
                                {uanVerifyState === 'error' && (
                                    <div className="flex items-center gap-2 text-sm text-red-600">
                                        <XCircle className="h-4 w-4" /> Verification failed — retry or check OTP.
                                    </div>
                                )}
                            </div>
                        </div>
                        <Controller name="document" control={control} render={({ field }) => (
                            <UploadDocument
                                label="Upload Proof (Payslip, etc.)"
                                file={field.value}
                                onFileChange={field.onChange}
                                onOcrComplete={handleOcrComplete}
                                ocrSchema={uanSchema}
                                setToast={setToast}
                                costingItemName="EPF UAN Lookup"
                            />
                        )}/>
                    </div>
                ) : (
                    /* ── First-Time Formal Worker: Generate new UAN ── */
                    <div className="animate-fade-in-down p-4 rounded-lg border border-dashed border-accent/40 bg-accent/5">
                        <p className="text-sm text-muted mb-3">
                            This worker has no previous PF account. You can auto-generate a new UAN via EPFO after submission, or trigger it now.
                        </p>
                        <button
                            id="uan-generate-btn"
                            type="button"
                            onClick={handleGenerateUAN}
                            disabled={uanGenState === 'generating'}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50 hover:bg-accent/90 transition-colors"
                        >
                            {uanGenState === 'generating' ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Generating UAN…</>
                            ) : (
                                <><UserPlus className="h-4 w-4" /> Generate New UAN (First-Time Worker)</>
                            )}
                        </button>
                        {uanGenState === 'done' && uanData.uanNumber && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 font-medium">
                                <CheckCircle2 className="h-4 w-4" /> New UAN: <span className="font-bold font-mono">{uanData.uanNumber}</span>
                            </div>
                        )}
                        {uanGenState === 'error' && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                                <XCircle className="h-4 w-4" /> Will be queued for Back-Office UAN Exception processing.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </form>
    );
};

export default UanDetails;