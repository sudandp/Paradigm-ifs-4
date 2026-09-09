import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import type { Organization, MasterGentsUniforms, GentsPantsSize, GentsShirtSize, MasterLadiesUniforms, LadiesPantsSize, LadiesShirtSize, UniformRequest, UniformRequestItem, EmployeeUniformSelection } from '../../types';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { Loader2, Plus, Shirt, Edit, Trash2, X, Save, ArrowLeft, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';


type UniformFormData = {
    siteId: string;
    gender: 'Gents' | 'Ladies';
    pantsQuantities: Record<string, number | null>;
    shirtsQuantities: Record<string, number | null>;
};

const UniformStatusChip: React.FC<{ status: UniformRequest['status'] }> = ({ status }) => {
    const darkStyles: Record<UniformRequest['status'], string> = {
      'Pending': 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
      'Approved': 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
      'Issued': 'bg-[#44D62C]/10 text-[#44D62C] border border-[#44D62C]/30',
      'Rejected': 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
    };
    return <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full ${darkStyles[status]}`}>{status}</span>;
};

const UniformSizeTable: React.FC<{
    title: string;
    sizes: (GentsPantsSize | GentsShirtSize | LadiesPantsSize | LadiesShirtSize)[];
    headers: { key: string, label: string }[];
    control: any;
    quantityType: 'pantsQuantities' | 'shirtsQuantities';
}> = ({ title, sizes, headers, control, quantityType }) => {
    const fits = Array.from(new Set(sizes.map(s => s.fit)));
    const sizeKeys = Array.from(new Set(sizes.map(s => s.size))).sort((a,b) => {
        const numA = parseInt(String(a));
        const numB = parseInt(String(b));
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return String(a).localeCompare(String(b));
    });

    return (
        <div className="border border-border rounded-lg">
            <h4 className="p-3 font-semibold bg-accent text-white border-b border-accent">{title}</h4>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-page">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted">Size</th>
                            {headers.map(h => <th key={String(h.key)} className="px-3 py-2 text-left font-medium text-muted">{h.label}</th>)}
                            <th className="px-3 py-2 text-left font-medium text-muted w-24">Quantity</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sizeKeys.map(size => (
                            <React.Fragment key={size}>
                                {fits.map((fit, fitIndex) => {
                                    const sizeForFit = sizes.find(s => s.size === size && s.fit === fit);
                                    if (!sizeForFit) return null;
                                    return (
                                        <tr key={sizeForFit.id}>
                                            {fitIndex === 0 && <td rowSpan={fits.filter(f => sizes.some(s => s.size === size && s.fit === f)).length} className="px-3 py-2 align-middle font-semibold border-r">{size}</td>}
                                            {headers.map(h => <td key={String(h.key)} className="px-3 py-2">{(sizeForFit as any)[h.key]}</td>)}
                                            <td className="px-3 py-2">
                                                <Controller
                                                    name={`${quantityType}.${sizeForFit.id}`}
                                                    control={control}
                                                    render={({ field }) => <Input aria-label={`Quantity for ${title} size ${size} ${fit}`} type="number" {...field} value={field.value || ''} onChange={e => field.onChange(parseInt(e.target.value) || null)} className="!py-1.5" />}
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

const UniformRequestForm: React.FC<{
    onSave: (data: UniformRequest) => void,
    onCancel: () => void,
    sites: Organization[],
    masterUniforms: { gents: MasterGentsUniforms, ladies: MasterLadiesUniforms },
    initialData?: UniformRequest | null,
}> = ({ onSave, onCancel, sites, masterUniforms, initialData }) => {
    const { register, control, handleSubmit, watch, reset } = useForm<UniformFormData>({
        defaultValues: { siteId: '', gender: 'Gents', pantsQuantities: {}, shirtsQuantities: {} }
    });
    
    const { data: onboardingData } = useOnboardingStore();
    const { user } = useAuthStore();

    const gender = watch('gender');
    const siteId = watch('siteId');

    useEffect(() => {
        if (initialData) {
            const pantsQuantities: Record<string, number | null> = {};
            const shirtsQuantities: Record<string, number | null> = {};
            initialData.items.forEach(item => {
                if (item.category === 'Pants') {
                    pantsQuantities[item.sizeId] = item.quantity;
                } else {
                    shirtsQuantities[item.sizeId] = item.quantity;
                }
            });
            reset({
                siteId: initialData.siteId,
                gender: initialData.gender,
                pantsQuantities,
                shirtsQuantities
            });
        } else {
            // This is a new request, pre-populate from the onboarding store
            const defaultSiteId = onboardingData.organization.organizationId || '';
            const employeeGender = onboardingData.personal.gender;
            const defaultUniformGender = employeeGender === 'Female' ? 'Ladies' : 'Gents';

            reset({
                siteId: defaultSiteId,
                gender: defaultUniformGender,
                pantsQuantities: {},
                shirtsQuantities: {}
            });
        }
    }, [initialData, reset, onboardingData]);

    const onSubmit = (data: UniformFormData) => {
        const site = sites.find(s => s.id === data.siteId);
        if (!site || !user) return;

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
            source: 'Individual', // This request comes from a single employee's onboarding
            requestedById: user.id,
            requestedByName: user.name,
            employeeDetails: [{
              employeeName: `${onboardingData.personal.firstName} ${onboardingData.personal.lastName}`,
              employeeId: onboardingData.personal.employeeId,
              items: items.map(i => ({ itemName: i.category, sizeLabel: i.sizeLabel, fit: i.fit, quantity: i.quantity }))
            }]
        };
        onSave(request);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select label="Select Site" value={siteId} {...register('siteId')} required disabled>
                        <option value="">-- Select a Site --</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.shortName}</option>)}
                    </Select>
                    <Select label="Select Uniform Type" value={gender} {...register('gender')} disabled>
                        <option>Gents</option>
                        <option>Ladies</option>
                    </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {gender === 'Gents' ? (
                        <>
                            <UniformSizeTable title="Gents' Pants" sizes={masterUniforms.gents.pants} headers={[{key:'length',label:'L'},{key:'waist',label:'W'},{key:'hip',label:'H'},{key:'fit',label:'Fit'}]} control={control} quantityType="pantsQuantities" />
                            <UniformSizeTable title="Gents' Shirts" sizes={masterUniforms.gents.shirts} headers={[{key:'length',label:'L'},{key:'sleeves',label:'S'},{key:'chest',label:'C'},{key:'fit',label:'Fit'}]} control={control} quantityType="shirtsQuantities" />
                        </>
                    ) : (
                         <>
                            <UniformSizeTable title="Ladies' Pants" sizes={masterUniforms.ladies.pants} headers={[{key:'length',label:'L'},{key:'waist',label:'W'},{key:'hip',label:'H'},{key:'fit',label:'Fit'}]} control={control} quantityType="pantsQuantities" />
                            <UniformSizeTable title="Ladies' Shirts" sizes={masterUniforms.ladies.shirts} headers={[{key:'length',label:'L'},{key:'sleeves',label:'S'},{key:'bust',label:'B'},{key:'shoulder',label:'Sh'},{key:'fit',label:'Fit'}]} control={control} quantityType="shirtsQuantities" />
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-[#374151]">
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit"><Save className="mr-2 h-4 w-4" /> Save Request</Button>
                </div>
            </div>
        </form>
    );
};

const UniformRequests: React.FC = () => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [requests, setRequests] = useState<UniformRequest[]>([]);
    const [sites, setSites] = useState<Organization[]>([]);
    const [masterUniforms, setMasterUniforms] = useState<{ gents: MasterGentsUniforms, ladies: MasterLadiesUniforms } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [editingRequest, setEditingRequest] = useState<UniformRequest | null>(null);
    const [deletingRequest, setDeletingRequest] = useState<UniformRequest | null>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { updateUniforms } = useOnboardingStore();

    const cameFromOnboarding = searchParams.get('from') === 'onboarding';

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [reqs, sitesData, gentsData, ladiesData] = await Promise.all([
                api.getUniformRequests(),
                api.getOrganizations(),
                api.getMasterGentsUniforms(),
                api.getMasterLadiesUniforms(),
            ]);
            setRequests(reqs.sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime()));
            setSites(sitesData);
            setMasterUniforms({ gents: gentsData, ladies: ladiesData });
        } catch (e) {
            setToast({ message: 'Failed to load uniform data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (cameFromOnboarding) {
            setView('form');
            setEditingRequest(null);
        }
    }, [cameFromOnboarding]);

    const handleNewRequest = () => {
        setEditingRequest(null);
        setView('form');
    };

    const handleEdit = (request: UniformRequest) => {
        setEditingRequest(request);
        setView('form');
    };
    
    const handleSave = async (requestData: UniformRequest) => {
        if (cameFromOnboarding && masterUniforms) {
            const masterSizes = requestData.gender === 'Ladies' 
                ? [...masterUniforms.ladies.pants, ...masterUniforms.ladies.shirts]
                : [...masterUniforms.gents.pants, ...masterUniforms.gents.shirts];
            
            const selections: EmployeeUniformSelection[] = requestData.items.map(item => {
                const sizeInfo = masterSizes.find(s => s.id === item.sizeId);
                const itemName = item.category === 'Pants' ? `${requestData.gender}' Pants` : `${requestData.gender}' Shirts`;
                const itemId = `generic_${requestData.gender.toLowerCase()}_${item.category === 'Pants' ? 'pants' : 'shirts'}`;
                
                return {
                    itemId: itemId,
                    itemName: itemName,
                    sizeId: item.sizeId,
                    sizeLabel: sizeInfo?.size || '',
                    fit: sizeInfo?.fit || '',
                    quantity: item.quantity
                };
            });
    
            updateUniforms(selections);
             // Also submit the individual request to the main list
            await api.submitUniformRequest(requestData);
            navigate(-1); // Go back to UniformDetails page
            return;
        }

        try {
            if (requestData.id.startsWith('new_')) {
                await api.submitUniformRequest(requestData);
                setToast({ message: 'New request submitted.', type: 'success' });
            } else {
                await api.updateUniformRequest(requestData);
                setToast({ message: 'Request updated.', type: 'success' });
            }
            setView('list');
            fetchData();
        } catch (e) {
             setToast({ message: 'Failed to save request.', type: 'error' });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingRequest) return;
        try {
            await api.deleteUniformRequest(deletingRequest.id);
            setToast({ message: 'Request deleted.', type: 'success' });
            setDeletingRequest(null);
            fetchData();
        } catch (e) {
            setToast({ message: 'Failed to delete request.', type: 'error' });
        }
    };
    
    const totalItems = (items: UniformRequestItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);

    if (isLoading || !masterUniforms) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted" /></div>;
    }

    if (view === 'form') {
        const handleCancel = () => {
            if (cameFromOnboarding) {
                navigate(-1);
            } else {
                setView('list');
            }
        };

        return (
            <div className="h-full flex flex-col p-4 bg-[#041b0f] min-h-screen max-md:pb-36">
                {/* Mobile Top Back Bar */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Back</span>
                    </button>
                    <div className="h-[1px] flex-1 bg-[#134426]" />
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
                        {editingRequest ? 'EDIT REQUEST' : 'NEW UNIFORM'}
                    </span>
                </div>

                <main className="flex-1 overflow-y-auto">
                    <UniformRequestForm
                        onSave={handleSave}
                        onCancel={handleCancel}
                        sites={sites}
                        masterUniforms={masterUniforms}
                        initialData={editingRequest}
                    />
                </main>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 bg-[#041b0f] min-h-screen max-md:pb-36">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <Modal isOpen={!!deletingRequest} onClose={() => setDeletingRequest(null)} onConfirm={handleConfirmDelete} title="Confirm Deletion">
                Are you sure you want to delete this uniform request? This cannot be undone.
            </Modal>

            {/* Mobile Top Back Bar */}
            <div className="flex items-center gap-3 mb-4">
                <button
                    type="button"
                    onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/mobile-home')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Back</span>
                </button>
                <div className="h-[1px] flex-1 bg-[#134426]" />
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
                    UNIFORM REQUESTS
                </span>
                <button
                    onClick={handleNewRequest}
                    className="p-1.5 rounded-xl bg-[#44D62C]/10 border border-[#44D62C]/30 text-[#44D62C] hover:bg-[#44D62C]/20 active:scale-95 transition-all cursor-pointer"
                    aria-label="New Uniform Request"
                >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                </button>
            </div>

            <main className="flex-1 overflow-y-auto space-y-3">
                {requests.length > 0 ? (
                    requests.map(req => (
                        <div key={req.id} className="bg-[#092c19] p-4 rounded-2xl border border-[#134426] shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-white text-sm">{req.siteName}</p>
                                    <p className="text-[11px] text-[#7D967B] font-medium">{format(new Date(req.requestedDate), 'dd MMM, yyyy')}</p>
                                </div>
                                <UniformStatusChip status={req.status} />
                            </div>
                            <div className="mt-3 flex justify-between items-end border-t border-[#134426] pt-3">
                                <div className="text-xs text-[#a3b899]">
                                    <p className="font-semibold">{req.gender} Uniforms</p>
                                    <p className="font-black text-white text-sm">{totalItems(req.items)} Items</p>
                                </div>
                                {req.status === 'Pending' && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(req)}
                                            className="p-2 rounded-xl bg-[#041b0f] border border-[#134426] text-gray-300 hover:text-white hover:border-[#44D62C]/40 transition-all cursor-pointer"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeletingRequest(req)}
                                            className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-muted pt-16">
                        <Shirt className="h-12 w-12 mx-auto mb-4 text-[#44D62C]/40" />
                        <p className="text-sm font-bold text-white/60">No uniform requests found.</p>
                        <button
                            onClick={handleNewRequest}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#44D62C] text-[#0A1809] font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                            <Plus className="h-4 w-4 stroke-[2.5]" /> Create First Request
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default UniformRequests;
