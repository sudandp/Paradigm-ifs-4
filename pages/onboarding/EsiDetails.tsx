import React, { useEffect, useState, useRef } from 'react';
// Fix: Use inline type import for SubmitHandler
import { useForm, useWatch, Controller, type SubmitHandler, type Resolver } from 'react-hook-form';
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
    esiRegistrationDate: yup.string().when('hasEsi', {
        is: true,
        then: (schema) => schema.required('Registration date is required')
            .test('not-in-future', 'Registration date cannot be in the future', (value) => {
                if(!value) return true;
                return new Date(value.replace(/-/g, '/')) <= new Date();
            }),
        otherwise: (schema) => schema.optional().nullable(),
    }),
    esicBranch: yup.string().when('hasEsi', {
        is: true,
        then: (schema) => schema.required('ESIC Branch is required'),
        otherwise: (schema) => schema.optional().nullable(),
    }),
    document: yup.mixed().optional().nullable(),
    verifiedStatus: yup.object().optional(),
});

interface OutletContext {
  onValidated: () => Promise<void>;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

type ESICVerifyState = 'idle' | 'loading' | 'active' | 'inactive' | 'error';

const EsiDetails = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { user } = useAuthStore();
    const { data, updateEsi, setEsiVerifiedStatus } = useOnboardingStore();
    const { esiCtcThreshold, enableEsiRule } = useEnrollmentRulesStore();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const autoCheckedRef = useRef(false);
    const [esicVerifyState, setEsicVerifyState] = useState<ESICVerifyState>('idle');
    const [esicMemberInfo, setEsicMemberInfo] = useState<{ memberName: string | null; dispensary: string | null } | null>(null);
    
    const { register, control, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<EsiDetails>({
        // FIX: Cast resolver to resolve type incompatibility between yup and react-hook-form.
        resolver: yupResolver(esiDetailsSchema) as unknown as Resolver<EsiDetails>,
        defaultValues: data.esi
    });
    
    const hasEsi = watch('hasEsi');
    const esiData = watch();

    const isEligibleForEsi = data.personal.salary != null && data.personal.salary <= esiCtcThreshold;

    useEffect(() => {
        // Sync form with global store data, which might have been pre-filled
        const esiData = { ...data.esi };
        const isNewForm = !esiData.esiNumber && !esiData.esicBranch && !esiData.esiRegistrationDate;
        if (isEligibleForEsi && !esiData.hasEsi && isNewForm && !autoCheckedRef.current) {
            esiData.hasEsi = true;
            autoCheckedRef.current = true;
            updateEsi({ hasEsi: true });
        }
        reset(esiData);
    }, [data.esi, reset, isEligibleForEsi, updateEsi]);

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
        // Handle eligibility logic based on other parts of the store
        if (!isEligibleForEsi) {
            if (data.esi.hasEsi) {
                // If not eligible, ensure hasEsi is false in the store. This will trigger the above effect.
                updateEsi({ hasEsi: false, esiNumber: '', esiRegistrationDate: '', esicBranch: '' });
            }
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
            const result = await kycGateway.verifyESIC({ esicNumber: esiNumber }, data.id);
            if (result.success) {
                setEsicMemberInfo({ memberName: result.memberName, dispensary: result.dispensary });
                if (result.status === 'active') {
                    setEsicVerifyState('active');
                    setEsiVerifiedStatus({ esiNumber: true });
                    setToast({ message: `ESI Active ✓ ${result.memberName ?? ''}${result.dispensary ? ` — ${result.dispensary}` : ''}`, type: 'success' });
                } else {
                    setEsicVerifyState('inactive');
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
        if (extractedData.esiNumber) {
            const esi = extractedData.esiNumber.replace(/\D/g, '');
            if (esi.length === 10 || esi.length === 17) {
                const esiUpdate: Partial<EsiDetails> = {
                    esiNumber: esi,
                    hasEsi: true,
                };
                setValue('esiNumber', esi, { shouldValidate: true });
                setValue('hasEsi', true, { shouldValidate: true });
                updateEsi(esiUpdate);
                setEsiVerifiedStatus({ esiNumber: true });
                setToast({ message: 'ESI Number extracted successfully.', type: 'success' });
            }
        }
    };

    const esiSchema = {
        type: Type.OBJECT,
        properties: {
            esiNumber: { type: Type.STRING, description: "The 10 or 17-digit ESI number." },
        },
        required: ["esiNumber"],
    };

    if (isMobile) {
        if (!enableEsiRule || !isEligibleForEsi) {
             const message = !enableEsiRule
                ? "ESI enrollment is currently disabled by company policy. This step is not applicable."
                : `Employee is not eligible for ESI as their gross salary is above the ₹${esiCtcThreshold.toLocaleString()} threshold.`;
            return (
                <form onSubmit={async (e) => { e.preventDefault(); await onValidated(); }} id="esi-form">
                     <div className="flex items-start gap-3 p-4 bg-blue-900/40 rounded-lg border border-blue-500/50">
                        <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-300">{message}</p>
                    </div>
                </form>
            );
        }
        return (
            <form onSubmit={handleSubmit(onSubmit)} id="esi-form">
                <p className="text-sm text-gray-400 mb-6">Provide your Employee's State Insurance number if applicable.</p>
                <div className="space-y-4">
                     <label className="flex items-center gap-3 p-4 bg-[#243524] rounded-lg border border-[#374151]">
                        <input type="checkbox" {...register('hasEsi')} className="h-5 w-5 rounded text-accent focus:ring-accent bg-transparent border-[#9ca89c]" />
                        <span>Are you covered under ESI?</span>
                    </label>
                    {hasEsi && (
                         <div className="space-y-4 animate-fade-in-down">
                            <input placeholder="ESI Number" {...register('esiNumber')} className="form-input"/>
                            <input type="date" {...register('esiRegistrationDate')} className="form-input"/>
                            <input placeholder="ESIC Branch" {...register('esicBranch')} className="form-input"/>
                            <Controller name="document" control={control} render={({ field }) => (
                                <UploadDocument label="Upload ESI Card" file={field.value} onFileChange={field.onChange} allowCapture costingItemName="ESI Card OCR" />
                            )}/>
                        </div>
                    )}
                </div>
            </form>
        );
    }

    if (!enableEsiRule) {
        return (
            <form onSubmit={async (e) => { e.preventDefault(); await onValidated(); }} id="esi-form">
                <FormHeader title="ESI Details" subtitle="Employee's State Insurance eligibility." />
                <div className="mt-4 flex items-center bg-blue-50 p-4 rounded-lg">
                    <Info className="h-5 w-5 text-blue-500 mr-3" />
                    <p className="text-sm text-blue-700">
                        ESI enrollment is currently disabled by company policy. This step is not applicable.
                    </p>
                </div>
            </form>
        );
    }


    if (!isEligibleForEsi) {
        return (
            <form onSubmit={async (e) => { e.preventDefault(); await onValidated(); }} id="esi-form">
                <FormHeader title="ESI Details" subtitle="Employee's State Insurance eligibility." />
                <div className="mt-4 flex items-center bg-blue-50 p-4 rounded-lg">
                    <Info className="h-5 w-5 text-blue-500 mr-3" />
                    <p className="text-sm text-blue-700">
                        Employee is not eligible for ESI as their gross salary is above the ₹${esiCtcThreshold.toLocaleString()} threshold.
                    </p>
                </div>
            </form>
        );
    }


    return (
        <form onSubmit={handleSubmit(onSubmit)} id="esi-form">
             <FormHeader title="ESI Details" subtitle="Provide your Employee's State Insurance number if applicable." />

            <div className="space-y-6">
                <div className="flex items-center">
                    <input id="hasEsi" type="checkbox" {...register('hasEsi')} className="h-4 w-4 text-accent" />
                    <label htmlFor="hasEsi" className="ml-2 block text-sm text-muted">Are you covered under ESI?</label>
                </div>
                {hasEsi && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-down">
                        <div className="space-y-6">
                            <VerifiedInput
                                label="ESI Number"
                                id="esiNumber"
                                hasValue={!!esiData.esiNumber}
                                isVerified={data.esi.verifiedStatus?.esiNumber === true}
                                onManualInput={handleManualInput}
                                registration={register('esiNumber')}
                                error={errors.esiNumber?.message}
                            />
                            <Controller name="esiRegistrationDate" control={control} render={({ field }) => (
                               <DatePicker label="ESI Registration Date" id="esiRegistrationDate" error={errors.esiRegistrationDate?.message} value={field.value} onChange={field.onChange} maxDate={new Date()} />
                            )} />
                            <Input label="ESIC Branch" id="esicBranch" registration={register('esicBranch')} error={errors.esicBranch?.message}/>

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
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                                            <CheckCircle2 className="h-4 w-4" /> ESI Active — {esicMemberInfo.memberName}
                                            <span className="text-xs text-muted">({kycGateway.activeVendor()})</span>
                                        </div>
                                        {esicMemberInfo.dispensary && (
                                            <p className="text-xs text-muted ml-6">Dispensary: {esicMemberInfo.dispensary}</p>
                                        )}
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
                            </div>
                        </div>
                        <Controller name="document" control={control} render={({ field }) => (
                             <UploadDocument
                                label="Upload ESI Card"
                                file={field.value}
                                onFileChange={field.onChange}
                                onOcrComplete={handleOcrComplete}
                                ocrSchema={esiSchema}
                                setToast={setToast}
                                costingItemName="ESI Card OCR"
                            />
                        )}/>
                    </div>
                )}
            </div>
        </form>
    );
};

export default EsiDetails;