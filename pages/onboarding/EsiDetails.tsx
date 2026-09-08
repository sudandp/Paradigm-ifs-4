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

type ESICVerifyState = 'idle' | 'loading' | 'active' | 'inactive' | 'error';

const EsiDetails = () => {
    const { onValidated, setToast } = useOutletContext<OutletContext>();
    const { user } = useAuthStore();
    const { data, updateEsi, setEsiVerifiedStatus } = useOnboardingStore();
    const { esiCtcThreshold } = useEnrollmentRulesStore();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [esicVerifyState, setEsicVerifyState] = useState<ESICVerifyState>('idle');
    const [esicMemberInfo, setEsicMemberInfo] = useState<{ memberName: string | null; dispensary: string | null } | null>(null);
    
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
                                <UploadDocument label="Upload ESI Card (Optional)" file={field.value} onFileChange={field.onChange} allowCapture costingItemName="ESI Card OCR" />
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
                                label="Upload ESI Card (Optional)"
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