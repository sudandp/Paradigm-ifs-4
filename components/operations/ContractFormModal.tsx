import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  FileText, 
  Calendar, 
  IndianRupee, 
  User, 
  Phone, 
  Mail, 
  Clock, 
  Layers, 
  Loader2, 
  Check, 
  Link as LinkIcon 
} from 'lucide-react';
import type { OpsContract, ContractType, ContractStatus, OpsAsset } from '../../types/operations';
import { opsApi } from '../../services/opsApi';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface ContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contract: Partial<OpsContract>) => Promise<void>;
  initialData?: Partial<OpsContract> | null;
  assets: OpsAsset[];
  isRenewal?: boolean;
}

export const ContractFormModal: React.FC<ContractFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  assets,
  isRenewal = false
}) => {
  if (!isOpen) return null;

  const [entities, setEntities] = useState<Array<{ id: string; name: string; location?: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<OpsContract>>({
    contractTitle: '',
    contractType: 'Vendor AMC',
    entityId: '',
    vendorName: '',
    vendorContactPerson: '',
    vendorPhone: '',
    vendorEmail: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    contractValue: 0,
    paymentFrequency: 'Quarterly',
    renewalReminderDays: 45,
    status: 'Active',
    slaResponseTimeHours: 2,
    slaResolutionTimeHours: 8,
    scopeOfWork: '',
    documentUrl: '',
    coveredAssetIds: [],
    autoRenewal: false
  });

  useEffect(() => {
    const fetchEntities = async () => {
      try {
        const ents = await opsApi.getContractEntities();
        setEntities(ents);
        if (ents.length > 0 && !formData.entityId) {
          setFormData(prev => ({ ...prev, entityId: ents[0].id }));
        }
      } catch (err) {
        console.warn('Could not load entities', err);
      }
    };
    fetchEntities();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        coveredAssetIds: initialData.coveredAssetIds || []
      }));
    }
  }, [initialData]);

  const toggleAsset = (assetIdentifier: string) => {
    setFormData(prev => {
      const current = prev.coveredAssetIds || [];
      if (current.includes(assetIdentifier)) {
        return { ...prev, coveredAssetIds: current.filter(id => id !== assetIdentifier) };
      } else {
        return { ...prev, coveredAssetIds: [...current, assetIdentifier] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractTitle?.trim()) {
      setError('Contract title is required');
      return;
    }
    if (!formData.entityId) {
      setError('Please select a society/site');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setError('Start and End dates are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  const CONTRACT_TYPES: ContractType[] = [
    'Vendor AMC',
    'Client Agreement',
    'Service Level Agreement',
    'Lease',
    'Other'
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {isRenewal ? 'Renew Operational Agreement' : formData.id ? 'Edit Contract' : 'Add New Contract & AMC'}
            </h3>
            <p className="text-xs text-gray-500">
              {isRenewal 
                ? 'Create a successor agreement with updated indexation and duration' 
                : 'Configure vendor AMC, SLA targets, and bi-directional equipment coverage'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: General Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" /> General Particulars
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contract / Agreement Title *</label>
                <input 
                  type="text"
                  placeholder="e.g. Thermax STP Comprehensive Annual Maintenance"
                  value={formData.contractTitle}
                  onChange={e => setFormData(p => ({ ...p, contractTitle: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Society / Site *</label>
                <select 
                  value={formData.entityId}
                  onChange={e => setFormData(p => ({ ...p, entityId: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                  required
                >
                  {entities.length === 0 ? (
                    <option value="">Default Society</option>
                  ) : (
                    entities.map(ent => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name} {ent.location ? `(${ent.location})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Agreement Type *</label>
                <select 
                  value={formData.contractType}
                  onChange={e => setFormData(p => ({ ...p, contractType: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                >
                  {CONTRACT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Vendor Contact Info */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Vendor & Support Desk
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor / Agency Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Thermax Water Technologies Ltd"
                  value={formData.vendorName || ''}
                  onChange={e => setFormData(p => ({ ...p, vendorName: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Person (Account Manager)</label>
                <input 
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  value={formData.vendorContactPerson || ''}
                  onChange={e => setFormData(p => ({ ...p, vendorContactPerson: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Emergency Phone Number</label>
                <input 
                  type="text"
                  placeholder="+91 98450 12345"
                  value={formData.vendorPhone || ''}
                  onChange={e => setFormData(p => ({ ...p, vendorPhone: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Support Email</label>
                <input 
                  type="email"
                  placeholder="service@vendor.com"
                  value={formData.vendorEmail || ''}
                  onChange={e => setFormData(p => ({ ...p, vendorEmail: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Commercials & Dates */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Commercials & Timeline
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Annual Contract Value (₹)</label>
                <input 
                  type="number"
                  placeholder="e.g. 450000"
                  value={formData.contractValue || ''}
                  onChange={e => setFormData(p => ({ ...p, contractValue: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Billing Frequency</label>
                <select 
                  value={formData.paymentFrequency}
                  onChange={e => setFormData(p => ({ ...p, paymentFrequency: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Half-Yearly">Half-Yearly</option>
                  <option value="Annually">Annually</option>
                  <option value="One-Time">One-Time</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date *</label>
                <input 
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">End Date *</label>
                <input 
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Expiry Notification Lead Time</label>
                <select 
                  value={formData.renewalReminderDays}
                  onChange={e => setFormData(p => ({ ...p, renewalReminderDays: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                >
                  <option value={15}>15 Days in Advance</option>
                  <option value={30}>30 Days in Advance</option>
                  <option value={45}>45 Days in Advance</option>
                  <option value={60}>60 Days in Advance</option>
                  <option value={90}>90 Days in Advance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Signed Agreement PDF URL</label>
                <input 
                  type="url"
                  placeholder="https://.../signed-contract.pdf"
                  value={formData.documentUrl || ''}
                  onChange={e => setFormData(p => ({ ...p, documentUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: SLA & Covered Equipment */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> SLA & Covered Equipment Linkage
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Emergency SLA Response (Hours)</label>
                <input 
                  type="number"
                  value={formData.slaResponseTimeHours || ''}
                  onChange={e => setFormData(p => ({ ...p, slaResponseTimeHours: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target SLA Resolution (Hours)</label>
                <input 
                  type="number"
                  value={formData.slaResolutionTimeHours || ''}
                  onChange={e => setFormData(p => ({ ...p, slaResolutionTimeHours: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Covered Assets Checkbox Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Link Physical Site Assets Protected Under This AMC
              </label>
              {assets.length === 0 ? (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-400 text-center">
                  No site assets found in register. You can link assets after adding equipment.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-xl">
                  {assets.map(asset => {
                    const identifier = asset.assetCode || asset.id;
                    const isSelected = (formData.coveredAssetIds || []).includes(identifier);
                    return (
                      <div 
                        key={asset.id}
                        onClick={() => toggleAsset(identifier)}
                        className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                          isSelected 
                            ? 'bg-primary/10 border-primary text-primary font-bold' 
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <span className="font-mono text-[10px] block opacity-75">{asset.assetCode}</span>
                          <span className="truncate block">{asset.name}</span>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <span className="text-[10px] text-gray-400 mt-1 block">
                Saving will automatically synchronize the AMC Vendor Name and Expiry Date on each selected asset in the Equipment Register.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Scope of Maintenance & Key Clauses</label>
              <textarea 
                rows={3}
                placeholder="Detail key responsibilities, preventive visit schedule, consumables coverage, and penalty clauses..."
                value={formData.scopeOfWork || ''}
                onChange={e => setFormData(p => ({ ...p, scopeOfWork: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRenewal ? 'Execute Renewal' : formData.id ? 'Save Updates' : 'Create Contract'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
