import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import type { Organization, MasterGentsUniforms, GentsPantsSize, GentsShirtSize, MasterLadiesUniforms, LadiesPantsSize, LadiesShirtSize, UniformRequest, UniformRequestItem } from '../../types';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toast from '../../components/ui/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { Loader2, Plus, Shirt, Eye, Edit, Trash2, X, ChevronDown, Save } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';




const UniformStatusChip: React.FC<{ status: UniformRequest['status'] }> = ({ status }) => {
    const styles: Record<UniformRequest['status'], string> = {
        'Pending': 'bg-yellow-100 text-yellow-800',
        'Approved': 'bg-blue-100 text-blue-800',
        'Issued': 'bg-green-100 text-green-800',
        'Rejected': 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${styles[status]}`}>{status}</span>;
};

interface UniformSizeTableProps {
    title: string;
    sizes: (GentsPantsSize | GentsShirtSize | LadiesPantsSize | LadiesShirtSize)[];
    headers: { key: string, label: string }[];
    control?: any; // Optional for read-only
    quantityType?: 'pantsQuantities' | 'shirtsQuantities'; // Optional for read-only
    quantities?: Record<string, number | null>; // For read-only mode
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
        <div className="border rounded-lg flex flex-col overflow-hidden">
            <h4 className="p-3 font-semibold bg-page border-b flex-shrink-0">{title}</h4>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-page">
                        <tr>
                            <th className="px-2 py-2 text-left font-medium text-muted">Size</th>
                            {headers.map(h => <th key={String(h.key)} className="px-2 py-2 text-left font-medium text-muted">{h.label}</th>)}
                            <th className="px-2 py-2 text-left font-medium text-muted w-20">Qty</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sizeKeys.map(size => (
                            <React.Fragment key={size}>
                                {fits.map((fit, fitIndex) => {
                                    const sizeForFit = sizes.find(s => s.size === size && s.fit === fit);
                                    if (!sizeForFit) return null;
                                    return (
                                        <tr key={sizeForFit.id}>
                                            {fitIndex === 0 && <td rowSpan={fits.filter(f => sizes.some(s => s.size === size && s.fit === f)).length} className="px-2 py-2 align-middle font-semibold border-r">{size}</td>}
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



const RequestDetailsModal: React.FC<{
    request: UniformRequest | null;
    onClose: () => void;
    masterUniforms: { gents: MasterGentsUniforms, ladies: MasterLadiesUniforms };
}> = ({ request, onClose, masterUniforms }) => {
    if (!request) return null;

    const { pantsQuantities, shirtsQuantities } = useMemo(() => {
        const pants: Record<string, number | null> = {};
        const shirts: Record<string, number | null> = {};
        request.items.forEach(item => {
            if (item.category === 'Pants') {
                pants[item.sizeId] = item.quantity;
            } else {
                shirts[item.sizeId] = item.quantity;
            }
        });
        return { pantsQuantities: pants, shirtsQuantities: shirts };
    }, [request.items]);

    const currentMaster = request.gender === 'Gents' ? masterUniforms.gents : masterUniforms.ladies;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4" onClick={onClose}>
            <div className="bg-card rounded-xl shadow-card w-full max-w-6xl my-4 animate-fade-in-scale flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-start flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-primary-text">Uniform Request Details</h3>
                        <p className="text-sm text-muted">{request.siteName} - {format(new Date(request.requestedDate), 'dd MMM, yyyy')}</p>
                    </div>
                    <Button variant="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {request.gender === 'Gents' ? (
                            <>
                                <UniformSizeTable readOnly title="Gents' Pants" sizes={currentMaster.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'tilesLoose', label: 'TL' }, { key: 'bottomWaist', label: 'BW' }, { key: 'fit', label: 'Fit' }]} quantities={pantsQuantities} />
                                <UniformSizeTable readOnly title="Gents' Shirts" sizes={currentMaster.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'chest', label: 'C' }, { key: 'shoulder', label: 'Sh' }, { key: 'collar', label: 'Co' }, { key: 'fit', label: 'Fit' }]} quantities={shirtsQuantities} />
                            </>
                        ) : (
                            <>
                                <UniformSizeTable readOnly title="Ladies' Pants" sizes={currentMaster.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'hip', label: 'H' }, { key: 'fit', label: 'Fit' }]} quantities={pantsQuantities} />
                                <UniformSizeTable readOnly title="Ladies' Shirts" sizes={currentMaster.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'bust', label: 'B' }, { key: 'shoulder', label: 'Sh' }, { key: 'fit', label: 'Fit' }]} quantities={shirtsQuantities} />
                            </>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end flex-shrink-0">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
};

const UniformDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [requests, setRequests] = useState<UniformRequest[]>([]);
    const [sites, setSites] = useState<Organization[]>([]);
    const [masterUniforms, setMasterUniforms] = useState<{ gents: MasterGentsUniforms, ladies: MasterLadiesUniforms } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [editingRequest, setEditingRequest] = useState<UniformRequest | null>(null);
    const [deletingRequest, setDeletingRequest] = useState<UniformRequest | null>(null);
    const [viewingRequest, setViewingRequest] = useState<UniformRequest | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [reqs, sitesData, gentsData, ladiesData] = await Promise.all([
                api.getUniformRequests(),
                api.getOrganizations(),
                api.getMasterGentsUniforms(),
                api.getMasterLadiesUniforms(),
            ]);
            setRequests(reqs);
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

    const handleNewRequest = () => {
        navigate('/uniforms/request/new');
    };

    const handleEdit = (request: UniformRequest) => {
        navigate(`/uniforms/request/edit/${request.id}`);
    };

    const handleSave = async (data: UniformRequest) => {
        try {
            if (data.id.startsWith('new_')) {
                await api.submitUniformRequest(data);
                setToast({ message: 'New request submitted.', type: 'success' });
            } else {
                await api.updateUniformRequest(data);
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

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
    }

    return (
        <div className="p-4 space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <Modal isOpen={!!deletingRequest} onClose={() => setDeletingRequest(null)} onConfirm={handleConfirmDelete} title="Confirm Deletion">
                Are you sure you want to delete this uniform request? This cannot be undone.
            </Modal>
            {masterUniforms && <RequestDetailsModal request={viewingRequest} onClose={() => setViewingRequest(null)} masterUniforms={masterUniforms} />}

            <div className="bg-card p-4 rounded-2xl">
                <AdminPageHeader title="Uniform Management">
                    {view === 'list' && <Button onClick={handleNewRequest}><Plus className="mr-2 h-4 w-4" /> New Uniform Request</Button>}
                </AdminPageHeader>
            </div>



            {view === 'list' && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm responsive-table">
                        <thead className="bg-page">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-muted">Site / Employee</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Gender</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Requested By</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Source</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(req => (
                                <tr key={req.id}>
                                    <td data-label="Site" className="px-4 py-3 font-medium">
                                        <p>{req.siteName}</p>
                                        {req.source === 'Individual' && req.employeeDetails?.[0]?.employeeName && (
                                            <p className="text-xs text-muted">For: {req.employeeDetails[0].employeeName}</p>
                                        )}
                                        {req.source === 'Enrollment' && (
                                            <p className="text-xs text-muted">({req.employeeDetails?.length || 0} employees)</p>
                                        )}
                                    </td>
                                    <td data-label="Gender" className="px-4 py-3 text-muted">{req.gender}</td>
                                    <td data-label="Requested By" className="px-4 py-3 text-muted">{req.requestedByName || 'System'}</td>
                                    <td data-label="Source" className="px-4 py-3 text-muted">{req.source || 'Bulk'}</td>
                                    <td data-label="Status" className="px-4 py-3"><UniformStatusChip status={req.status} /></td>
                                    <td data-label="Actions" className="px-4 py-3">
                                        <div className="flex items-center gap-2 md:justify-start justify-end">
                                            <Button variant="icon" size="sm" onClick={() => setViewingRequest(req)} title="View Request"><Eye className="h-4 w-4" /></Button>
                                            <Button variant="icon" size="sm" onClick={() => handleEdit(req)} title="Edit Request" disabled={req.source === 'Enrollment'}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="icon" size="sm" onClick={() => setDeletingRequest(req)} title="Delete Request" disabled={req.source === 'Enrollment'}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {requests.length === 0 && <p className="text-center p-8 text-muted">No uniform requests found.</p>}
                </div>
            )}
        </div>
    );
};

export default UniformDashboard;