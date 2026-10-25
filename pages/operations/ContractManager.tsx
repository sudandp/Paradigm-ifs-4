import React, { useState, useEffect, useMemo } from 'react';
import { useOpsStore } from '../../store/opsStore';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import type { OpsContract, ContractStatus } from '../../types/operations';
import { 
  Plus, 
  Search, 
  FileText, 
  AlertCircle, 
  Building2, 
  Calendar, 
  IndianRupee, 
  ExternalLink, 
  Loader2, 
  Phone, 
  Mail, 
  CheckCircle2, 
  RotateCw, 
  Layers, 
  Clock, 
  Sparkles,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import MobileTopBar from '../../components/navigation/MobileTopBar';
import { ContractDrawer } from '../../components/operations/ContractDrawer';
import { ContractFormModal } from '../../components/operations/ContractFormModal';

const STATUS_PILL_STYLES: Record<ContractStatus, { bg: string; text: string; border: string }> = {
  'Active': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Expiring Soon': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  'Expired': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  'Renewed': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Terminated': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' }
};

const ContractManager: React.FC = () => {
  const { 
    contracts, 
    fetchContracts, 
    createContract, 
    updateContract, 
    seedDemoContracts, 
    assets, 
    fetchAssets, 
    isLoading 
  } = useOpsStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'All'>('All');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal / Drawer state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Partial<OpsContract> | null>(null);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [selectedDrawerContract, setSelectedDrawerContract] = useState<OpsContract | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    fetchContracts();
    fetchAssets();
  }, []);

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchesSearch = 
        c.contractTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contractType.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [contracts, statusFilter, searchTerm]);

  // Statistical calculations
  const stats = useMemo(() => {
    const active = contracts.filter(c => c.status === 'Active').length;
    const expiring = contracts.filter(c => c.status === 'Expiring Soon').length;
    const expired = contracts.filter(c => c.status === 'Expired').length;
    const totalCommittedValue = contracts
      .filter(c => c.status === 'Active' || c.status === 'Expiring Soon')
      .reduce((sum, c) => sum + (c.contractValue || 0), 0);
    return { active, expiring, expired, totalCommittedValue };
  }, [contracts]);

  const handleOpenAdd = () => {
    setEditingContract(null);
    setIsRenewalMode(false);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (contract: OpsContract, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContract(contract);
    setIsRenewalMode(false);
    setIsFormOpen(true);
  };

  const handleRenew = (contract: OpsContract) => {
    setSelectedDrawerContract(null);
    const oldEndDate = new Date(contract.endDate);
    const newStartDate = new Date(oldEndDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const newEndDate = new Date(oldEndDate.getFullYear() + 1, oldEndDate.getMonth(), oldEndDate.getDate()).toISOString().split('T')[0];
    
    // Auto 5% indexation adjustment on annual value
    const indexedValue = Math.round((contract.contractValue || 0) * 1.05);

    setEditingContract({
      contractTitle: `${contract.contractTitle} (FY${new Date(newStartDate).getFullYear()}-${new Date(newEndDate).getFullYear()})`,
      contractType: contract.contractType,
      entityId: contract.entityId,
      vendorName: contract.vendorName,
      vendorContactPerson: contract.vendorContactPerson,
      vendorPhone: contract.vendorPhone,
      vendorEmail: contract.vendorEmail,
      contractValue: indexedValue,
      paymentFrequency: contract.paymentFrequency,
      startDate: newStartDate,
      endDate: newEndDate,
      renewalReminderDays: contract.renewalReminderDays,
      slaResponseTimeHours: contract.slaResponseTimeHours,
      slaResolutionTimeHours: contract.slaResolutionTimeHours,
      coveredAssetIds: contract.coveredAssetIds || [],
      scopeOfWork: contract.scopeOfWork,
      status: 'Active'
    });
    setIsRenewalMode(true);
    setIsFormOpen(true);
  };

  const handleSaveContract = async (contractData: Partial<OpsContract>) => {
    try {
      if (contractData.id) {
        await updateContract(contractData.id, contractData);
        setToast({ message: 'Contract updated successfully', type: 'success' });
      } else {
        await createContract(contractData);
        setToast({ 
          message: isRenewalMode ? 'Renewal agreement created successfully!' : 'Contract registered successfully', 
          type: 'success' 
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setToast({ message: err.message || 'Operation failed', type: 'error' });
      throw err;
    }
  };

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    try {
      await seedDemoContracts();
      setToast({ message: 'Enterprise demo contracts loaded successfully!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to seed contracts', type: 'error' });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <MobileTopBar title="CONTRACTS" parentPath="/mobile-home" />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contract Management</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
              Facility OS
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Track equipment AMCs, client facility agreements, vendor SLAs, and automated renewal cycles
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {contracts.length === 0 && (
            <Button 
              onClick={handleSeedDemo} 
              variant="outline" 
              className="gap-2 text-xs border-primary/30 text-primary hover:bg-primary/5"
              disabled={isSeeding}
            >
              {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Seed Enterprise AMCs
            </Button>
          )}
          <Button onClick={handleOpenAdd} variant="primary" className="gap-2 text-xs shadow-sm">
            <Plus className="w-4 h-4" /> Add Contract
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div 
          onClick={() => setStatusFilter('Active')}
          className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'Active' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Active Contracts</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{stats.active}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Compliant & in validity</div>
        </div>

        <div 
          onClick={() => setStatusFilter('Expiring Soon')}
          className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'Expiring Soon' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Expiring Soon</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{stats.expiring}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Under 45-day window</div>
        </div>

        <div 
          onClick={() => setStatusFilter('Expired')}
          className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
            statusFilter === 'Expired' ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Expired / Overdue</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">{stats.expired}</div>
          <div className="text-[11px] text-red-600 font-semibold mt-0.5">Immediate renewal needed</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Committed Annual Spend</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">
            ₹{stats.totalCommittedValue >= 100000 
              ? `${(stats.totalCommittedValue / 100000).toFixed(2)}L` 
              : stats.totalCommittedValue.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-0.5">Active operational commitments</div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 justify-between items-center bg-gray-50/50">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search contracts, vendors, or sites..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary shadow-2xs"
            />
          </div>

          <div className="flex gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {(['All', 'Active', 'Expiring Soon', 'Expired', 'Renewed', 'Terminated'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === status 
                    ? 'bg-gray-900 text-white shadow-xs' 
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Contract List / Grid */}
        <div className="flex-1 p-5 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-gray-500 font-medium">Loading operational agreements...</p>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                <Briefcase className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">No Contracts Found</h3>
              <p className="text-xs text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'All' 
                  ? 'No contracts matched your search filters.' 
                  : 'Get started by creating your first vendor AMC or client agreement.'}
              </p>
              {contracts.length === 0 && (
                <Button onClick={handleSeedDemo} variant="primary" className="gap-2 text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Seed Enterprise Demo Contracts
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredContracts.map(contract => {
                const today = new Date();
                const start = new Date(contract.startDate);
                const end = new Date(contract.endDate);
                const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                const elapsedDays = Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const progress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

                const pillStyle = STATUS_PILL_STYLES[contract.status] || STATUS_PILL_STYLES['Active'];

                return (
                  <div 
                    key={contract.id} 
                    onClick={() => setSelectedDrawerContract(contract)}
                    className="p-5 rounded-2xl border border-gray-200 bg-white hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-4"
                  >
                    {/* Top Row: Type & Status */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                          {contract.contractType}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${pillStyle.bg} ${pillStyle.text} ${pillStyle.border}`}>
                          {contract.status}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary transition leading-snug line-clamp-2">
                        {contract.contractTitle}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{contract.entityName || 'General Site Agreement'}</span>
                      </div>
                    </div>

                    {/* Lifespan Progress Bar */}
                    <div className="p-3 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500 font-medium">Contract Validity</span>
                        <span className={`font-bold ${
                          daysLeft < 0 
                            ? 'text-red-600' 
                            : daysLeft <= (contract.renewalReminderDays || 30) 
                            ? 'text-amber-700' 
                            : 'text-emerald-700'
                        }`}>
                          {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            daysLeft < 0 ? 'bg-red-500' : daysLeft <= (contract.renewalReminderDays || 30) ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span>{new Date(contract.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                        <span>{new Date(contract.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Middle Particulars: Vendor & Covered Assets */}
                    <div className="space-y-2 text-xs">
                      {contract.vendorName && (
                        <div className="flex items-center justify-between text-gray-700">
                          <span className="text-gray-400 text-[11px]">Vendor:</span>
                          <span className="font-semibold truncate max-w-[180px]">{contract.vendorName}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-gray-700">
                        <span className="text-gray-400 text-[11px]">Annual Value:</span>
                        <span className="font-bold text-gray-900">
                          ₹{(contract.contractValue || 0).toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Covered Assets Tag */}
                      {contract.coveredAssetIds && contract.coveredAssetIds.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] font-semibold text-gray-600">
                            {contract.coveredAssetIds.length} Linked Assets
                          </span>
                          <span className="text-[10px] text-gray-400">
                            ({contract.coveredAssetIds.slice(0, 2).join(', ')}{contract.coveredAssetIds.length > 2 ? '...' : ''})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {contract.vendorPhone && (
                          <a 
                            href={`tel:${contract.vendorPhone}`} 
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            title={`Call ${contract.vendorName}: ${contract.vendorPhone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {contract.vendorEmail && (
                          <a 
                            href={`mailto:${contract.vendorEmail}`} 
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition"
                            title={`Email ${contract.vendorEmail}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {contract.documentUrl && (
                          <a 
                            href={contract.documentUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:text-primary hover:bg-primary/10 transition"
                            title="View Agreement Document"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleOpenEdit(contract, e)}
                          className="px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
                        >
                          Edit
                        </button>
                        {(contract.status === 'Expiring Soon' || contract.status === 'Expired') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenew(contract);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition shadow-xs flex items-center gap-1"
                          >
                            <RotateCw className="w-3 h-3" /> Renew
                          </button>
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

      {/* Contract Detail & Document Vault Drawer */}
      <ContractDrawer 
        contract={selectedDrawerContract}
        isOpen={!!selectedDrawerContract}
        onClose={() => setSelectedDrawerContract(null)}
        onRenew={handleRenew}
      />

      {/* Contract Form Modal (New, Edit & Renewal) */}
      <ContractFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveContract}
        initialData={editingContract}
        assets={assets}
        isRenewal={isRenewalMode}
      />
    </div>
  );
};

export default ContractManager;
