import React, { useState } from 'react';
import { 
  Droplets, 
  Filter, 
  Trash2, 
  Layers, 
  Activity, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Download, 
  Maximize2, 
  Minimize2, 
  Info,
  Wind,
  Flame,
  Truck
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface IndustrialProcessSchematicProps {
  title?: string;
  onSaveImage?: () => void;
}

export const IndustrialProcessSchematic: React.FC<IndustrialProcessSchematicProps> = ({
  title = 'Wastewater Treatment Plant (WWTP / STP) Process Flowsheet',
  onSaveImage
}) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [selectedStage, setSelectedStage] = useState<number | string>(1);
  const [activeTab, setActiveTab] = useState<'water' | 'sludge' | 'all'>('all');

  // Stages definition matching professional WWTP standards (Images 2, 3, 4, 5)
  const waterStages = [
    {
      id: 1,
      code: '01',
      title: 'Inlet & Pumping',
      subtitle: 'Raw Sewage Intake',
      icon: Droplets,
      color: 'blue',
      badge: 'Collection',
      desc: 'Wastewater arrives via gravity collectors; high-capacity submersible pumps lift raw sewage to headworks.',
      specs: 'Flow: Continuous | Screen sizing: Raw'
    },
    {
      id: 2,
      code: '02',
      title: 'Bar Screening',
      subtitle: 'Coarse & Fine Screens',
      icon: Filter,
      color: 'amber',
      badge: 'Pre-Treatment',
      desc: 'Mechanical bar screens and rotary sieves retain large floating debris, plastics, rags, and coarse solids to protect pumps.',
      specs: 'Clear spacing: 10-25mm | Manual/Mechanical rake'
    },
    {
      id: 3,
      code: '03',
      title: 'Grit & Grease Removal',
      subtitle: 'Vortex / Aerated Grit Chamber',
      icon: Trash2,
      color: 'amber',
      badge: 'Pre-Treatment',
      desc: 'Heavy inorganic particles (sand, gravel, silt) settle by gravity while floating oils, fats, and grease (FOG) are skimmed.',
      specs: 'Specific gravity > 2.65 | Prevents pipe abrasion'
    },
    {
      id: 4,
      code: '04',
      title: 'Primary Sedimentation',
      subtitle: 'Primary Clarifier (PST)',
      icon: Layers,
      color: 'emerald',
      badge: 'Primary Stage',
      desc: 'Quiescent settling allows 50-70% of suspended solids to sink as Primary Raw Sludge. Surface scum skimmer removes floating oils.',
      specs: 'Retention: 2-3 hrs | Sludge draw-off to Thickener'
    },
    {
      id: 5,
      code: '05',
      title: 'Biological Aeration',
      subtitle: 'Aerobic Reactor (ASP / MBBR)',
      icon: Wind,
      color: 'cyan',
      badge: 'Secondary Stage',
      desc: 'Active aerobic microbial cultures consume dissolved organic pollutants (BOD & COD). Fine-bubble diffusers supply continuous oxygen.',
      specs: 'DO Level: 2.0 - 4.0 mg/L | MLSS: 2500 - 3500 mg/L'
    },
    {
      id: 6,
      code: '06',
      title: 'Secondary Clarifier',
      subtitle: 'Final Settling Tank (SST)',
      icon: Activity,
      color: 'emerald',
      badge: 'Secondary Stage',
      desc: 'Separates clarified effluent from biological activated sludge (biomass). Sludge is recirculated (RAS) or wasted (WAS).',
      specs: 'RAS Return: 50-100% | Overflow: Clear supernatant'
    },
    {
      id: 7,
      code: '07',
      title: 'Tertiary Filtration',
      subtitle: 'Dual Media (Sand & Carbon)',
      icon: Filter,
      color: 'indigo',
      badge: 'Tertiary Stage',
      desc: 'Multi-grade pressure sand filter removes residual suspended micro-particles; activated carbon filter eliminates color, odor, and organics.',
      specs: 'PSF + ACF Pressure Filters | Turbidity < 2 NTU'
    },
    {
      id: 8,
      code: '08',
      title: 'Disinfection',
      subtitle: 'Chlorination / UV / Ozone',
      icon: ShieldCheck,
      color: 'purple',
      badge: 'Disinfection',
      desc: 'Sodium hypochlorite dosing or inline UV reactors inactivate coliforms, enteric viruses, and pathogenic microorganisms.',
      specs: 'Contact Time: 20-30 min | Residual Cl2: 0.5 - 1.0 ppm'
    },
    {
      id: 9,
      code: '09',
      title: 'Treated Effluent',
      subtitle: 'Storage & Green Reuse',
      icon: CheckCircle2,
      color: 'emerald',
      badge: 'Final Outlet',
      desc: 'High-purity recycled water transferred to designated flushing tanks, automated landscape irrigation, and HVAC cooling towers.',
      specs: 'BOD < 10 mg/L | COD < 50 mg/L | TSS < 10 mg/L'
    }
  ];

  const sludgeStages = [
    {
      id: 'S1',
      code: 'A',
      title: 'Sludge Thickening',
      subtitle: 'Gravity Thickener',
      icon: Layers,
      color: 'amber',
      badge: 'Sludge Line',
      desc: 'Concentrates settled primary sludge and excess activated sludge (WAS), increasing solids concentration from 1% to 4-6%.',
      specs: 'Gravity rake | Supernatant returned to Inlet'
    },
    {
      id: 'S2',
      code: 'B',
      title: 'Digestion / Stabilization',
      subtitle: 'Anaerobic / Aerobic Digester',
      icon: Flame,
      color: 'orange',
      badge: 'Sludge Line',
      desc: 'Biological decomposition of volatile organics stabilizes sludge, eliminates offensive odors, and produces biogas / methane.',
      specs: 'Odor reduction > 90% | Volatile solids destruction'
    },
    {
      id: 'S3',
      code: 'C',
      title: 'Dewatering Press',
      subtitle: 'Filter Press / Centrifuge',
      icon: Filter,
      color: 'amber',
      badge: 'Sludge Line',
      desc: 'Mechanical dehydration with polyelectrolyte dosing squeezes water out, producing firm, transportable sludge cakes.',
      specs: 'Filter press / Screw press | Dry solids: 20-25%'
    },
    {
      id: 'S4',
      code: 'D',
      title: 'Dry Sludge Disposal',
      subtitle: 'Compost / Safe Disposal',
      icon: Truck,
      color: 'stone',
      badge: 'Biosolids',
      desc: 'Nutrient-rich dried cake dispatched for agricultural landscaping compost, organic fertilizer, or certified disposal.',
      specs: 'Pathogen-free biosolid cakes | CPCB/SPCB compliant'
    }
  ];

  const currentStageInfo = [...waterStages, ...sludgeStages].find(s => s.id === selectedStage) || waterStages[0];

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-950/90 rounded-2xl border border-emerald-500/20 shadow-inner overflow-hidden text-slate-800 dark:text-slate-100">
      {/* Subheader Title */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
            Engineering Flowsheet: 3-Stage Wastewater Treatment (WWTP / STP)
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            CPCB / ISO 9001 Standard
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            All Streams
          </button>
          <button
            onClick={() => setActiveTab('water')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              activeTab === 'water'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Liquid Stream (1-9)
          </button>
          <button
            onClick={() => setActiveTab('sludge')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              activeTab === 'sludge'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Sludge Line (A-D)
          </button>
        </div>
      </div>

      {/* Main Flow Grid: Horizontal Process Pipeline */}
      <div className="p-4 md:p-5 space-y-5 overflow-x-auto">
        {/* Stream 1: Main Water Stream */}
        {(activeTab === 'all' || activeTab === 'water') && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                Main Water Stream (Liquid Line)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Influent Sewage → Physical → Biological → Tertiary → Disinfection → Recycled Reuse
              </span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
              {waterStages.map((stage, idx) => {
                const IconComponent = stage.icon;
                const isSelected = selectedStage === stage.id;
                return (
                  <div
                    key={stage.id}
                    onClick={() => setSelectedStage(stage.id)}
                    className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[110px] ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs'
                    }`}
                  >
                    {/* Top stage number and icon */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-mono font-bold text-[10px] flex items-center justify-center">
                        {stage.code}
                      </span>
                      <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                    </div>

                    {/* Stage title */}
                    <div>
                      <div className="font-bold text-[11px] leading-tight text-slate-900 dark:text-slate-100 line-clamp-2">
                        {stage.title}
                      </div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {stage.subtitle}
                      </div>
                    </div>

                    {/* Connecting Chevron on right (if not last) */}
                    {idx < waterStages.length - 1 && (
                      <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-emerald-400/80">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stream 2: Sludge Handling Stream */}
        {(activeTab === 'all' || activeTab === 'sludge') && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                Sludge & Solids Handling Line
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Clarifier Underflow (PST + WAS) → Thickener → Digester → Dewatering Press → Dried Cake
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {sludgeStages.map((stage, idx) => {
                const IconComponent = stage.icon;
                const isSelected = selectedStage === stage.id;
                return (
                  <div
                    key={stage.id}
                    onClick={() => setSelectedStage(stage.id)}
                    className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[95px] ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="w-5 h-5 rounded-md bg-amber-600 text-white font-mono font-bold text-[10px] flex items-center justify-center">
                        {stage.code}
                      </span>
                      <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-500' : 'text-slate-400'}`} />
                    </div>

                    <div>
                      <div className="font-bold text-[11px] leading-tight text-slate-900 dark:text-slate-100">
                        {stage.title}
                      </div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {stage.subtitle}
                      </div>
                    </div>

                    {idx < sludgeStages.length - 1 && (
                      <div className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-amber-500">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Stage Detail Panel */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                Stage {currentStageInfo.code}: {currentStageInfo.title}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {currentStageInfo.badge}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11.5px] leading-relaxed">
              {currentStageInfo.desc}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-mono text-[10.5px]">
              {currentStageInfo.specs}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
