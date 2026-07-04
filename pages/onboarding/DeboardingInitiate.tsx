import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import FormHeader from '../../components/onboarding/FormHeader';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Checkbox from '../../components/ui/Checkbox';
import toast from 'react-hot-toast';

interface DeboardingFormData {
    employeeId: string;
    lastWorkingDay: string;
    reason: string;
    ndc: {
        uniformReturned: boolean;
        idCardReturned: boolean;
        toolsReturned: boolean;
        cugSimReturned: boolean;
        shoesReturned: boolean;
    };
    remarks: string;
    noticePeriodServed: boolean;
}

const MOCK_EMPLOYEES = [
    { id: 'E101', name: 'Ramesh Kumar (Security Guard)' },
    { id: 'E102', name: 'Sita Devi (Housekeeping)' },
    { id: 'E103', name: 'Manoj Singh (Supervisor)' },
];

const DeboardingInitiate = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { control, handleSubmit, watch, reset } = useForm<DeboardingFormData>({
        defaultValues: {
            employeeId: '',
            lastWorkingDay: '',
            reason: '',
            ndc: {
                uniformReturned: false,
                idCardReturned: false,
                toolsReturned: false,
                cugSimReturned: false,
                shoesReturned: false,
            },
            remarks: '',
            noticePeriodServed: true,
        }
    });

    const onSubmit = async (data: DeboardingFormData) => {
        setIsSubmitting(true);
        try {
            // Mock API Call
            await new Promise((resolve) => setTimeout(resolve, 1000));
            toast.success('Deboarding initiated and NDC workflow triggered successfully.');
            reset();
            navigate('/onboarding'); // Redirect to some dashboard
        } catch (error) {
            toast.error('Failed to initiate deboarding.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-border">
                <FormHeader 
                    title="Initiate Deboarding & NDC Engine" 
                    subtitle="Initiate the offboarding process and generate No Dues Certificate (NDC) for the employee." 
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller
                        name="employeeId"
                        control={control}
                        rules={{ required: 'Please select an employee' }}
                        render={({ field, fieldState }) => (
                            <Select label="Select Employee" error={fieldState.error?.message} {...field}>
                                <option value="">-- Select --</option>
                                {MOCK_EMPLOYEES.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </Select>
                        )}
                    />
                    
                    <Controller
                        name="lastWorkingDay"
                        control={control}
                        rules={{ required: 'Last working day is required' }}
                        render={({ field, fieldState }) => (
                            <Input 
                                type="date" 
                                label="Last Working Day (LWD)" 
                                error={fieldState.error?.message} 
                                {...field} 
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller
                        name="reason"
                        control={control}
                        rules={{ required: 'Please select a reason' }}
                        render={({ field, fieldState }) => (
                            <Select label="Reason for Leaving" error={fieldState.error?.message} {...field}>
                                <option value="">-- Select --</option>
                                <option value="Resignation">Resignation</option>
                                <option value="Termination">Termination (Performance/Disciplinary)</option>
                                <option value="Absconding">Absconding</option>
                                <option value="Contract Expiry">Contract Expiry</option>
                                <option value="Health/Personal">Health / Personal Reasons</option>
                            </Select>
                        )}
                    />
                    
                    <div className="flex items-end pb-2">
                         <Controller
                            name="noticePeriodServed"
                            control={control}
                            render={({ field }) => (
                                <Checkbox 
                                    id="noticePeriodServed" 
                                    label="Notice Period Served Completely" 
                                    checked={field.value} 
                                    onChange={(e) => field.onChange(e.target.checked)} 
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                    <h3 className="text-lg font-semibold text-primary-text mb-4">No Dues Certificate (NDC) Checklist</h3>
                    <p className="text-sm text-muted mb-6">Check the items that have been returned by the employee. Unchecked items may result in deductions from the full and final settlement.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <Controller
                            name="ndc.uniformReturned"
                            control={control}
                            render={({ field }) => (
                                <Checkbox 
                                    id="uniformReturned" 
                                    label="Uniform(s) Returned" 
                                    checked={field.value} 
                                    onChange={(e) => field.onChange(e.target.checked)} 
                                />
                            )}
                        />
                        <Controller
                            name="ndc.idCardReturned"
                            control={control}
                            render={({ field }) => (
                                <Checkbox 
                                    id="idCardReturned" 
                                    label="ID Card / Badge Returned" 
                                    checked={field.value} 
                                    onChange={(e) => field.onChange(e.target.checked)} 
                                />
                            )}
                        />
                        <Controller
                            name="ndc.toolsReturned"
                            control={control}
                            render={({ field }) => (
                                <Checkbox 
                                    id="toolsReturned" 
                                    label="Tools / Equipment Returned" 
                                    checked={field.value} 
                                    onChange={(e) => field.onChange(e.target.checked)} 
                                />
                            )}
                        />
                        <Controller
                            name="ndc.shoesReturned"
                            control={control}
                            render={({ field }) => (
                                <Checkbox 
                                    id="shoesReturned" 
                                    label="Safety Shoes Returned" 
                                    checked={field.value} 
                                    onChange={(e) => field.onChange(e.target.checked)} 
                                />
                            )}
                        />
                        <Controller
                            name="ndc.cugSimReturned"
                            control={control}
                            render={({ field }) => (
                                <Checkbox 
                                    id="cugSimReturned" 
                                    label="CUG SIM / Mobile Returned" 
                                    checked={field.value} 
                                    onChange={(e) => field.onChange(e.target.checked)} 
                                />
                            )}
                        />
                    </div>
                </div>
                
                <div className="mt-6">
                    <Controller
                        name="remarks"
                        control={control}
                        render={({ field }) => (
                            <div>
                                <label className="block text-sm font-medium text-primary-text mb-1">Additional Remarks / Recovery Details</label>
                                <textarea 
                                    className="w-full form-input rounded-md" 
                                    rows={3} 
                                    placeholder="Any notes for final settlement processing..."
                                    {...field} 
                                />
                            </div>
                        )}
                    />
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t border-border">
                    <Button type="button" variant="outline" onClick={() => navigate('/onboarding')}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isSubmitting}>
                        Submit Deboarding & Generate NDC
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default DeboardingInitiate;
