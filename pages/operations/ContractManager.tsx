import React, { useState, useEffect } from 'react';
import { useOpsStore } from '../../store/opsStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import type { OpsContract, ContractType, ContractStatus } from '../../types/operations';
import { Plus, Search, FileText, AlertCircle, Building2, Calendar, IndianRupee, ExternalLink, Loader2 } from 'lucide-react';

const STATUS_COLORS: Record<ContractStatus, string> = {
  'Active': 'bg-green-100 text-green-800 border-green-200',
  'Expiring Soon': 'bg-orange-100 text-orange-800 border-orange-200',
  'Expired': 'bg-red-100 text-red-800 border-red-200',
  'Renewed': 'bg-blue-100 text-blue-800 border-blue-200',
  'Terminated': 'bg-gray-100 text-gray-800 border-gray-200'
};

const ContractManager: React.FC = () => {
  const { contracts, fetchContracts, createContract, updateContract, isLoading } = useOpsStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'All'>('All');
  
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  
  const [formData, setFormData] = useState<Partial<OpsContract>>({
    contractTitle: '',
    contractType: 'Client Agreement',
    startDate: '',
    endDate: '',
    contractValue: 0,
    renewalReminderDays: 30,
    status: 'Active',
    entityId: ''
  });

  useEffect(() => {
    fetchContracts();
  }, []);

  const filteredContracts = contracts.filter(c => 
    (statusFilter === 'All' || c.status === statusFilter) &&
    (c.contractTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
     c.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Quick stats
  const activeCount = contracts.filter(c => c.status === 'Active').length;
  const expiringCount = contracts.filter(c => c.status === 'Expiring Soon').length;
  const expiredCount = contracts.filter(c => c.status === 'Expired').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractTitle || !formData.entityId || !formData.startDate || !formData.endDate) {
      setToast({ message: 'Please fill in all required fields', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createContract(formData);
      setToast({ message: 'Contract created successfully', type: 'success' });
      setShowForm(false);
      setFormData({ 
        contractTitle: '', contractType: 'Client Agreement', 
        startDate: '', endDate: '', contractValue: 0, 
        renewalReminderDays: 30, status: 'Active', entityId: '' 
      });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenew = async (contract: OpsContract) => {
    try {
      // Logic for renewal (could copy the contract and set new dates, or just update status)
      await updateContract(contract.id, { status: 'Renewed' });
      setToast({ message: 'Contract marked as renewed. Please create the new agreement entry.', type: 'success' });
      
      // Auto-fill form for the new contract
      setFormData({
        contractTitle: `${contract.contractTitle} (Renewal)`,
        contractType: contract.contractType,
        entityId: contract.entityId,
        vendorName: contract.vendorName,
        contractValue: contract.contractValue,
        startDate: contract.endDate, // Start date of new = End date of old
        endDate: '', 
        renewalReminderDays: contract.renewalReminderDays,
        status: 'Active'
      });
      setShowForm(true);
      
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-text">Contract Management</h1>
          <p className="text-sm text-muted">Track AMCs, Client Agreements, and lease renewals</p>
        </div>
        <Button onClick={() => setShowForm(true)} variant="primary" className="gap-2">
          <Plus className="w-4 h-4" /> Add Contract
        </Button>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm cursor-pointer hover:border-green-300 transition-colors" onClick={() => setStatusFilter('Active')}>
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-text">{activeCount}</div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">Active Contracts</div>
          </div>
        </div>
        <div className="bg-card border border-orange-200 rounded-xl p-4 flex items-center gap-4 shadow-sm cursor-pointer hover:border-orange-400 transition-colors" onClick={() => setStatusFilter('Expiring Soon')}>
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-text">{expiringCount}</div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">Expiring Soon</div>
          </div>
        </div>
        <div className="bg-card border border-red-200 rounded-xl p-4 flex items-center gap-4 shadow-sm cursor-pointer hover:border-red-400 transition-colors" onClick={() => setStatusFilter('Expired')}>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-text">{expiredCount}</div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">Expired</div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm animate-fade-in-down">
          <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">Add New Contract</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Contract Title *" value={formData.contractTitle} onChange={e => setFormData(p => ({ ...p, contractTitle: e.target.value }))} className="md:col-span-2" />
              <Input label="Entity ID (Temp) *" value={formData.entityId} onChange={e => setFormData(p => ({ ...p, entityId: e.target.value }))} />
              
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Type *</label>
                <select className="form-input" value={formData.contractType} onChange={e => setFormData(p => ({ ...p, contractType: e.target.value as any }))}>
                  {['Client Agreement', 'Vendor AMC', 'Lease', 'Service Level Agreement', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <Input label="Vendor Name (If applicable)" value={formData.vendorName || ''} onChange={e => setFormData(p => ({ ...p, vendorName: e.target.value }))} />
              <Input label="Annual Value (₹)" type="number" value={formData.contractValue || ''} onChange={e => setFormData(p => ({ ...p, contractValue: Number(e.target.value) }))} />

              <Input label="Start Date *" type="date" value={formData.startDate} onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))} />
              <Input label="End Date *" type="date" value={formData.endDate} onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))} />
              
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Reminder Days</label>
                <select className="form-input" value={formData.renewalReminderDays} onChange={e => setFormData(p => ({ ...p, renewalReminderDays: Number(e.target.value) }))}>
                  <option value="15">15 Days Before</option>
                  <option value="30">30 Days Before</option>
                  <option value="60">60 Days Before</option>
                  <option value="90">90 Days Before</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Contract
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-accent/5">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Search contracts..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-page border border-border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['All', 'Active', 'Expiring Soon', 'Expired', 'Renewed', 'Terminated'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === status ? 'bg-accent text-white' : 'bg-page border border-border text-muted hover:text-primary-text'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-10 text-muted">No contracts found</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredContracts.map(contract => {
                const daysLeft = contract.endDate ? Math.ceil((new Date(contract.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                
                return (
                  <div key={contract.id} className="p-4 rounded-xl border border-border bg-page hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent uppercase tracking-wider mb-2 inline-block">
                          {contract.contractType}
                        </span>
                        <h3 className="text-sm font-bold text-primary-text leading-tight">{contract.contractTitle}</h3>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${STATUS_COLORS[contract.status]}`}>
                        {contract.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Building2 className="w-3.5 h-3.5 text-accent" />
                        <span className="truncate" title={contract.entityName || 'Unknown Entity'}>
                          {contract.entityName || 'Unknown Entity'}
                        </span>
                      </div>
                      {contract.vendorName && (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <FileText className="w-3.5 h-3.5 text-accent" />
                          <span className="truncate">{contract.vendorName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Calendar className="w-3.5 h-3.5 text-accent" />
                        <span>Ends: {new Date(contract.endDate).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <IndianRupee className="w-3.5 h-3.5 text-accent" />
                        <span className="font-semibold text-primary-text">
                          {contract.contractValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-border">
                      <div className="text-[10px] font-bold uppercase tracking-wider">
                        {daysLeft < 0 ? (
                          <span className="text-red-500">Expired {Math.abs(daysLeft)} days ago</span>
                        ) : daysLeft <= contract.renewalReminderDays ? (
                          <span className="text-orange-500">Expires in {daysLeft} days</span>
                        ) : (
                          <span className="text-green-600">{daysLeft} days remaining</span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {contract.documentUrl && (
                          <a href={contract.documentUrl} target="_blank" rel="noreferrer" className="p-1.5 text-muted hover:text-accent bg-accent/5 rounded-lg transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {(contract.status === 'Expiring Soon' || contract.status === 'Expired') && (
                          <Button onClick={() => handleRenew(contract)} variant="primary" className="py-1 px-3 text-xs gap-1">
                            Renew
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Also export the generic Lucide CheckCircle icon used in stats widget
const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default ContractManager;
