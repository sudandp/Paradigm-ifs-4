import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import type { Organization, MasterGentsUniforms, GentsPantsSize, GentsShirtSize, MasterLadiesUniforms, LadiesPantsSize, LadiesShirtSize, UniformRequest, UniformRequestItem } from '../../types';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import { Loader2, Save, Shirt, X } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';


type UniformFormData = {
    siteId: string;
    department: string;
    designation: string;
    gender: 'Gents' | 'Ladies';
    pantsQuantities: Record<string, number | null>;
    shirtsQuantities: Record<string, number | null>;
    pantsCosts: Record<string, number | null>;
    shirtsCosts: Record<string, number | null>;
};

interface UniformSizeTableProps {
    title: string;
    sizes: (GentsPantsSize | GentsShirtSize | LadiesPantsSize | LadiesShirtSize)[];
    headers: { key: string, label: string }[];
    control?: any;
    quantityType: 'pantsQuantities' | 'shirtsQuantities';
    costType: 'pantsCosts' | 'shirtsCosts';
    quantities?: Record<string, number | null>;
    costs?: Record<string, number | null>;
    readOnly?: boolean;
}

const UniformSizeTable: React.FC<UniformSizeTableProps> = ({
    title,
    sizes,
    headers,
    control,
    quantityType,
    costType,
    quantities,
    costs,
    readOnly = false,
}) => {
    const fits = Array.from(new Set(sizes.map(s => s.fit)));
    const sizeKeys = Array.from(new Set(sizes.map(s => s.size))).sort((a, b) => {
        const numA = parseInt(String(a));
        const numB = parseInt(String(b));
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return String(a).localeCompare(String(b));
    });

    return (
        <div className="border rounded-xl flex flex-col overflow-hidden bg-card shadow-sm">
            <div className="p-4 bg-accent/5 border-b flex items-center justify-between">
                <h4 className="font-bold text-primary-text">{title}</h4>
                <div className="flex gap-4 text-[10px] font-bold text-muted uppercase tracking-wider">
                    <span>Qty</span>
                    <span>Cost</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead className="bg-page/50 text-muted uppercase tracking-wider font-bold">
                        <tr>
                            <th className="px-4 py-3 text-left w-16">Size</th>
                            {headers.map(h => <th key={String(h.key)} className="px-4 py-3 text-left">{h.label}</th>)}
                            <th className="px-4 py-3 text-center w-24">Qty</th>
                            <th className="px-4 py-3 text-center w-24">Cost (₹)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sizeKeys.map(size => (
                            <React.Fragment key={size}>
                                {fits.map((fit, fitIndex) => {
                                    const sizeForFit = sizes.find(s => s.size === size && s.fit === fit);
                                    if (!sizeForFit) return null;
                                    return (
                                        <tr key={sizeForFit.id} className="hover:bg-accent/5 transition-colors">
                                            {fitIndex === 0 && (
                                                <td rowSpan={fits.filter(f => sizes.some(s => s.size === size && s.fit === f)).length} className="px-4 py-3 align-middle font-black text-primary-text border-r border-border bg-page/30">{size}</td>
                                            )}
                                            {headers.map(h => <td key={String(h.key)} className="px-4 py-3 font-medium text-muted">{(sizeForFit as any)[h.key]}</td>)}
                                            <td className="px-4 py-3">
                                                <Controller
                                                    name={`${quantityType}.${sizeForFit.id}`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <input 
                                                            type="number" 
                                                            {...field} 
                                                            value={field.value || ''} 
                                                            onChange={e => field.onChange(parseInt(e.target.value) || null)} 
                                                            className="w-full h-8 text-center bg-white dark:bg-card border border-border rounded-lg focus:ring-2 focus:ring-accent outline-none font-bold text-accent"
                                                            placeholder="0"
                                                        />
                                                    )}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <Controller
                                                    name={`${costType}.${sizeForFit.id}`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <input 
                                                            type="number" 
                                                            {...field} 
                                                            value={field.value || ''} 
                                                            onChange={e => field.onChange(parseInt(e.target.value) || null)} 
                                                            className="w-full h-8 text-center bg-page/50 border border-border/50 rounded-lg outline-none font-black text-primary-text"
                                                            placeholder="₹"
                                                        />
                                                    )}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const NewUniformRequestPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = !!id;
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [sites, setSites] = useState<Organization[]>([]);
    const [selectedSiteConfig, setSelectedSiteConfig] = useState<any>(null);
    const [masterUniforms, setMasterUniforms] = useState<{ gents: MasterGentsUniforms, ladies: MasterLadiesUniforms } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [initialData, setInitialData] = useState<UniformRequest | null>(null);

    const { register, control, handleSubmit, watch, reset, setValue } = useForm<UniformFormData>({
        defaultValues: { siteId: '', department: '', designation: '', gender: 'Gents', pantsQuantities: {}, shirtsQuantities: {}, pantsCosts: {}, shirtsCosts: {} }
    });

    const selectedSiteId = watch('siteId');
    const gender = watch('gender');
    const selectedDept = watch('department');
    const selectedDesignation = watch('designation');

    // Load initial data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [sitesData, gentsData, ladiesData] = await Promise.all([
                    api.getOrganizations(),
                    api.getMasterGentsUniforms(),
                    api.getMasterLadiesUniforms(),
                ]);
                setSites(sitesData);
                setMasterUniforms({ gents: gentsData, ladies: ladiesData });

                if (isEditing && id) {
                    const requests = await api.getUniformRequests();
                    const request = requests.find(r => r.id === id);
                    if (request) {
                        setInitialData(request);
                        const pantsQuantities: Record<string, number | null> = {};
                        const shirtsQuantities: Record<string, number | null> = {};
                        const pantsCosts: Record<string, number | null> = {};
                        const shirtsCosts: Record<string, number | null> = {};
                        
                        request.items.forEach(item => {
                            if (item.category === 'Pants') {
                                pantsQuantities[item.sizeId] = item.quantity;
                                pantsCosts[item.sizeId] = item.cost || null;
                            } else {
                                shirtsQuantities[item.sizeId] = item.quantity;
                                shirtsCosts[item.sizeId] = item.cost || null;
                            }
                        });
                        
                        reset({
                            siteId: request.siteId,
                            department: request.department || '',
                            designation: request.designation || '',
                            gender: request.gender,
                            pantsQuantities,
                            shirtsQuantities,
                            pantsCosts,
                            shirtsCosts
                        });
                    }
                }
            } catch (e) {
                setToast({ message: 'Failed to load master data.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, isEditing, reset]);

    // Handle site selection and fetch config
    useEffect(() => {
        if (!selectedSiteId) {
            setSelectedSiteConfig(null);
            return;
        }

        const fetchSiteConfig = async () => {
            try {
                // Fetch full entity details for the selected site
                const entities = await api.getEntities();
                const config = entities.find(e => e.organizationId === selectedSiteId);
                setSelectedSiteConfig(config);
            } catch (e) {
                console.error("Failed to fetch site config", e);
            }
        };
        fetchSiteConfig();
    }, [selectedSiteId]);

    // Auto-populate when designation changes
    useEffect(() => {
        if (!selectedSiteConfig || !selectedDesignation) return;

        const configKey = gender === 'Gents' ? 'gentsUniformConfig' : 'ladiesUniformConfig';
        const config = selectedSiteConfig[configKey];
        if (!config) return;

        const dept = config.departments?.find((d: any) => d.department === selectedDept);
        const desg = dept?.designations?.find((d: any) => d.designation === selectedDesignation);

        if (desg) {
            setValue('pantsQuantities', desg.pantsQuantities || {});
            setValue('shirtsQuantities', desg.shirtsQuantities || {});
            setValue('pantsCosts', desg.pantsCosts || {});
            setValue('shirtsCosts', desg.shirtsCosts || {});
        }
    }, [selectedDesignation, selectedDept, gender, selectedSiteConfig, setValue]);

    const onSubmit = async (data: UniformFormData) => {
        if (!masterUniforms) return;

        const site = sites.find(s => s.id === data.siteId);
        if (!site) return;

        setIsSaving(true);
        try {
            const allSizes = gender === 'Gents'
                ? [...masterUniforms.gents.pants, ...masterUniforms.gents.shirts]
                : [...masterUniforms.ladies.pants, ...masterUniforms.ladies.shirts];

            const items: UniformRequestItem[] = [];
            let totalCost = 0;

            for (const [sizeId, quantity] of Object.entries(data.pantsQuantities)) {
                if (quantity && quantity > 0) {
                    const sizeInfo = allSizes.find(s => s.id === sizeId);
                    const cost = data.pantsCosts[sizeId] || 0;
                    if (sizeInfo) {
                        items.push({ 
                            sizeId, 
                            quantity, 
                            category: 'Pants', 
                            sizeLabel: sizeInfo.size, 
                            fit: sizeInfo.fit,
                            cost: cost
                        });
                        totalCost += (quantity * cost);
                    }
                }
            }
            for (const [sizeId, quantity] of Object.entries(data.shirtsQuantities)) {
                if (quantity && quantity > 0) {
                    const sizeInfo = allSizes.find(s => s.id === sizeId);
                    const cost = data.shirtsCosts[sizeId] || 0;
                    if (sizeInfo) {
                        items.push({ 
                            sizeId, 
                            quantity, 
                            category: 'Shirts', 
                            sizeLabel: sizeInfo.size, 
                            fit: sizeInfo.fit,
                            cost: cost
                        });
                        totalCost += (quantity * cost);
                    }
                }
            }

            const request: UniformRequest = {
                id: initialData?.id || `new_${Date.now()}`,
                siteId: data.siteId,
                siteName: site.shortName,
                department: data.department,
                designation: data.designation,
                gender: data.gender,
                requestedDate: initialData?.requestedDate || new Date().toISOString(),
                status: initialData?.status || 'Pending',
                items: items,
                totalCost: totalCost
            };

            if (request.id.startsWith('new_')) {
                await api.submitUniformRequest(request);
                setToast({ message: 'New request submitted successfully.', type: 'success' });
            } else {
                await api.updateUniformRequest(request);
                setToast({ message: 'Request updated successfully.', type: 'success' });
            }

            setTimeout(() => navigate('/uniforms'), 1500);
        } catch (e) {
            setToast({ message: 'Failed to save request.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
    }

    if (!masterUniforms) return null;

    const availableDepts = (gender === 'Gents' ? selectedSiteConfig?.gentsUniformConfig : selectedSiteConfig?.ladiesUniformConfig)?.departments || [];
    const availableDesignations = availableDepts.find((d: any) => d.department === selectedDept)?.designations || [];

    const desktopContent = (
        <div className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                            <Shirt className="h-7 w-7 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-primary-text">{isEditing ? 'Edit Uniform Request' : 'New Uniform Request'}</h2>
                            <p className="text-sm font-medium text-muted">Configure requirements and costs for site distribution.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="secondary" onClick={() => navigate('/uniforms')} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" disabled={isSaving} isLoading={isSaving} onClick={handleSubmit(onSubmit)}>Submit Request</Button>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Pane: Site & Role Context */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
                            <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest border-b border-border pb-3">Request Context</h3>
                            <div className="space-y-4">
                                <Select label="Select Site" {...register('siteId')} required>
                                    <option value="">-- Choose Site --</option>
                                    {sites.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}
                                </Select>

                                <div className="p-1 bg-page/50 rounded-xl border border-border flex">
                                    {(['Gents', 'Ladies'] as const).map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setValue('gender', g)}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${gender === g ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-primary-text'}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>

                                <Select label="Department" {...register('department')} required disabled={!availableDepts.length}>
                                    <option value="">-- Select Dept --</option>
                                    {availableDepts.map((d: any) => <option key={d.id} value={d.department}>{d.department}</option>)}
                                </Select>

                                <Select label="Designation" {...register('designation')} required disabled={!availableDesignations.length}>
                                    <option value="">-- Select Designation --</option>
                                    {availableDesignations.map((d: any) => <option key={d.id} value={d.designation}>{d.designation}</option>)}
                                </Select>
                            </div>
                        </div>

                        {!selectedSiteConfig && selectedSiteId && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex gap-3">
                                <Loader2 className="h-4 w-4 text-amber-500 animate-spin flex-shrink-0" />
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Uniform configuration hasn't been set for this site yet. You can manually enter details or configure it in Society Settings.</p>
                            </div>
                        )}
                    </div>

                    {/* Right Pane: Size & Cost Tables */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-8">
                            {gender === 'Gents' ? (
                                <>
                                    <UniformSizeTable title="Gents Pants" sizes={masterUniforms.gents.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="pantsQuantities" costType="pantsCosts" />
                                    <UniformSizeTable title="Gents Shirts" sizes={masterUniforms.gents.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'shoulder', label: 'Sh' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="shirtsQuantities" costType="shirtsCosts" />
                                </>
                            ) : (
                                <>
                                    <UniformSizeTable title="Ladies Pants" sizes={masterUniforms.ladies.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="pantsQuantities" costType="pantsCosts" />
                                    <UniformSizeTable title="Ladies Shirts" sizes={masterUniforms.ladies.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'bust', label: 'B' }, { key: 'shoulder', label: 'Sh' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="shirtsQuantities" costType="shirtsCosts" />
                                </>
                            )}
                        </div>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );

    return isMobile ? (
        <div className="h-full flex flex-col bg-page">
            <header className="p-4 flex-shrink-0 fo-mobile-header border-b border-border">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">{isEditing ? 'Edit Request' : 'New Request'}</h1>
                    <button onClick={() => navigate('/uniforms')} className="p-2 bg-muted/5 rounded-full"><X className="h-5 w-5" /></button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-card rounded-2xl p-6 shadow-sm space-y-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <Select label="Select Site" {...register('siteId')} required>
                            <option value="">-- Choose Site --</option>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}
                        </Select>
                        
                        <div className="flex gap-2 p-1 bg-muted/5 rounded-xl">
                            {(['Gents', 'Ladies'] as const).map(g => (
                                <button key={g} type="button" onClick={() => setValue('gender', g)} className={`flex-1 py-3 text-xs font-bold rounded-lg ${gender === g ? 'bg-accent text-white shadow-md' : 'text-muted'}`}>{g}</button>
                            ))}
                        </div>

                        <Select label="Dept" {...register('department')} required disabled={!availableDepts.length}>
                            <option value="">-- Select Dept --</option>
                            {availableDepts.map((d: any) => <option key={d.id} value={d.department}>{d.department}</option>)}
                        </Select>

                        <Select label="Desg" {...register('designation')} required disabled={!availableDesignations.length}>
                            <option value="">-- Select Desg --</option>
                            {availableDesignations.map((d: any) => <option key={d.id} value={d.designation}>{d.designation}</option>)}
                        </Select>

                        <div className="space-y-8 pt-4">
                            {gender === 'Gents' ? (
                                <>
                                    <UniformSizeTable title="Gents Pants" sizes={masterUniforms.gents.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }]} control={control} quantityType="pantsQuantities" costType="pantsCosts" />
                                    <UniformSizeTable title="Gents Shirts" sizes={masterUniforms.gents.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }]} control={control} quantityType="shirtsQuantities" costType="shirtsCosts" />
                                </>
                            ) : (
                                <>
                                    <UniformSizeTable title="Ladies Pants" sizes={masterUniforms.ladies.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }]} control={control} quantityType="pantsQuantities" costType="pantsCosts" />
                                    <UniformSizeTable title="Ladies Shirts" sizes={masterUniforms.ladies.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }]} control={control} quantityType="shirtsQuantities" costType="shirtsCosts" />
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </main>
            <footer className="p-4 bg-white dark:bg-card border-t border-border flex gap-4">
                <Button variant="secondary" onClick={() => navigate('/uniforms')} className="flex-1" disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} className="flex-1" isLoading={isSaving}>{isSaving ? 'Saving...' : 'Submit'}</Button>
            </footer>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    ) : desktopContent;
};

export default NewUniformRequestPage;
