import React from 'react';
import { 
  X, 
  FileText, 
  Building2, 
  Calendar, 
  IndianRupee, 
  ExternalLink, 
  Phone, 
  Mail, 
  User, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCw,
  FileCheck,
  ShieldAlert
} from 'lucide-react';
import type { OpsContract, ContractStatus } from '../../types/operations';
import Button from '../ui/Button';

interface ContractDrawerProps {
  contract: OpsContract | null;
  isOpen: boolean;
  onClose: () => void;
  onRenew: (contract: OpsContract) => void;
}

const STATUS_BADGE_STYLES: Record<ContractStatus, { bg: string; text: string; border: string }> = {
  'Active': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Expiring Soon': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  'Expired': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  'Renewed': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Terminated': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
};

export const ContractDrawer: React.FC<ContractDrawerProps> = ({
  contract,
  isOpen,
  onClose,
  onRenew
}) => {
  if (!isOpen || !contract) return null;

  const today = new Date();
  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);
  const totalDurationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDurationDays) * 100)));

  const badgeStyle = STATUS_BADGE_STYLES[contract.status] || STATUS_BADGE_STYLES['Active'];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in">
      <div 
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between border-l border-gray-200 animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-start justify-between">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                {contract.contractType}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                {contract.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">
              {contract.contractTitle}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <span>{contract.entityName || 'Unassigned Society'}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Validity Timeline Card */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-bold text-gray-700">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Agreement Validity Lifespan</span>
              </div>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                remainingDays < 0 
                  ? 'bg-red-100 text-red-700' 
                  : remainingDays <= contract.renewalReminderDays 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {remainingDays < 0 
                  ? `Expired ${Math.abs(remainingDays)}d ago` 
                  : `${remainingDays} days remaining`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  remainingDays < 0 ? 'bg-red-500' : remainingDays <= contract.renewalReminderDays ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
              <span>Start: <strong>{new Date(contract.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
              <span>End: <strong>{new Date(contract.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
            </div>
          </div>

          {/* Financials & Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-gray-100 bg-white shadow-sm">
              <span className="text-[11px] font-semibold text-gray-400 block mb-1">Total Agreement Value</span>
              <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                <IndianRupee className="w-4 h-4 text-gray-500" />
                <span>{(contract.contractValue || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-gray-100 bg-white shadow-sm">
              <span className="text-[11px] font-semibold text-gray-400 block mb-1">Billing Frequency</span>
              <div className="text-sm font-bold text-gray-800">
                {contract.paymentFrequency || 'Quarterly'}
              </div>
            </div>
          </div>

          {/* Vendor & Emergency Escalation */}
          {contract.vendorName && (
            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Vendor Particulars & Support Desk
              </h4>
              <div className="space-y-2">
                <div className="text-sm font-bold text-gray-900">{contract.vendorName}</div>
                {contract.vendorContactPerson && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>POC: {contract.vendorContactPerson}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {contract.vendorPhone && (
                    <a 
                      href={`tel:${contract.vendorPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{contract.vendorPhone}</span>
                    </a>
                  )}
                  {contract.vendorEmail && (
                    <a 
                      href={`mailto:${contract.vendorEmail}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{contract.vendorEmail}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SLA Terms & Guarantee */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" /> Service Level Commitments (SLA)
            </h4>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <span className="text-gray-400 block text-[10px]">Response Time</span>
                <span className="font-bold text-gray-800">{contract.slaResponseTimeHours || 4} Hours</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <span className="text-gray-400 block text-[10px]">Resolution Time</span>
                <span className="font-bold text-gray-800">{contract.slaResolutionTimeHours || 24} Hours</span>
              </div>
            </div>
          </div>

          {/* Covered Physical Assets */}
          {contract.coveredAssetIds && contract.coveredAssetIds.length > 0 && (
            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Covered Site Assets ({contract.coveredAssetIds.length})
              </h4>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {contract.coveredAssetIds.map((assetId, idx) => (
                  <span 
                    key={idx} 
                    className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 font-mono text-[11px] font-bold border border-gray-200"
                  >
                    {assetId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scope of Work */}
          {contract.scopeOfWork && (
            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Scope of Work & Maintenance Terms</h4>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                {contract.scopeOfWork}
              </p>
            </div>
          )}

          {/* Agreement Document Vault */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-primary" /> Signed Agreement Document
            </h4>
            {contract.documentUrl ? (
              <a 
                href={contract.documentUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center justify-between w-full p-3 rounded-lg bg-white border border-gray-200 text-xs font-bold text-primary hover:bg-primary/5 transition"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>View Signed Contract PDF</span>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            ) : (
              <div className="p-3 bg-white rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-400">
                No signed agreement PDF uploaded yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onClose} className="text-xs">
            Close
          </Button>
          <div className="flex items-center gap-2">
            {(contract.status === 'Expiring Soon' || contract.status === 'Expired' || contract.status === 'Active') && (
              <Button 
                variant="primary" 
                onClick={() => onRenew(contract)}
                className="gap-1.5 text-xs font-bold"
              >
                <RotateCw className="w-3.5 h-3.5" /> Renew Agreement
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
