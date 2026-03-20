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
    gender: 'Gents' | 'Ladies';
    pantsQuantities: Record<string, number | null>;
    shirtsQuantities: Record<string, number | null>;
};

interface UniformSizeTableProps {
    title: string;
    sizes: (GentsPantsSize | GentsShirtSize | LadiesPantsSize | LadiesShirtSize)[];
    headers: { key: string, label: string }[];
    control?: any;
    quantityType?: 'pantsQuantities' | 'shirtsQuantities';
    quantities?: Record<string, number | null>;
    readOnly?: boolean;
}

const UniformSizeTable: React.FC<UniformSizeTableProps> = ({
    title,
    sizes,
    headers,
    control,
    quantityType,
    quantities,
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
        <div className="border rounded-lg flex flex-col overflow-hidden bg-card">
            <h4 className="p-3 font-semibold bg-gray-50 dark:bg-white/5 border-b flex-shrink-0">{title}</h4>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-white/5">
                        <tr>
                            <th className="px-2 py-2 text-left font-medium text-muted">Size</th>
                            {headers.map(h => <th key={String(h.key)} className="px-2 py-2 text-left font-medium text-muted">{h.label}</th>)}
                            <th className="px-2 py-2 text-left font-medium text-muted w-20">Qty</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-white/10">
                        {sizeKeys.map(size => (
                            <React.Fragment key={size}>
                                {fits.map((fit, fitIndex) => {
                                    const sizeForFit = sizes.find(s => s.size === size && s.fit === fit);
                                    if (!sizeForFit) return null;
                                    return (
                                        <tr key={sizeForFit.id}>
                                            {fitIndex === 0 && <td rowSpan={fits.filter(f => sizes.some(s => s.size === size && s.fit === f)).length} className="px-2 py-2 align-middle font-semibold border-r dark:border-white/10">{size}</td>}
                                            {headers.map(h => <td key={String(h.key)} className="px-2 py-2">{(sizeForFit as any)[h.key]}</td>)}
                                            <td className="px-2 py-2">
                                                {readOnly ? (
                                                    <span className="font-semibold block text-center pr-4">
                                                        {quantities?.[sizeForFit.id] || 0}
                                                    </span>
                                                ) : (
                                                    <Controller
                                                        name={`${quantityType}.${sizeForFit.id}`}
                                                        control={control}
                                                        render={({ field }) => <Input aria-label={`Quantity for ${title} size ${size} ${fit}`} type="number" {...field} value={field.value || ''} onChange={e => field.onChange(parseInt(e.target.value) || null)} className="!py-1.5" />}
                                                    />
                                                )}
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
    const [masterUniforms, setMasterUniforms] = useState<{ gents: MasterGentsUniforms, ladies: MasterLadiesUniforms } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [initialData, setInitialData] = useState<UniformRequest | null>(null);

    const { register, control, handleSubmit, watch, reset } = useForm<UniformFormData>({
        defaultValues: { siteId: '', gender: 'Gents', pantsQuantities: {}, shirtsQuantities: {} }
    });

    const gender = watch('gender');

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
                        request.items.forEach(item => {
                            if (item.category === 'Pants') {
                                pantsQuantities[item.sizeId] = item.quantity;
                            } else {
                                shirtsQuantities[item.sizeId] = item.quantity;
                            }
                        });
                        reset({
                            siteId: request.siteId,
                            gender: request.gender,
                            pantsQuantities,
                            shirtsQuantities
                        });
                    } else {
                        setToast({ message: 'Request not found.', type: 'error' });
                        setTimeout(() => navigate('/uniforms'), 2000);
                    }
                }
            } catch (e) {
                setToast({ message: 'Failed to load data.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, isEditing, navigate, reset]);

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

            for (const [sizeId, quantity] of Object.entries(data.pantsQuantities)) {
                if (quantity && quantity > 0) {
                    const sizeInfo = allSizes.find(s => s.id === sizeId);
                    if (sizeInfo) items.push({ sizeId, quantity, category: 'Pants', sizeLabel: sizeInfo.size, fit: sizeInfo.fit });
                }
            }
            for (const [sizeId, quantity] of Object.entries(data.shirtsQuantities)) {
                if (quantity && quantity > 0) {
                    const sizeInfo = allSizes.find(s => s.id === sizeId);
                    if (sizeInfo) items.push({ sizeId, quantity, category: 'Shirts', sizeLabel: sizeInfo.size, fit: sizeInfo.fit });
                }
            }

            const request: UniformRequest = {
                id: initialData?.id || `new_${Date.now()}`,
                siteId: data.siteId,
                siteName: site.shortName,
                gender: data.gender,
                requestedDate: initialData?.requestedDate || new Date().toISOString(),
                status: initialData?.status || 'Pending',
                items: items,
            };

            if (request.id.startsWith('new_')) {
                await api.submitUniformRequest(request);
                setToast({ message: 'New request submitted.', type: 'success' });
            } else {
                await api.updateUniformRequest(request);
                setToast({ message: 'Request updated.', type: 'success' });
            }

            setTimeout(() => navigate('/uniforms'), 1500);
        } catch (e) {
            setToast({ message: 'Failed to save request.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
    }

    if (!masterUniforms) return null;

    if (isMobile) {
        return (
            <div className="h-full flex flex-col">
                <header className="p-4 flex-shrink-0 fo-mobile-header">
                    <h1>{isEditing ? 'Edit Request' : 'New Request'}</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="bg-card rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="inline-block bg-accent-light p-3 rounded-full mb-2">
                                <Shirt className="h-8 w-8 text-accent-dark" />
                            </div>
                            <h2 className="text-xl font-bold text-primary-text">{isEditing ? 'Edit Uniform Request' : 'New Uniform Request'}</h2>
                            <p className="text-sm text-gray-400">Submit a request for new uniforms.</p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <Select label="Select Site" {...register('siteId')} required>
                                <option value="">-- Select a Site --</option>
                                {sites.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}
                            </Select>
                            <Select label="Select Uniform Type" {...register('gender')}>
                                <option>Gents</option>
                                <option>Ladies</option>
                            </Select>

                            <div className="space-y-6">
                                {gender === 'Gents' ? (
                                    <>
                                        <UniformSizeTable title="Gents' Pants" sizes={masterUniforms.gents.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'tilesLoose', label: 'TL' }, { key: 'bottomWaist', label: 'BW' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="pantsQuantities" />
                                        <UniformSizeTable title="Gents' Shirts" sizes={masterUniforms.gents.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'chest', label: 'C' }, { key: 'shoulder', label: 'Sh' }, { key: 'collar', label: 'Co' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="shirtsQuantities" />
                                    </>
                                ) : (
                                    <>
                                        <UniformSizeTable title="Ladies' Pants" sizes={masterUniforms.ladies.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="pantsQuantities" />
                                        <UniformSizeTable title="Ladies' Shirts" sizes={masterUniforms.ladies.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'bust', label: 'B' }, { key: 'shoulder', label: 'Sh' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="shirtsQuantities" />
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </main>
                <footer className="p-4 flex-shrink-0 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/uniforms')}
                        disabled={isSaving}
                        className="fo-btn-secondary px-6"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSaving}
                        className="fo-btn-primary flex-1"
                    >
                        {isSaving ? 'Saving...' : 'Save Request'}
                    </button>
                </footer>
                {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            <div className="bg-card p-8 rounded-xl shadow-card w-full">
                <div className="flex items-center mb-6">
                    <div className="bg-accent-light p-3 rounded-full mr-4">
                        <Shirt className="h-8 w-8 text-accent-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">{isEditing ? 'Edit Uniform Request' : 'New Uniform Request'}</h2>
                        <p className="text-muted">Submit a request for new uniforms.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Select label="Select Site" {...register('siteId')} required>
                            <option value="">-- Select a Site --</option>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}
                        </Select>
                        <Select label="Select Uniform Type" {...register('gender')}>
                            <option>Gents</option>
                            <option>Ladies</option>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {gender === 'Gents' ? (
                            <>
                                <UniformSizeTable title="Gents' Pants" sizes={masterUniforms.gents.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'tilesLoose', label: 'TL' }, { key: 'bottomWaist', label: 'BW' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="pantsQuantities" />
                                <UniformSizeTable title="Gents' Shirts" sizes={masterUniforms.gents.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'chest', label: 'C' }, { key: 'shoulder', label: 'Sh' }, { key: 'collar', label: 'Co' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="shirtsQuantities" />
                            </>
                        ) : (
                            <>
                                <UniformSizeTable title="Ladies' Pants" sizes={masterUniforms.ladies.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="pantsQuantities" />
                                <UniformSizeTable title="Ladies' Shirts" sizes={masterUniforms.ladies.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'bust', label: 'B' }, { key: 'shoulder', label: 'Sh' }, { key: 'fit', label: 'Fit' }]} control={control} quantityType="shirtsQuantities" />
                            </>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                        <Button
                            type="button"
                            onClick={() => navigate('/uniforms')}
                            variant="secondary"
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Request'}
                        </Button>
                    </div>
                </form>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default NewUniformRequestPage;
