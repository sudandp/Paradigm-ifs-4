import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Zap, 
  Cpu, 
  ShieldCheck, 
  ChevronDown, 
  Check, 
  HardDrive, 
  Cloud, 
  WifiOff, 
  Sliders
} from 'lucide-react';
import { useAssistStore, AIModelEngine } from '../../store/assistStore';

interface ModelSelectorPillProps {
  onOpenOfflineModal?: () => void;
  className?: string;
}

export const ModelSelectorPill: React.FC<ModelSelectorPillProps> = ({
  onOpenOfflineModal,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    selectedModelEngine,
    setSelectedModelEngine,
    isOfflineModelReady,
    isModelDownloading,
    modelDownloadProgress
  } = useAssistStore();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const models: Array<{
    id: AIModelEngine;
    title: string;
    badge: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    tagColor: string;
  }> = [
    {
      id: 'auto-hybrid',
      title: 'Auto Hybrid Mode',
      badge: 'Smart Auto',
      description: 'Cloud primary; seamlessly switches to on-device neural engine when in basements or offline.',
      icon: Sparkles,
      accentColor: 'text-emerald-500',
      tagColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
    },
    {
      id: 'cloud-groq',
      title: 'Paradigm Cloud AI (Groq Fast)',
      badge: 'Cloud High-Speed',
      description: 'Ultra-low latency cloud copilot (sub-second responses) with verified operational knowledge.',
      icon: Zap,
      accentColor: 'text-amber-500',
      tagColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
    },
    {
      id: 'cloud-gemini',
      title: 'Paradigm Cloud AI (Gemini Pro)',
      badge: 'Google Gemini',
      description: 'Google Gemini cloud intelligence with multi-turn analytical reasoning.',
      icon: Cpu,
      accentColor: 'text-blue-500',
      tagColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800'
    },
    {
      id: 'local-model',
      title: 'Paradigm Local Model AI (Field)',
      badge: '100% On-Device',
      description: 'Runs on WebGPU inside device browser. Zero internet needed, 100% private in pump rooms & basements.',
      icon: ShieldCheck,
      accentColor: 'text-purple-500',
      tagColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800'
    }
  ];

  const currentModel = models.find(m => m.id === selectedModelEngine) || models[0];
  const CurrentIcon = currentModel.icon;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Selector Trigger Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 transition-all text-xs font-semibold shadow-xs"
        title="Select AI Model: Paradigm Cloud (Groq / Gemini) or Local On-Device AI"
      >
        <CurrentIcon className={`w-3.5 h-3.5 ${currentModel.accentColor}`} />
        <span className="hidden md:inline max-w-[130px] truncate text-[11px]">
          {currentModel.title.replace('Paradigm ', '')}
        </span>
        <span className="md:hidden text-[11px]">
          {currentModel.id === 'auto-hybrid'
            ? 'Hybrid'
            : currentModel.id === 'cloud-groq'
            ? 'Groq'
            : currentModel.id === 'cloud-gemini'
            ? 'Gemini'
            : 'Local AI'}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Upward/Downward Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-500" />
              Select AI Engine
            </span>
            <span className="text-[10px] text-slate-400">
              {isOfflineModelReady ? '✓ Local Cached' : 'Cloud Ready'}
            </span>
          </div>

          {/* Model Options List */}
          <div className="p-1.5 space-y-1">
            {models.map(m => {
              const Icon = m.icon;
              const isSelected = selectedModelEngine === m.id;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedModelEngine(m.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-500/40 text-slate-900 dark:text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 ${m.accentColor} mt-0.5 flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-xs truncate">
                        {m.title}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${m.tagColor} flex-shrink-0`}>
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                      {m.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="flex-shrink-0 mt-1">
                      <Check className="w-4 h-4 text-emerald-500 font-bold" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Footer Action */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              {isOfflineModelReady ? 'Offline Brain: Active' : 'Offline Brain: Not installed'}
            </span>
            {onOpenOfflineModal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenOfflineModal();
                }}
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Configure Offline
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
