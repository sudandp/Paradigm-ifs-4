import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { api } from '../../services/api';
import type { BackOfficeIdSeries } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toast from '../ui/Toast';
import { Plus, Trash2, Save, Loader2, ChevronDown } from 'lucide-react';


const BackofficeHeadsConfig: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const { register, control, handleSubmit, reset, watch } = useForm<{ series: BackOfficeIdSeries[] }>({
        defaultValues: { series: [] }
    });
    const { fields, append, remove, replace } = useFieldArray({ control, name: "series" });

    useEffect(() => {
        setIsLoading(true);
        api.getBackOfficeIdSeries()
            .then(data => reset({ series: data }))
            .catch(() => setToast({ message: 'Failed to load data.', type: 'error' }))
            .finally(() => setIsLoading(false));
    }, [reset]);
    
    const watchedFields = watch("series");

    const groupedSeries = useMemo(() => {
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
        }, {} as Record<string, (BackOfficeIdSeries & { originalIndex: number })[]>);
    }, [watchedFields]);

    const handleAddRow = () => {
        append({ id: `new_${Date.now()}`, department: '', designation: '', permanentId: '', temporaryId: '' });
    };

    const handleSave = async (data: { series: BackOfficeIdSeries[] }) => {
        setIsSaving(true);
        try {
            await api.updateBackOfficeIdSeries(data.series);
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

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <h3 className="text-xl font-semibold text-primary-text">Back Office Department & Emp ID Series</h3>
                <div className="flex items-center gap-2">
                    <Button type="submit" isLoading={isSaving}><Save className="mr-2 h-4 w-4" /> Save Configuration</Button>
                </div>
            </div>

             <div className="space-y-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
                ) : Object.keys(groupedSeries).length === 0 ? (
                    <div className="text-center p-8 text-muted bg-page rounded-lg">No ID series defined. Click "Add Designation" to begin.</div>
                ) : (
                    Object.entries(groupedSeries).map(([department, items]) => (
                        <div key={department} className="border border-border rounded-xl">
                            <div className="p-4 bg-page rounded-t-xl">
                                <Input 
                                    aria-label={`Department for ${department}`} 
                                    id={`series.${items[0].originalIndex}.department`} 
                                    {...register(`series.${items[0].originalIndex}.department`)} 
                                    className="font-semibold text-lg !border-0 !p-0 !bg-transparent focus:!ring-0" 
                                />
                            </div>
                            <div className="space-y-3 p-4">
                                {Array.isArray(items) && items.map(item => (
                                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-10 gap-2 items-center">
                                        <div className="md:col-span-3">
                                            <Input placeholder="Designation" aria-label={`Designation for ${department}`} id={`series.${item.originalIndex}.designation`} {...register(`series.${item.originalIndex}.designation`)} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <Input placeholder="Permanent ID" aria-label={`Permanent ID for ${item.designation}`} id={`series.${item.originalIndex}.permanentId`} {...register(`series.${item.originalIndex}.permanentId`)} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <Input placeholder="Temporary ID" aria-label={`Temporary ID for ${item.designation}`} id={`series.${item.originalIndex}.temporaryId`} {...register(`series.${item.originalIndex}.temporaryId`)} />
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

            <Button type="button" onClick={handleAddRow} variant="outline" className="mt-6"><Plus className="mr-2 h-4 w-4" /> Add Designation</Button>
        </form>
    );
};

export default BackofficeHeadsConfig;