import React, { useState } from 'react';
import { QrCode, Printer, Download, X, Copy, ExternalLink, Sparkles, Check, Layers, ShieldCheck, Tag } from 'lucide-react';
import { htAssetQrService, AssetQrTagData } from '../../services/htAssetQrService';
import toast from 'react-hot-toast';

interface HTAssetQrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetTag: AssetQrTagData;
  allAssetTags?: AssetQrTagData[];
}

export const HTAssetQrPrintModal: React.FC<HTAssetQrPrintModalProps> = ({
  isOpen,
  onClose,
  assetTag,
  allAssetTags = []
}) => {
  const [printLayout, setPrintLayout] = useState<'SINGLE' | 'A4_SHEET'>('SINGLE');
  const [tagSize, setTagSize] = useState<'MEDIUM' | 'LARGE'>('MEDIUM'); // Medium: 2x3", Large: 4x6"
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const itemsToPrint = printLayout === 'A4_SHEET' && allAssetTags.length > 0 ? allAssetTags : [assetTag];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(assetTag.qrUrl);
    setCopied(true);
    toast.success('Public Passport URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Asset QR Tag & Industrial Print Center
              </h2>
              <p className="text-xs text-slate-400">
                Generate high-density QR stickers for on-site physical equipment tagging
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Layout Format:</span>
            <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPrintLayout('SINGLE')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  printLayout === 'SINGLE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Single Asset Tag (2x3")
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('A4_SHEET')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  printLayout === 'A4_SHEET'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                A4 Multi-Sticker Sheet ({itemsToPrint.length} Tags)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Link' : 'Copy Passport URL'}
            </button>
            <a
              href={assetTag.qrUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Test Scan Preview
            </a>
          </div>
        </div>

        {/* Printable Area Container */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[50vh] overflow-y-auto flex justify-center">
          <div id="printable-asset-qr-section" className="w-full flex flex-wrap justify-center gap-4">
            {itemsToPrint.map((tag, idx) => (
              <div
                key={tag.assetId + '-' + idx}
                className="w-[340px] bg-white text-slate-900 p-4 rounded-2xl border-2 border-slate-800 shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden print:shadow-none print:border-2"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                {/* Top Company & Asset Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-800 pb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                        PARADIGM ELECTRICAL AUDIT
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight mt-0.5">
                      {tag.equipmentName}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-mono font-black">
                    {tag.ratedVoltage || '11 kV'}
                  </span>
                </div>

                {/* Body: QR Code + Technical Specifications */}
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white border border-slate-300 rounded-xl shrink-0 shadow-xs">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(tag.qrUrl)}&margin=1`}
                      alt={`QR Code for ${tag.equipmentName}`}
                      className="w-24 h-24 object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-1 text-[11px]">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500 block leading-none">Asset ID</span>
                      <span className="font-mono font-bold text-slate-900">{tag.assetId}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500 block leading-none">OEM Model / MFR</span>
                      <span className="font-bold text-slate-800">{tag.manufacturer}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500 block leading-none">Rating / Capacity</span>
                      <span className="font-extrabold text-emerald-700">{tag.ratingCapacity || '630 A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500 block leading-none">Location</span>
                      <span className="font-medium text-slate-600 truncate block">{tag.locationName}</span>
                    </div>
                  </div>
                </div>

                {/* Footer instructions */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600 font-bold">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Scan for Digital Twin
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">
                    Audits: {tag.auditCount || 1} • {tag.lastAuditDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-500" />
            Weatherproof PVC & Vinyl sticker format compatible
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print {printLayout === 'A4_SHEET' ? 'A4 Sticker Sheet' : 'Asset QR Tag'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
