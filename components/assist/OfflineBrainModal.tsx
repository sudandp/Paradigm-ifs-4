import React, { useState, useEffect } from 'react';
import { X, Zap, HardDrive, ShieldCheck, CheckCircle2, Download, Trash2, Cpu, AlertCircle, WifiOff } from 'lucide-react';
import { useAssistStore } from '../../store/assistStore';
import { offlineAIService } from '../../services/offlineAiService';
import toast from 'react-hot-toast';

interface OfflineBrainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineBrainModal: React.FC<OfflineBrainModalProps> = ({ isOpen, onClose }) => {
  const {
    isOfflineModelReady,
    isModelDownloading,
    modelDownloadProgress,
    modelStatusText,
    downloadOfflineModel,
    clearOfflineCache,
    useLocalEngineFirst,
    setUseLocalEngineFirst
  } = useAssistStore();

  const [gpuStatus, setGpuStatus] = useState<{ supported: boolean; reason?: string }>({ supported: true });
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      offlineAIService.checkWebGPUSupport().then(setGpuStatus);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    try {
      toast.loading('Initializing on-device engine download...', { id: 'model-dl' });
      await downloadOfflineModel();
      toast.success('On-device engine downloaded & cached permanently!', { id: 'model-dl' });
    } catch (err: any) {
      toast.error(`Download failed: ${err.message || 'Please try again'}`, { id: 'model-dl' });
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Are you sure you want to delete the cached offline model? You will need to re-download it to use offline mode.')) {
      return;
    }
    setIsClearing(true);
    try {
      await clearOfflineCache();
      toast.success('Offline cache cleared successfully.');
    } catch {
      toast.error('Failed to clear cache');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Offline AI Engine (Field Mode)
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  On-Device Neural Engine
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                100% on-device AI copilot for basements and remote field sites
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Feature Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 mb-1">
                <WifiOff className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Zero Internet Needed
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Works in DG basements, pump rooms, and lift shafts without signal.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                100% Device Privacy
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Inference runs on WebGPU inside your browser. No queries leave your device.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 mb-1">
                <Cpu className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Hardware Acceleration
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {gpuStatus.supported ? 'WebGPU Active (High Speed)' : 'CPU / Wasm Fallback'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Storage Footprint
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ~1.1 GB (Permanent IndexedDB storage with persistence lock).
              </p>
            </div>
          </div>

          {/* Current State Display */}
          {isOfflineModelReady ? (
            <>
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Offline Brain is Installed & Active
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Your on-device neural engine is cached and ready to assist you offline.
                  </p>
                </div>
              </div>

              {/* Engine Priority Mode Switcher */}
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{useLocalEngineFirst ? 'On-Device Engine is Primary' : 'Auto Hybrid Mode'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {useLocalEngineFirst
                      ? 'All chats and queries execute 100% on this device.'
                      : 'Cloud AI primary; auto-switches to on-device engine when offline.'}
                  </div>
                </div>
                <button
                  onClick={() => setUseLocalEngineFirst(!useLocalEngineFirst)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
                    useLocalEngineFirst
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {useLocalEngineFirst ? 'Local Active' : 'Switch to Local'}
                </button>
              </div>
            </>
          ) : isModelDownloading ? (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-600 animate-bounce" />
                  Downloading On-Device Engine Weights...
                </span>
                <span>{modelDownloadProgress}%</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2.5 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${modelDownloadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 truncate">
                {modelStatusText || 'Fetching model shards from CDN...'}
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <AlertCircle className="w-4 h-4 text-slate-500" />
                <span>One-time download requires Wi-Fi or 5G connection (~1.1 GB).</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Once downloaded, no further internet traffic will ever be consumed for offline queries.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          {isOfflineModelReady ? (
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Local Model Cache</span>
            </button>
          ) : (
            <div className="text-xs text-slate-500">
              WebGPU Ready
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>
            {!isOfflineModelReady && !isModelDownloading && (
              <button
                onClick={handleStartDownload}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Offline Brain (1.1 GB)</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default OfflineBrainModal;
