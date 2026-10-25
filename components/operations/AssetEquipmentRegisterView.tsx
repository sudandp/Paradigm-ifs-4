import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  Filter, 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Wrench, 
  Clock, 
  Calendar, 
  Printer, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Droplet, 
  Loader2,
  Trash2,
  X,
  History
} from 'lucide-react';
import type { OpsAsset, AssetCategory, AssetStatus } from '../../types/operations';
import { useOpsStore } from '../../store/opsStore';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toast from '../ui/Toast';
import { AssetPpmInspectionModal } from './AssetPpmInspectionModal';
import { AssetInspectionHistoryDrawer } from './AssetInspectionHistoryDrawer';

const CATEGORY_ICONS: Record<AssetCategory, any> = {
  STP: Droplet,
  GENERATOR: Zap,
  LIFT: Layers,
  BOOSTER_PUMPS: Droplet,
  WTP: Droplet,
  ELECTRICAL_PANEL: Zap,
  HT_YARD: Zap,
  FIRE_FIGHTING: AlertTriangle
};

const STATUS_BADGES: Record<AssetStatus, { bg: string; text: string }> = {
  'Operational': { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'Operational' },
  'Under Maintenance': { bg: 'bg-amber-100 text-amber-800 border-amber-200', text: 'Under Maintenance' },
  'Critical Fault': { bg: 'bg-red-100 text-red-800 border-red-200', text: 'Critical Fault' },
  'Decommissioned': { bg: 'bg-gray-100 text-gray-800 border-gray-200', text: 'Decommissioned' }
};

// Seed sample equipment if database is initially empty
const SAMPLE_ASSETS: Partial<OpsAsset>[] = [
  {
    assetCode: 'AST-STP-01',
    name: 'Main Sewage Treatment Plant (250 KLD)',
    category: 'STP',
    location: 'Basement 2 Utility Area',
    makeModel: 'Thermax MBBR 250',
    capacity: '250 KLD',
    amcVendorName: 'Thermax Water Technologies Ltd',
    amcExpiryDate: '2027-03-31',
    status: 'Operational',
    qrCodePayload: 'PARADIGM-ASSET:AST-STP-01:99102'
  },
  {
    assetCode: 'AST-DG-01',
    name: '1000 kVA Cummins Diesel Generator Set 1',
    category: 'GENERATOR',
    location: 'DG Room Block A',
    makeModel: 'Cummins QST30-G4 with Stamford Alternator',
    capacity: '1000 kVA / 800 kW',
    amcVendorName: 'Cummins India Comprehensive AMC',
    amcExpiryDate: '2027-05-15',
    status: 'Operational',
    qrCodePayload: 'PARADIGM-ASSET:AST-DG-01:88291'
  },
  {
    assetCode: 'AST-LFT-01',
    name: 'Tower B Passenger Elevator 1 (High-Speed)',
    category: 'LIFT',
    location: 'Tower B Ground to 24th Floor',
    makeModel: 'Johnson Lifts V3F Traction Gearless',
    capacity: '884 kg (13 Passengers)',
    amcVendorName: 'Johnson Lifts OEM Maintenance',
    amcExpiryDate: '2026-12-31',
    status: 'Operational',
    qrCodePayload: 'PARADIGM-ASSET:AST-LFT-01:77182'
  },
  {
    assetCode: 'AST-PMP-01',
    name: 'Hydro-Pneumatic Domestic Water Booster System',
    category: 'BOOSTER_PUMPS',
    location: 'Pump House Basement 1',
    makeModel: 'Grundfos Hydro Multi-E 3x CRE 15-3',
    capacity: '45 m³/h @ 5.5 bar',
    amcVendorName: 'Grundfos Pumps India Care',
    amcExpiryDate: '2027-04-10',
    status: 'Operational',
    qrCodePayload: 'PARADIGM-ASSET:AST-PMP-01:66543'
  }
];

export const AssetEquipmentRegisterView: React.FC<{ entityId?: string }> = ({ entityId }) => {
  const { assets, fetchAssets, createAsset, deleteAsset, isLoading } = useOpsStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'ALL'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeInspectionAsset, setActiveInspectionAsset] = useState<OpsAsset | null>(null);
  const [activeHistoryAsset, setActiveHistoryAsset] = useState<OpsAsset | null>(null);
  const [activeQrModalAsset, setActiveQrModalAsset] = useState<OpsAsset | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const getAmcBadge = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    const exp = new Date(expiryDate);
    const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
          AMC Expired
        </span>
      );
    } else if (days <= 30) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
          AMC Expiring ({days}d)
        </span>
      );
    }
    return null;
  };

  // Form state
  const [formData, setFormData] = useState<Partial<OpsAsset>>({
    assetCode: '',
    name: '',
    category: 'STP',
    location: '',
    makeModel: '',
    capacity: '',
    amcVendorName: '',
    status: 'Operational',
    entityId: entityId || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAssets(entityId);
  }, [entityId]);

  // If DB is empty, auto-seed sample residential assets
  useEffect(() => {
    if (!isLoading && assets.length === 0) {
      SAMPLE_ASSETS.forEach(async (a) => {
        try {
          await createAsset({ ...a, entityId });
        } catch (e) {
          console.warn('Sample asset seed skipped', e);
        }
      });
    }
  }, [isLoading, assets.length]);

  const filteredAssets = assets.filter(a => {
    const matchesCategory = selectedCategory === 'ALL' || a.category === selectedCategory;
    const matchesSearch = 
      a.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.makeModel && a.makeModel.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetCode || !formData.name || !formData.location) {
      setToast({ message: 'Asset Code, Name, and Location are required', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createAsset(formData);
      setToast({ message: 'Equipment registered with unique QR Tag payload', type: 'success' });
      setShowAddModal(false);
      setFormData({
        assetCode: '',
        name: '',
        category: 'STP',
        location: '',
        makeModel: '',
        capacity: '',
        amcVendorName: '',
        status: 'Operational',
        entityId: entityId || ''
      });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to register asset', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this equipment from the master register?')) return;
    try {
      await deleteAsset(id);
      setToast({ message: 'Asset removed from register', type: 'success' });
    } catch (err: any) {
      setToast({ message: 'Failed to delete asset', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            Asset Equipment Register & Preventive Maintenance (PPM)
          </h2>
          <p className="text-xs text-gray-500">
            Enterprise digital equipment tracking, physical QR code audit verification, and OEM operating ranges
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowAddModal(true)} variant="primary" className="gap-2 text-xs font-bold">
            <Plus className="w-4 h-4" /> Add Equipment
          </Button>
        </div>
      </div>

      {/* Toolbar & Category Filters */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by asset code, name, location, make/model..."
              className="w-full pl-9 pr-4 py-2 bg-page border border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'STP', 'GENERATOR', 'LIFT', 'BOOSTER_PUMPS', 'WTP', 'ELECTRICAL_PANEL'] as (AssetCategory | 'ALL')[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-page border border-border text-muted hover:text-primary-text'
                }`}
              >
                {cat === 'ALL' ? 'All Assets' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Equipment Cards Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl p-6 text-muted">
          <Layers className="w-12 h-12 text-border mx-auto mb-3" />
          <p className="font-bold text-gray-800">No Equipment Found</p>
          <p className="text-xs text-gray-500 mt-1">Add your society's STPs, DGs, Lifts, or Pumps to enable digital PPM.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredAssets.map((asset) => {
            const Icon = CATEGORY_ICONS[asset.category] || Layers;
            const badge = STATUS_BADGES[asset.status] || STATUS_BADGES['Operational'];

            return (
              <div 
                key={asset.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top line: Code, Category, Status */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-xs text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {asset.assetCode}
                        </span>
                        <span className="ml-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {asset.category.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getAmcBadge(asset.amcExpiryDate)}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                        {badge.text}
                      </span>
                    </div>
                  </div>

                  {/* Asset Name & Details */}
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{asset.name}</h3>
                    {asset.makeModel && (
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">{asset.makeModel}</p>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Location</span>
                      <span className="font-semibold text-gray-800">{asset.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Capacity</span>
                      <span className="font-semibold text-gray-800">{asset.capacity || 'Standard'}</span>
                    </div>
                    {asset.amcVendorName && (
                      <div className="col-span-2 pt-1 border-t border-gray-200/60 flex items-center justify-between">
                        <span>AMC: <span className="font-semibold text-gray-800">{asset.amcVendorName}</span></span>
                        {asset.amcExpiryDate && <span className="text-gray-400 text-[10px]">Exp: {asset.amcExpiryDate}</span>}
                      </div>
                    )}
                  </div>

                  {/* Last Inspected status */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Last PPM: {asset.lastInspectedAt ? new Date(asset.lastInspectedAt).toLocaleDateString('en-IN') : 'Pending Initial Audit'}
                    </span>
                    <button
                      onClick={() => setActiveQrModalAsset(asset)}
                      className="text-accent hover:underline font-bold flex items-center gap-1 text-[11px]"
                    >
                      <QrCode className="w-3 h-3" /> View Tag
                    </button>
                  </div>

                  {/* Active Work Order Linkage (PPM -> Helpdesk Trigger) */}
                  {asset.activeTicketNumber && (
                    <div className="p-2.5 bg-red-50/90 border border-red-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="font-bold text-red-900 text-[11px]">
                          Fault Work Order: {asset.activeTicketNumber}
                        </span>
                      </div>
                      <a
                        href={`/operations/tickets?search=${encodeURIComponent(asset.activeTicketNumber)}`}
                        className="text-[11px] font-bold text-red-700 hover:text-red-900 underline flex items-center gap-1"
                      >
                        Track Ticket <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => setActiveInspectionAsset(asset)}
                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PPM Check</span>
                  </button>

                  <button
                    onClick={() => setActiveHistoryAsset(asset)}
                    className="py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 shadow-2xs"
                    title="View 30-Day Inspection History & AMC"
                  >
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline text-[11px]">History</span>
                  </button>

                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
                    title="Delete Equipment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" /> Register Physical Equipment
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Asset Code *"
                  value={formData.assetCode}
                  onChange={(e) => setFormData(p => ({ ...p, assetCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AST-STP-02 or AST-DG-02"
                />

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">Asset Category *</label>
                  <select
                    className="form-input text-xs"
                    value={formData.category}
                    onChange={(e) => setFormData(p => ({ ...p, category: e.target.value as AssetCategory }))}
                  >
                    <option value="STP">Sewage Treatment Plant (STP)</option>
                    <option value="GENERATOR">Diesel Generator (DG Set)</option>
                    <option value="LIFT">Elevator / Passenger Lift</option>
                    <option value="BOOSTER_PUMPS">Booster / Hydro-Pneumatic Pumps</option>
                    <option value="WTP">Water Treatment Plant (WTP)</option>
                    <option value="ELECTRICAL_PANEL">Electrical HT/LT Panel</option>
                    <option value="FIRE_FIGHTING">Fire Fighting Hydrant System</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Equipment Name / Description *"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Tower C 13-Pax Passenger Elevator with ARD"
                  />
                </div>

                <Input
                  label="Physical Location *"
                  value={formData.location}
                  onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Basement 2 Utility Shaft"
                />

                <Input
                  label="Make & Model"
                  value={formData.makeModel || ''}
                  onChange={(e) => setFormData(p => ({ ...p, makeModel: e.target.value }))}
                  placeholder="e.g. Cummins QST30-G4"
                />

                <Input
                  label="Rated Capacity"
                  value={formData.capacity || ''}
                  onChange={(e) => setFormData(p => ({ ...p, capacity: e.target.value }))}
                  placeholder="e.g. 1000 kVA or 250 KLD"
                />

                <Input
                  label="AMC Vendor Name"
                  value={formData.amcVendorName || ''}
                  onChange={(e) => setFormData(p => ({ ...p, amcVendorName: e.target.value }))}
                  placeholder="e.g. Johnson Lifts India Pvt Ltd"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Register Equipment & Issue QR
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Tag Modal */}
      {activeQrModalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-center p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-xs font-bold uppercase text-gray-500">Official Equipment Tag</span>
              <button onClick={() => setActiveQrModalAsset(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-2 border-dashed border-gray-300 rounded-2xl space-y-3">
              <div className="w-40 h-40 bg-white border border-gray-200 rounded-xl mx-auto flex flex-col items-center justify-center p-2 shadow-inner">
                <QrCode className="w-28 h-28 text-slate-900" />
                <span className="text-[10px] font-mono font-bold text-gray-600 mt-1">{activeQrModalAsset.assetCode}</span>
              </div>
              <h4 className="font-bold text-sm text-gray-900">{activeQrModalAsset.name}</h4>
              <p className="text-xs text-gray-500">{activeQrModalAsset.location}</p>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-800 text-[11px] font-bold">
                Affix sticker physically onto machine frame
              </div>
            </div>

            <Button
              onClick={() => {
                window.print();
              }}
              variant="primary"
              className="w-full gap-2 text-xs font-bold"
            >
              <Printer className="w-4 h-4" /> Print Waterproof Asset Tag
            </Button>
          </div>
        </div>
      )}

      {/* Digital PPM Inspection Modal */}
      {activeInspectionAsset && (
        <AssetPpmInspectionModal
          asset={activeInspectionAsset}
          isOpen={!!activeInspectionAsset}
          onClose={() => setActiveInspectionAsset(null)}
          onSuccess={() => {
            setToast({ message: 'Digital PPM inspection submitted successfully!', type: 'success' });
            fetchAssets(entityId);
          }}
        />
      )}

      {/* 30-Day Asset Inspection History & AMC Drawer */}
      {activeHistoryAsset && (
        <AssetInspectionHistoryDrawer
          asset={activeHistoryAsset}
          isOpen={!!activeHistoryAsset}
          onClose={() => setActiveHistoryAsset(null)}
          onOpenNewInspection={() => {
            const target = activeHistoryAsset;
            setActiveHistoryAsset(null);
            setActiveInspectionAsset(target);
          }}
        />
      )}
    </div>
  );
};
