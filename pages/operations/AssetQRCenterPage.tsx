import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, Printer, Search, ExternalLink, Copy, Check, 
  FolderOpen, RefreshCw, ArrowLeft
} from 'lucide-react';
import { htAssetQrService, AssetQrTagData } from '../../services/htAssetQrService';
import { HTAssetQrPrintModal } from '../../components/ht-yard/HTAssetQrPrintModal';
import { supabase } from '../../services/supabase';
import { isOfflineEnabled } from '../../services/offline/featureFlag';
import { isOnline } from '../../services/offline/networkStatus';
import toast from 'react-hot-toast';

export const AssetQRCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedTagForPrint, setSelectedTagForPrint] = useState<AssetQrTagData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetQrTagData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAssets = async () => {
    setIsLoading(true);
    const loadedTags: AssetQrTagData[] = [];

    // 1. Fetch from Supabase
    if (!isOfflineEnabled() || isOnline()) {
      try {
        const { data: equipRows } = await supabase
          .from('ht_equipment_instances')
          .select(`
            id,
            instance_name,
            module_type,
            feeder_way_count,
            metadata,
            audit_id,
            ht_audits (
              site_name,
              audit_date,
              reference_number
            )
          `);

        if (equipRows && equipRows.length > 0) {
          equipRows.forEach((row: any) => {
            const meta = row.metadata || {};
            const parentAudit = row.ht_audits || {};
            const tag = htAssetQrService.buildAssetTagData(
              row.id,
              row.instance_name || `${row.module_type} Unit`,
              row.module_type,
              meta.manufacturer || 'OEM Standard',
              meta.modelNumber || `${row.module_type}-Model`,
              meta.ratedVoltage || '11 kV / 415 V',
              meta.capacity || '630 A',
              parentAudit.site_name || 'Substation Yard',
              meta.serialNumber || `SN-${row.id.substring(0, 8)}`,
              meta.mfgYear || 2024,
              1,
              parentAudit.auditDate || new Date().toISOString().split('T')[0]
            );
            loadedTags.push(tag);
          });
        }
      } catch (err) {
        console.warn('Failed to load assets from Supabase:', err);
      }
    }

    // 2. Fallback to local storage audits if Supabase empty or offline
    if (loadedTags.length === 0) {
      try {
        const raw = localStorage.getItem('ht_draft_audits_v1');
        if (raw) {
          const audits = JSON.parse(raw);
          audits.forEach((a: any) => {
            const siteName = a.activeAudit?.siteName || 'Substation Yard';
            const auditDate = a.activeAudit?.auditDate || new Date().toISOString().split('T')[0];
            const instances = a.equipmentInstances || [];
            instances.forEach((inst: any) => {
              const tag = htAssetQrService.buildAssetTagData(
                inst.id,
                inst.instanceName || (inst as any).name || 'HT Equipment Unit',
                inst.moduleType,
                inst.manufacturer || 'OEM Standard',
                inst.modelNumber || `${inst.moduleType}-Standard`,
                '11 kV / 415 V',
                '630 A / 500 kVA',
                siteName,
                inst.serialNumber,
                2024,
                1,
                auditDate
              );
              loadedTags.push(tag);
            });
          });
        }
      } catch (err) {
        console.warn('Asset fallback load warning:', err);
      }
    }

    setAssets(loadedTags);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const filteredAssets = assets.filter(a => {
    const matchesCat = categoryFilter === 'ALL' || a.category === categoryFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || 
      a.assetId.toLowerCase().includes(query) ||
      a.equipmentName.toLowerCase().includes(query) ||
      a.manufacturer.toLowerCase().includes(query) ||
      a.modelNumber.toLowerCase().includes(query) ||
      a.locationName.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  const handleCopyLink = (asset: AssetQrTagData) => {
    navigator.clipboard.writeText(asset.qrUrl);
    setCopiedId(asset.assetId);
    toast.success(`Public URL for ${asset.assetId} copied!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintSingle = (asset: AssetQrTagData) => {
    setSelectedTagForPrint(asset);
    setShowPrintModal(true);
  };

  const handlePrintAll = () => {
    if (filteredAssets.length === 0) return;
    setSelectedTagForPrint(filteredAssets[0]);
    setShowPrintModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <button
            type="button"
            onClick={() => navigate('/operations/ht-yard-audits')}
            className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Audits Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Asset QR Code Tagging & Digital Twin Center
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Production QR sticker printing, weatherproof asset tagging & live digital twin audit passport engine.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAssets}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Refresh from Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {filteredAssets.length > 0 && (
            <button
              type="button"
              onClick={handlePrintAll}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Batch Print ({filteredAssets.length} Tags)
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Asset ID, Model No, Manufacturer, or Site Location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'RMU', 'DG_SET', 'TRANSFORMER', 'HT_PANEL', 'LT_KIOSK'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'All Assets' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Asset QR Cards Grid / Empty State */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold">Loading equipment assets from Supabase...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 p-6">
          <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">No Audited Equipment Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Create an electrical site audit under <strong>Site Audit</strong> to generate physical equipment QR tags and passports.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAssets.map((asset) => {
            const isCopied = copiedId === asset.assetId;

            return (
              <div
                key={asset.assetId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        {asset.category.replace('_', ' ')}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1 leading-snug">
                        {asset.equipmentName}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                      {asset.ratedVoltage}
                    </span>
                  </div>

                  {/* QR Code & Technical Specs Row */}
                  <div className="flex items-center gap-3.5">
                    <div className="p-1.5 bg-white border border-slate-200 rounded-2xl shrink-0 shadow-xs">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(asset.qrUrl)}&margin=1`}
                        alt={`QR Code for ${asset.equipmentName}`}
                        className="w-20 h-20 object-contain"
                      />
                    </div>

                    <div className="flex-1 space-y-1 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Asset Tag ID</span>
                        <span className="font-mono font-extrabold text-slate-900 dark:text-white">{asset.assetId}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">MFR / OEM Model</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">{asset.manufacturer}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Rating / Capacity</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{asset.ratingCapacity}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Location</span>
                        <span className="font-medium text-slate-500 truncate block">{asset.locationName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(asset)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                    title="Copy public passport URL"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied' : 'Copy URL'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <a
                      href={asset.qrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl transition-colors"
                      title="Open public digital twin passport in browser"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handlePrintSingle(asset)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Tag
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Print Modal */}
      {selectedTagForPrint && (
        <HTAssetQrPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          assetTag={selectedTagForPrint}
          allAssetTags={filteredAssets}
        />
      )}
    </div>
  );
};

export default AssetQRCenterPage;
