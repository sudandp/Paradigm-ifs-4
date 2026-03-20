import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useSettingsStore } from '../../store/settingsStore';
import type { GmcPolicySettings } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toast from '../ui/Toast';
import ToggleSwitch from '../ui/ToggleSwitch';
import { Save, FileText } from 'lucide-react';




const Checkbox: React.FC<{ label: string } & React.InputHTMLAttributes<HTMLInputElement>> = ({ label, ...props }) => (
    <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="h-4 w-4 text-accent border-gray-300 rounded focus:ring-accent" {...props} />
        {label}
    </label>
);

export const GmcPolicyConfig: React.FC = () => {
    const { gmcPolicy, updateGmcPolicySettings } = useSettingsStore();
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const { register, handleSubmit, control, watch, reset, formState: { isDirty } } = useForm<GmcPolicySettings>({
        defaultValues: gmcPolicy,
    });
    
    useEffect(() => {
        reset(gmcPolicy);
    }, [gmcPolicy, reset]);

    const requireAlternateInsurance = watch('requireAlternateInsurance');
    const isGmcMandatory = watch('applicability') === 'Mandatory';

    const handleSave = (data: GmcPolicySettings) => {
        updateGmcPolicySettings(data);
        setToast({ message: 'GMC policy settings saved.', type: 'success' });
    };





    return (
        <form onSubmit={handleSubmit(handleSave)} className="bg-card p-6 rounded-xl shadow-card">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}


            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <h3 className="text-xl font-semibold text-primary-text">GMC Policy Configuration</h3>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button type="submit" disabled={!isDirty}><Save className="mr-2 h-4 w-4" /> Save</Button>
                </div>
            </div>

            <div className="space-y-6">
                 <div>
                    <Controller
                        name="applicability"
                        control={control}
                        render={({ field }) => (
                            <Select label="Applicability" {...field}>
                                <option>Mandatory</option>
                                <option>Optional - Opt-in Default</option>
                                <option>Optional - Opt-out Default</option>
                            </Select>
                        )}
                    />
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold text-primary-text">Opt-In Details</h4>
                     <div>
                        <h5 className="block text-sm font-medium text-muted">Opt-In Disclaimer</h5>
                        <textarea {...register('optInDisclaimer')} rows={3} className="form-input mt-1" />
                    </div>
                     <div>
                        <h5 className="block text-sm font-medium text-muted">Coverage Details</h5>
                        <textarea {...register('coverageDetails')} rows={2} className="form-input mt-1" />
                    </div>
                </div>

                {!isGmcMandatory && (
                    <div className="space-y-4 pt-4 border-t">
                         <h4 className="font-semibold text-primary-text">Opt-Out Details</h4>
                         <div>
                            <h5 className="block text-sm font-medium text-muted">Opt-Out Disclaimer</h5>
                            <textarea {...register('optOutDisclaimer')} rows={3} className="form-input mt-1" />
                        </div>
                        <Controller name="requireAlternateInsurance" control={control} render={({ field }) => <ToggleSwitch id="require-alt-ins" label="Require proof of alternate insurance on opt-out" checked={field.value} onChange={field.onChange} />} />
                        
                        {requireAlternateInsurance && (
                            <div className="p-4 bg-page rounded-lg space-y-3">
                                <p className="text-sm text-muted">Collect the following from employees who opt out:</p>
                                <Controller name="collectProvider" control={control} render={({ field }) => <Checkbox label="Provider Name" checked={field.value} onChange={field.onChange} />} />
                                <Controller name="collectStartDate" control={control} render={({ field }) => <Checkbox label="Policy Start Date" checked={field.value} onChange={field.onChange} />} />
                                <Controller name="collectEndDate" control={control} render={({ field }) => <Checkbox label="Policy End Date" checked={field.value} onChange={field.onChange} />} />
                                <Controller name="collectExtentOfCover" control={control} render={({ field }) => <Checkbox label="Extent of Cover (Sum Assured)" checked={field.value} onChange={field.onChange} />} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </form>
    );
};