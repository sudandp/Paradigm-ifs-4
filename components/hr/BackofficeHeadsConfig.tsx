import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { api } from '../../services/api';
import type { BackOfficeIdSeries } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toast from '../ui/Toast';
import { Plus, Trash2, Save, Loader2, ChevronDown } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const BackofficeHeadsConfig: React.FC = () => {
    const isMobile = useMediaQuery('(max-width: 767px)');
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
        <form 
            onSubmit={handleSubmit(handleSave)} 
            className={isMobile 
                ? 'bg-[#092c19] p-4 sm:p-5 rounded-2xl border border-[#134426] shadow-[0_4px_20px_rgba(0,0,0,0.35)]' 
                : 'bg-card p-6 rounded-xl shadow-card'
            }
        >
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5">
                <h3 className={`text-base sm:text-lg font-black tracking-tight ${isMobile ? 'text-white' : 'text-primary-text'}`}>
                    Back Office Department & Emp ID Series
                </h3>
                <div className="flex items-center gap-2">
                    {isMobile ? (
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 stroke-[2.5]" />}
                            <span>Save Configuration</span>
                        </button>
                    ) : (
                        <Button type="submit" isLoading={isSaving}>
                            <Save className="mr-2 h-4 w-4" /> Save Configuration
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-5">
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-[#44D62C]" />
                    </div>
                ) : Object.keys(groupedSeries).length === 0 ? (
                    <div className={`text-center p-8 rounded-xl ${isMobile ? 'text-white/60 bg-[#041b0f] border border-[#134426]' : 'text-muted bg-page'}`}>
                        No ID series defined. Click "Add Designation" to begin.
                    </div>
                ) : (
                    Object.entries(groupedSeries).map(([department, items]) => (
                        <div key={department} className={isMobile ? 'border border-[#134426] bg-[#041b0f]/50 rounded-2xl overflow-hidden' : 'border border-border rounded-xl'}>
                            <div className={`p-3.5 sm:p-4 ${isMobile ? 'bg-[#041b0f] border-b border-[#134426]' : 'bg-page rounded-t-xl'}`}>
                                <Input 
                                    aria-label={`Department for ${department}`} 
                                    id={`series.${items[0].originalIndex}.department`} 
                                    {...register(`series.${items[0].originalIndex}.department`)} 
                                    className={`font-black text-sm sm:text-base ${isMobile ? 'text-[#44D62C]' : ''} !border-0 !p-0 !bg-transparent focus:!ring-0`} 
                                />
                            </div>
                            <div className="space-y-3 p-3 sm:p-4">
                                {Array.isArray(items) && items.map(item => (
                                    <div 
                                        key={fields[item.originalIndex]?.id || item.id || item.originalIndex} 
                                        className={isMobile 
                                            ? 'bg-[#092c19]/70 border border-[#134426] rounded-xl p-3.5 space-y-2.5 relative'
                                            : 'grid grid-cols-1 md:grid-cols-10 gap-2 items-center'
                                        }
                                    >
                                        {isMobile ? (
                                            <>
                                                <div className="flex items-center justify-between pb-1 border-b border-[#134426]/60">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-[#44D62C]">
                                                        Series Item #{item.originalIndex + 1}
                                                    </span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => remove(item.originalIndex)} 
                                                        className="p-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                                        aria-label={`Remove ${item.designation}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Designation</label>
                                                    <input 
                                                        placeholder="e.g. Field Staff" 
                                                        {...register(`series.${item.originalIndex}.designation`)}
                                                        className="w-full bg-[#041b0f] border border-[#134426] rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-white/20 focus:outline-none focus:border-[#44D62C] transition-colors"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Permanent ID</label>
                                                        <input 
                                                            placeholder="e.g. MSD-01" 
                                                            {...register(`series.${item.originalIndex}.permanentId`)}
                                                            className="w-full bg-[#041b0f] border border-[#134426] rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-white/20 focus:outline-none focus:border-[#44D62C] transition-colors"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Temporary ID</label>
                                                        <input 
                                                            placeholder="e.g. Temp-BO-01" 
                                                            {...register(`series.${item.originalIndex}.temporaryId`)}
                                                            className="w-full bg-[#041b0f] border border-[#134426] rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder-white/20 focus:outline-none focus:border-[#44D62C] transition-colors"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isMobile ? (
                <button 
                    type="button" 
                    onClick={handleAddRow} 
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#134426] bg-[#041b0f] text-[#44D62C] hover:bg-[#134426] text-xs font-black active:scale-95 transition-all cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    <span>Add Designation</span>
                </button>
            ) : (
                <Button type="button" onClick={handleAddRow} variant="outline" className="mt-6">
                    <Plus className="mr-2 h-4 w-4" /> Add Designation
                </Button>
            )}
        </form>
    );
};

export default BackofficeHeadsConfig;