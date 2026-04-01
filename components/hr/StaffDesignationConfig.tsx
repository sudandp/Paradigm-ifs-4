import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { api } from '../../services/api';
import type { SiteStaffDesignation } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toast from '../ui/Toast';
import { Plus, Trash2, Save, Loader2, ChevronDown } from 'lucide-react';


const StaffDesignationConfig: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const { register, control, handleSubmit, reset, watch } = useForm<{ designations: SiteStaffDesignation[] }>({
        defaultValues: { designations: [] }
    });
    const { fields, append, remove, replace } = useFieldArray({ control, name: "designations" });

    useEffect(() => {
        setIsLoading(true);
        api.getSiteStaffDesignations()
            .then(data => reset({ designations: data }))
            .catch(() => setToast({ message: 'Failed to load data.', type: 'error' }))
            .finally(() => setIsLoading(false));
    }, [reset]);

    const watchedFields = watch("designations");

    const groupedDesignations = useMemo(() => {
        if (!Array.isArray(watchedFields)) {
            return {};
        }
        return watchedFields.reduce((acc, field, index) => {
            const department = field.department || 'Uncategorized';
            if (!acc[department]) {
                acc[department] = [];
            }
            acc[department].push({ ...field, originalIndex: index });
            return acc;
        }, {} as Record<string, (SiteStaffDesignation & { originalIndex: number })[]>);
    }, [watchedFields]);

    const handleAddRow = (dept: string = '') => {
        append({ id: `new_${Date.now()}`, department: dept, designation: '', permanentId: '', temporaryId: '', monthlySalary: null });
    };

    const handleSave = async (data: { designations: SiteStaffDesignation[] }) => {
        setIsSaving(true);
        try {
            await api.updateSiteStaffDesignations(data.designations);
            setToast({ message: 'Configuration saved successfully.', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to save configuration.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit(handleSave)} className="bg-card p-6 rounded-xl shadow-card">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                <h4 className="text-lg font-semibold text-primary-text">Staff Designation & ID Series</h4>
                <div className="flex items-center gap-2">
                    <Button type="submit" isLoading={isSaving}><Save className="mr-2 h-4 w-4" /> Save Configuration</Button>
                </div>
            </div>

            <div className="space-y-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
                ) : Object.keys(groupedDesignations).length === 0 ? (
                    <div className="text-center p-8 text-muted bg-page rounded-lg">No designations defined. Click "Add Designation" to begin.</div>
                ) : (
                    Object.entries(groupedDesignations).map(([department, items]) => (
                        <div key={department} className="border border-border rounded-xl">
                            <div className="p-4 bg-page rounded-t-xl flex justify-between items-center">
                                <div className="flex-grow">
                                    <Input 
                                        aria-label={`Department for ${department}`} 
                                        id={`designations.${items[0].originalIndex}.department`} 
                                        {...register(`designations.${items[0].originalIndex}.department`)} 
                                        className="font-semibold text-lg !border-0 !p-0 !bg-transparent focus:!ring-0" 
                                    />
                                </div>
                                <Button 
                                    type="button" 
                                    variant="icon" 
                                    size="sm" 
                                    onClick={() => handleAddRow(department)} 
                                    title={`Add designation to ${department}`}
                                    className="hover:bg-accent/10 text-accent transition-colors"
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                            <div className="space-y-3 p-4">
                                {Array.isArray(items) && items.map(item => (
                                     <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                                        <div className="md:col-span-3">
                                            <Input placeholder="Designation" aria-label={`Designation for ${department}`} id={`designations.${item.originalIndex}.designation`} {...register(`designations.${item.originalIndex}.designation`)} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <Input placeholder="Permanent ID" aria-label={`Permanent ID for ${item.designation}`} id={`designations.${item.originalIndex}.permanentId`} {...register(`designations.${item.originalIndex}.permanentId`)} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <Input placeholder="Temporary ID" aria-label={`Temporary ID for ${item.designation}`} id={`designations.${item.originalIndex}.temporaryId`} {...register(`designations.${item.originalIndex}.temporaryId`)} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <Input placeholder="Monthly Salary (Gross)" aria-label={`Salary for ${item.designation}`} id={`designations.${item.originalIndex}.monthlySalary`} type="number" {...register(`designations.${item.originalIndex}.monthlySalary`, { valueAsNumber: true })} />
                                        </div>
                                        <div className="md:col-span-1 text-right">
                                            <Button type="button" variant="icon" size="sm" onClick={() => remove(item.originalIndex)} aria-label={`Remove ${item.designation}`} title={`Remove ${item.designation}`}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <Button type="button" onClick={() => handleAddRow()} variant="outline" className="mt-4"><Plus className="mr-2 h-4 w-4" /> Add Designation</Button>
        </form>
    );
};

export default StaffDesignationConfig;