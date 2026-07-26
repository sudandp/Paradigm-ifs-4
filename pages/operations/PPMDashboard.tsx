import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, FileText, Plus, Search, Filter, ShieldCheck, Zap, Droplet, Check, ChevronRight } from 'lucide-react';
import { PPMCategory } from '../../types/ppm';

// A mock dashboard for the PPM Module Phase 1
export const PPMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<PPMCategory>('ELECTRICAL_PANEL');
  
  const categories = [
    { id: 'ELECTRICAL_PANEL', step: 1, name: 'Electrical Panel', icon: <Zap className="w-4 h-4" />, count: 12 },
    { id: 'BOOSTER_PUMPS', step: 2, name: 'Booster Pumps', icon: <Settings className="w-4 h-4" />, count: 4 },
    { id: 'SP', step: 3, name: 'Swimming Pool & WB', icon: <Droplet className="w-4 h-4" />, count: 6 },
    { id: 'RO', step: 4, name: 'RO Plant', icon: <Droplet className="w-4 h-4" />, count: 9 },
    { id: 'STP', step: 5, name: 'STP', icon: <Droplet className="w-4 h-4" />, count: 15 },
    { id: 'HT_YARD', step: 6, name: 'HT Yard', icon: <ShieldCheck className="w-4 h-4" />, count: 5 },
    { id: 'GENERATOR', step: 7, name: 'Generator', icon: <Settings className="w-4 h-4" />, count: 8 },
    { id: 'WTP', step: 8, name: 'WTP', icon: <Droplet className="w-4 h-4" />, count: 2 }
  ];

  const activeIndex = categories.findIndex(c => c.id === activeCategory);
  const activeCategoryObj = categories[activeIndex] || categories[0];

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" /> Preventive Maintenance (PPM)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Technical Audit Compliance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage scheduled audits and track compliance across all facility systems.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => navigate(`/operations/ppm-audits/${activeCategory}`)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Start New Audit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Stepper Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 px-1">
              <div>
                <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Facility Stepper
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Step {activeIndex + 1} of {categories.length}</p>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {Math.round(((activeIndex + 1) / categories.length) * 100)}%
              </span>
            </div>

            {/* Stepper Vertical Track */}
            <div className="relative space-y-2">
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 z-0" />

              {categories.map((cat, index) => {
                const isActive = activeCategory === cat.id;
                const isPassed = index < activeIndex;
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as PPMCategory)}
                    className={`w-full relative z-10 flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all text-left group ${
                      isActive
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
                        : isPassed
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Step Badge Node */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-4 ring-emerald-100 dark:ring-emerald-950'
                          : isPassed
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}>
                        {isPassed ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <span>{cat.step}</span>
                        )}
                      </div>

                      {/* Step Name & Info */}
                      <div>
                        <div className={isActive ? 'font-black text-emerald-900 dark:text-emerald-100' : 'font-semibold'}>
                          {cat.name}
                        </div>
                        <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 block mt-0.5">
                          {cat.count} points
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isActive && <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeCategoryObj.name} audit runs...`}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button className="p-2 border border-slate-200/80 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-900/40">
                {activeCategoryObj.icon}
              </div>
              <div className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full mb-3">
                Step {activeCategoryObj.step} of 8 • {activeCategoryObj.count} Auditable Points
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No audits for {activeCategoryObj.name}</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                Start a new technical audit to begin inspecting the system and capturing observations.
              </p>
              <button 
                onClick={() => {
                  navigate(`/operations/ppm-audits/${activeCategory}`);
                }}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Start {activeCategoryObj.name} Audit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
