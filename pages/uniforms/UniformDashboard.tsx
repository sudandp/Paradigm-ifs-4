import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { 
    Organization, 
    MasterGentsUniforms, 
    GentsPantsSize, 
    GentsShirtSize, 
    MasterLadiesUniforms, 
    LadiesPantsSize, 
    LadiesShirtSize, 
    UniformRequest, 
    UniformRequestItem 
} from '../../types';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { 
    Loader2, 
    Plus, 
    Shirt, 
    X, 
    ChevronDown, 
    Edit, 
    Search,
    Filter
} from 'lucide-react';
import { format } from 'date-fns';

const UniformStatusChip: React.FC<{ status: UniformRequest['status'] }> = ({ status }) => {
    const styles: Record<UniformRequest['status'], string> = {
        'Pending': 'bg-amber-100 text-amber-700 border-amber-200',
        'Approved': 'bg-blue-100 text-blue-700 border-blue-200',
        'Issued': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Rejected': 'bg-rose-100 text-rose-700 border-rose-200',
    };
    return <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border shadow-sm ${styles[status]}`}>{status}</span>;
};

interface UniformSizeTableProps {
    title: string;
    sizes: (GentsPantsSize | GentsShirtSize | LadiesPantsSize | LadiesShirtSize)[];
    headers: { key: string, label: string }[];
    quantities?: Record<string, number | null>;
    costs?: Record<string, number | null>;
}

const UniformSizeTable: React.FC<UniformSizeTableProps> = ({ title, sizes, headers, quantities, costs }) => {
    const fits = Array.from(new Set(sizes.map(s => s.fit)));
    const sizeKeys = Array.from(new Set(sizes.map(s => s.size))).sort((a, b) => parseInt(String(a)) - parseInt(String(b)));

    return (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <h4 className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-page/50 border-b border-border text-muted">{title}</h4>
            <div className="overflow-x-auto">
                <table className="min-w-full text-[11px]">
                    <thead className="bg-page/30 text-muted font-bold">
                        <tr>
                            <th className="px-3 py-2 text-left">Size</th>
                            {headers.map(h => <th key={String(h.key)} className="px-3 py-2 text-left">{h.label}</th>)}
                            <th className="px-3 py-2 text-center w-12 font-black text-primary-text">Qty</th>
                            <th className="px-3 py-2 text-right w-16">Cost</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sizeKeys.map(size => (
                            <React.Fragment key={size}>
                                {fits.map((fit, fitIdx) => {
                                    const s = sizes.find(sz => sz.size === size && sz.fit === fit);
                                    if (!s || !quantities?.[s.id]) return null;
                                    return (
                                        <tr key={s.id} className="hover:bg-accent/5">
                                            {fitIdx === 0 && (
                                                <td rowSpan={fits.filter(f => sizes.some(sz => sz.size === size && sz.fit === f && quantities?.[sz.id])).length} className="px-3 py-2 font-black border-r border-border bg-page/20">
                                                    {size}
                                                </td>
                                            )}
                                            {headers.map(h => <td key={String(h.key)} className="px-3 py-2">{(s as any)[h.key]}</td>)}
                                            <td className="px-3 py-2 text-center bg-accent/5 font-black text-accent">{quantities[s.id]}</td>
                                            <td className="px-3 py-2 text-right font-medium text-muted">₹{costs?.[s.id] || 0}</td>
                                        </tr>
                                    );
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

    const { pantsQuantities, shirtsQuantities, pantsCosts, shirtsCosts } = useMemo(() => {
        const pq: Record<string, number | null> = {};
        const sq: Record<string, number | null> = {};
        const pc: Record<string, number | null> = {};
        const sc: Record<string, number | null> = {};
        
        request.items.forEach(item => {
            if (item.category === 'Pants') {
                pq[item.sizeId] = item.quantity;
                pc[item.sizeId] = item.cost || null;
            } else {
                sq[item.sizeId] = item.quantity;
                sc[item.sizeId] = item.cost || null;
            }
        });
        return { pantsQuantities: pq, shirtsQuantities: sq, pantsCosts: pc, shirtsCosts: sc };
    }, [request.items]);

    const currentMaster = request.gender === 'Gents' ? masterUniforms.gents : masterUniforms.ladies;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-text/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl animate-in zoom-in-95 duration-200 border border-border flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border flex justify-between items-center bg-page/30">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                            <Shirt className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-primary-text">{request.siteName}</h3>
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">{request.gender} ({format(new Date(request.requestedDate), 'dd MMM yyyy')})</p>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={onClose} className="rounded-full h-8 w-8 !p-0"><X className="h-4 w-4" /></Button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {request.gender === 'Gents' ? (
                            <>
                                <UniformSizeTable title="Gents' PantsScale" sizes={currentMaster.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'fit', label: 'Fit' }]} quantities={pantsQuantities} costs={pantsCosts} />
                                <UniformSizeTable title="Gents' ShirtsScale" sizes={currentMaster.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'fit', label: 'Fit' }]} quantities={shirtsQuantities} costs={shirtsCosts} />
                            </>
                        ) : (
                            <>
                                <UniformSizeTable title="Ladies' PantsScale" sizes={currentMaster.pants} headers={[{ key: 'length', label: 'L' }, { key: 'waist', label: 'W' }, { key: 'fit', label: 'Fit' }]} quantities={pantsQuantities} costs={pantsCosts} />
                                <UniformSizeTable title="Ladies' ShirtsScale" sizes={masterUniforms.ladies.shirts} headers={[{ key: 'length', label: 'L' }, { key: 'sleeves', label: 'S' }, { key: 'bust', label: 'B' }, { key: 'fit', label: 'Fit' }]} quantities={shirtsQuantities} costs={shirtsCosts} />
                            </>
                        )}
                    </div>
                    
                    {request.totalCost && (
                        <div className="flex justify-end pt-4">
                            <div className="px-6 py-3 bg-accent text-white rounded-2xl shadow-lg border border-accent-dark flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Deduction Value</span>
                                <span className="text-2xl font-black">₹{request.totalCost.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const UniformDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState<UniformRequest[]>([]);
    const [sites, setSites] = useState<Organization[]>([]);
    const [masterUniforms, setMasterUniforms] = useState<{ gents: MasterGentsUniforms, ladies: MasterLadiesUniforms } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [viewingRequest, setViewingRequest] = useState<UniformRequest | null>(null);
    const [statusFilter, setStatusFilter] = useState<UniformRequest['status'] | 'All'>('All');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [reqs, sitesData, gentsData, ladiesData] = await Promise.all([
                api.getUniformRequests(),
                api.getOrganizations(),
                api.getMasterGentsUniforms(),
                api.getMasterLadiesUniforms(),
            ]);
            setRequests(reqs.sort((a,b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime()));
            setSites(sitesData);
            setMasterUniforms({ gents: gentsData, ladies: ladiesData });
        } catch (e) {
            setToast({ message: 'Failed to load uniform data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
            const matchesSearch = !searchTerm || r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 r.designation?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [requests, statusFilter, searchTerm]);

    const stats = useMemo(() => {
        const s = { pending: 0, approved: 0, issued: 0, rejected: 0 };
        requests.forEach(r => {
            if (r.status === 'Pending') s.pending++;
            else if (r.status === 'Approved') s.approved++;
            else if (r.status === 'Issued') s.issued++;
            else if (r.status === 'Rejected') s.rejected++;
        });
        return s;
    }, [requests]);

    const handleBulkAction = async (newStatus: UniformRequest['status']) => {
        if (selectedIds.length === 0) return;
        setIsProcessing(true);
        try {
            await Promise.all(selectedIds.map(id => {
                const req = requests.find(r => r.id === id);
                if (req) {
                    return api.updateUniformRequest({ ...req, status: newStatus });
                }
                return Promise.resolve();
            }));
            setToast({ message: `Successfully ${newStatus === 'Approved' ? 'approved' : 'issued'} ${selectedIds.length} requests.`, type: 'success' });
            setSelectedIds([]);
            fetchData();
        } catch (e) {
            setToast({ message: 'Failed to process bulk action.', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    if (isLoading) {
        return <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-accent">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm font-bold animate-pulse">Syncing distribution logs...</p>
        </div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            {masterUniforms && viewingRequest && <RequestDetailsModal request={viewingRequest} onClose={() => setViewingRequest(null)} masterUniforms={masterUniforms} />}

            {/* Header / Stats Bento Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div className="md:col-span-2 lg:col-span-1 bg-card border border-border p-6 rounded-3xl shadow-sm flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute -right-4 -top-4 bg-accent/5 p-8 rounded-full group-hover:scale-110 transition-transform duration-500">
                        <Shirt className="h-12 w-12 text-accent/20" />
                    </div>
                    <h2 className="text-2xl font-black text-primary-text leading-tight">Uniform<br/>Distribution</h2>
                    <Button onClick={() => navigate('/uniforms/request/new')} className="mt-8 !rounded-2xl shadow-xl border-b-4 border-accent-dark active:border-b-0 active:translate-y-1 transition-all">
                        <Plus className="mr-2 h-5 w-5" /> Create New
                    </Button>
                </div>

                {[
                    { label: 'Pending Approval', count: stats.pending, color: 'text-amber-500', bg: 'bg-amber-500/5', status: 'Pending' },
                    { label: 'Ready for Issuance', count: stats.approved, color: 'text-blue-500', bg: 'bg-blue-500/5', status: 'Approved' },
                    { label: 'Successfully Issued', count: stats.issued, color: 'text-emerald-500', bg: 'bg-emerald-500/5', status: 'Issued' },
                    { label: 'Rejected Entries', count: stats.rejected, color: 'text-rose-500', bg: 'bg-rose-500/5', status: 'Rejected' },
                ].map((stat, i) => (
                    <div 
                        key={i} 
                        onClick={() => setStatusFilter(stat.status as any)}
                        className={`bg-card border border-border p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-all group ${statusFilter === stat.status ? 'ring-2 ring-accent border-transparent' : ''}`}
                    >
                        <div className={`h-8 w-8 rounded-full ${stat.bg} flex items-center justify-center mb-4 font-black ${stat.color} text-xs`}>{stat.count}</div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">{stat.label}</p>
                        <div className="flex items-end justify-between mt-2">
                            <span className={`text-4xl font-black ${stat.color}`}>{stat.count}</span>
                            <ChevronDown className={`h-4 w-4 text-muted/30 group-hover:text-muted transition-colors ${statusFilter === stat.status ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="bg-card border border-border rounded-[40px] overflow-hidden shadow-sm">
                <div className="p-8 border-b border-border flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-page/30 backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex p-1.5 bg-white/50 dark:bg-card/50 rounded-2xl border border-border">
                            {(['All', 'Pending', 'Approved', 'Issued', 'Rejected'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${statusFilter === s ? 'bg-accent text-white shadow-md' : 'text-muted hover:text-primary-text'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent transition-colors" />
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by site or role..."
                                className="pl-11 pr-4 py-2.5 bg-white/50 dark:bg-card/50 border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent min-w-[280px] transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {selectedIds.length > 0 ? (
                            <div className="flex items-center gap-3 animate-in slide-in-from-right duration-300">
                                <p className="text-[10px] font-black text-accent bg-accent/10 px-4 py-2 rounded-xl border border-accent/20">
                                    {selectedIds.length} BATCH SELECTED
                                </p>
                                {statusFilter === 'Pending' && <Button size="sm" onClick={() => handleBulkAction('Approved')} isLoading={isProcessing} className="!rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600">Approve Batch</Button>}
                                {statusFilter === 'Approved' && <Button size="sm" onClick={() => handleBulkAction('Issued')} isLoading={isProcessing} className="!rounded-xl shadow-lg shadow-emerald-500/20 bg-emerald-600">Mark as Issued</Button>}
                                <Button variant="secondary" size="sm" onClick={() => setSelectedIds([])} disabled={isProcessing} className="!rounded-xl hover:bg-rose-50 hover:text-rose-600">Clear</Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-muted/40 cursor-not-allowed">
                                <Filter className="h-4 w-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Select items for bulk actions</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-page/50 text-[10px] font-black text-muted uppercase tracking-widest">
                                <th className="px-8 py-5 text-left w-12">
                                    <input 
                                        type="checkbox" 
                                        className="h-5 w-5 rounded-lg border-border text-accent focus:ring-accent cursor-pointer transition-all" 
                                        onChange={(e) => setSelectedIds(e.target.checked ? filteredRequests.map(r => r.id) : [])}
                                        checked={selectedIds.length === filteredRequests.length && filteredRequests.length > 0}
                                    />
                                </th>
                                <th className="px-6 py-5 text-left">Site Context</th>
                                <th className="px-6 py-5 text-left">Role Profile</th>
                                <th className="px-6 py-5 text-center">Batch Vol</th>
                                <th className="px-6 py-5 text-right">Deduction Value</th>
                                <th className="px-6 py-5 text-center">Status</th>
                                <th className="px-6 py-5 text-right">Log Date</th>
                                <th className="px-6 py-5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredRequests.map(req => (
                                <tr key={req.id} className={`group hover:bg-accent/[0.02] transition-all ${selectedIds.includes(req.id) ? 'bg-accent/[0.04]' : ''}`}>
                                    <td className="px-8 py-6">
                                        <input 
                                            type="checkbox" 
                                            className="h-5 w-5 rounded-lg border-border text-accent focus:ring-accent cursor-pointer" 
                                            checked={selectedIds.includes(req.id)}
                                            onChange={() => toggleSelect(req.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-11 w-11 rounded-2xl bg-page border border-border flex items-center justify-center font-black text-muted text-xs group-hover:border-accent/40 shadow-sm transition-all">
                                                {req.siteName?.substring(0,2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-primary-text text-base leading-tight">{req.siteName}</p>
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">{req.department || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div>
                                            <p className="font-bold text-primary-text text-sm">{req.designation || 'Site Personnel'}</p>
                                            <p className="text-[10px] text-muted font-black uppercase tracking-wider">{req.gender}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <span className="px-3 py-1.5 bg-page rounded-xl text-[10px] font-black text-primary-text border border-border group-hover:border-accent/40 shadow-sm">
                                            {req.items.reduce((acc, item) => acc + item.quantity, 0)} UNITS
                                        </span>
                                    </td>
                                    <td className="px-6 py-6 text-right font-black text-primary-text/80 text-base">
                                        ₹{req.totalCost?.toLocaleString() || '0'}
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <UniformStatusChip status={req.status} />
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <p className="text-[10px] font-black text-primary-text">{format(new Date(req.requestedDate), 'dd MMM yyyy')}</p>
                                        <p className="text-[9px] font-bold text-muted uppercase tracking-tighter mt-0.5">{format(new Date(req.requestedDate), 'HH:mm')}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center justify-end scale-90 opacity-0 group-hover:opacity-100 transition-all gap-2 translate-x-4 group-hover:translate-x-0">
                                            <Button variant="secondary" size="sm" onClick={() => setViewingRequest(req)} className="h-9 !rounded-xl !border-border hover:!bg-accent hover:!text-white hover:!border-accent shadow-sm px-4">Open Logs</Button>
                                            <Button variant="secondary" size="sm" onClick={() => navigate(`/uniforms/request/edit/${req.id}`)} className="h-9 w-9 !p-0 !rounded-xl active:scale-95"><Edit className="h-4 w-4" /></Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredRequests.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 bg-page/5">
                            <div className="p-6 bg-muted/5 rounded-full mb-6 animate-pulse">
                                <Shirt className="h-16 w-16 text-muted/10" />
                            </div>
                            <h4 className="text-lg font-black text-primary-text/30 uppercase tracking-[0.2em]">No Logged Entries</h4>
                            <p className="text-xs text-muted font-bold mt-2">Try adjusting your filters or search terms</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UniformDashboard;