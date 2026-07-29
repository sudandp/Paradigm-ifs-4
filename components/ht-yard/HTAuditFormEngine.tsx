import React, { useState, useEffect } from 'react';
import { CheckCircle2, HelpCircle, Check } from 'lucide-react';
import { ModuleSpec, HTAuditResponse } from '../../types/htYard';
import { htYardMasterDataService } from '../../services/htYardMasterDataService';
import { HTPhotoCaptureWidget } from './HTPhotoCaptureWidget.tsx';

export interface CustomStage {
  key: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  isDone?: boolean;
}

interface HTAuditFormEngineProps {
  spec: ModuleSpec;
  equipmentInstanceId?: string;
  selectedManufacturer?: string;
  responses: Record<string, HTAuditResponse>;
  onChangeResponse: (key: string, val: Partial<HTAuditResponse>) => void;
  customStages?: CustomStage[];
}

export const HTAuditFormEngine: React.FC<HTAuditFormEngineProps> = ({
  spec,
  equipmentInstanceId = 'site',
  selectedManufacturer,
  responses,
  onChangeResponse,
  customStages = []
}) => {
  const [activeSectionKey, setActiveSectionKey] = useState<string>(spec.sections[0]?.sectionKey || '');
  const [masterOptionsMap, setMasterOptionsMap] = useState<Record<string, any[]>>({});

  // When spec changes, reset active section
  useEffect(() => {
    if (spec.sections.length > 0) {
      setActiveSectionKey(spec.sections[0].sectionKey);
    } else if (customStages.length > 0) {
      setActiveSectionKey(customStages[0].key);
    }
  }, [spec.moduleType]);

  useEffect(() => {
    loadCategoryOptions();
  }, [spec, selectedManufacturer]);

  const loadCategoryOptions = async () => {
    const categoriesNeeded = new Set<string>();
    spec.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (f.optionsCategory) categoriesNeeded.add(f.optionsCategory);
      });
    });

    const map: Record<string, any[]> = {};
    for (const cat of Array.from(categoriesNeeded)) {
      try {
        const options = await htYardMasterDataService.getMasterOptions(
          cat as any,
          selectedManufacturer
        );
        map[cat] = options;
      } catch (e) {
        console.warn('Failed to load master options for', cat);
      }
    }
    setMasterOptionsMap(map);
  };

  const getSectionProgress = (sectionKey: string) => {
    const section = spec.sections.find(s => s.sectionKey === sectionKey);
    if (!section) return { completed: 0, total: 0, isDone: false };

    const total = section.fields.length;
    let completed = 0;
    section.fields.forEach(field => {
      const itemKey = `${equipmentInstanceId}_${section.sectionKey}_${field.key}`;
      const resp = responses[itemKey];
      if (resp && (resp.isNotApplicable || (resp.responseValue && resp.responseValue.trim() !== ''))) {
        completed++;
      }
    });
    return { completed, total, isDone: total > 0 && completed === total };
  };

  const allStages = [
    ...spec.sections.map(s => ({
      key: s.sectionKey,
      title: s.title,
      type: 'spec' as const,
      section: s,
      subtitle: `${s.fields.length} checklist points`,
      isDone: getSectionProgress(s.sectionKey).isDone
    })),
    ...customStages.map(cs => ({
      key: cs.key,
      title: cs.title,
      type: 'custom' as const,
      content: cs.content,
      subtitle: cs.subtitle || 'Custom stage',
      isDone: cs.isDone || false
    }))
  ];

  const activeStageIndex = allStages.findIndex(s => s.key === activeSectionKey);
  const activeStage = allStages[activeStageIndex];
  const activeSection = activeStage?.type === 'spec' ? activeStage.section : null;

  const handleNextSection = () => {
    if (activeStageIndex < allStages.length - 1) {
      setActiveSectionKey(allStages[activeStageIndex + 1].key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
      
      {/* Left Sidebar Stepper */}
      <div className="w-full md:w-72 md:border-r border-b md:border-b-0 border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 md:p-8 shrink-0">
        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-8">{spec.title}</h3>
        
        <div className="relative">
          {/* Vertical connecting line */}
          <div className="absolute left-[15px] top-4 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
          
          <div className="space-y-6">
            {allStages.map((stage, idx) => {
              const isActive = stage.key === activeSectionKey;
              const isDone = stage.isDone;
              
              return (
                <button
                  key={stage.key}
                  onClick={() => setActiveSectionKey(stage.key)}
                  className="flex items-start gap-4 w-full text-left relative z-10 group min-h-[4rem]"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                    isActive 
                      ? 'bg-emerald-600 border-emerald-600 text-white' 
                      : isDone 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/40 dark:border-emerald-500'
                        : 'bg-white border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-600'
                  }`}>
                    {isDone && !isActive ? <Check className="w-4 h-4" /> : <span className="text-sm font-bold">{idx + 1}</span>}
                  </div>
                  
                  <div className="flex flex-col pt-1">
                    <span className={`text-sm font-bold transition-colors ${
                      isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}>
                      {stage.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {stage.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
        {activeStage ? (
          <div className="p-6 md:p-8 flex-1 flex flex-col">
            <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                {activeStage.title}
              </h2>
            </div>

            {activeStage.type === 'spec' && activeSection ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeSection.fields.map((field, itemIdx) => {
                const itemKey = `${equipmentInstanceId}_${activeSection.sectionKey}_${field.key}`;
                const currentResponse = responses[itemKey] || {
                  moduleType: spec.moduleType,
                  sectionKey: activeSection.sectionKey,
                  itemNumber: itemIdx + 1,
                  fieldKey: field.key,
                  fieldLabel: field.label,
                  responseValue: '',
                  remarks: '',
                  photoUrls: [],
                  isNotApplicable: false
                };

                let optionsList: string[] = [];
                if (field.optionsCategory) {
                  const categoryOptions = masterOptionsMap[field.optionsCategory] || [];
                  const targetFieldKey = field.optionsFieldKey || (field.isManufacturerField ? 'mfr_name' : field.key);
                  const matching = categoryOptions.filter(o => o.fieldKey === targetFieldKey);
                  if (matching.length > 0) {
                    optionsList = matching.map(o => o.optionValue);
                  } else {
                    const fallback = categoryOptions.filter(o => !o.fieldKey || o.fieldKey === 'generic' || o.fieldKey === targetFieldKey);
                    optionsList = fallback.length > 0 ? fallback.map(o => o.optionValue) : categoryOptions.map(o => o.optionValue);
                  }
                }
                const cleanOptionsList = Array.from(
                  new Set(
                    optionsList.map(opt => (opt.trim().toLowerCase() === 'other' ? 'Other — Specify in Remarks' : opt))
                  )
                );

                return (
                  <div key={field.key} className="flex flex-col p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/20 shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                        {field.label}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium shrink-0 pt-0.5">
                        <input
                          type="checkbox"
                          checked={currentResponse.isNotApplicable || false}
                          onChange={(e) =>
                            onChangeResponse(itemKey, {
                              ...currentResponse,
                              isNotApplicable: e.target.checked
                            })
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500/20 w-3.5 h-3.5"
                        />
                        Mark N/A
                      </label>
                    </div>

                    {!currentResponse.isNotApplicable ? (
                      <div className="flex-1 flex flex-col space-y-4">
                        {/* Input Selector */}
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Observation / Value</span>
                          {field.type === 'boolean' ? (
                            <select
                              value={currentResponse.responseValue || 'Yes'}
                              onChange={(e) =>
                                onChangeResponse(itemKey, {
                                  ...currentResponse,
                                  responseValue: e.target.value
                                })
                              }
                              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                            >
                              <option value="Yes">Yes / Compliant</option>
                              <option value="No">No / Non-Compliant</option>
                              <option value="Details Not Available">Details Not Available</option>
                            </select>
                          ) : field.type === 'select' || field.type === 'searchable_select' || field.type === 'cascading_select' ? (
                            <select
                              value={currentResponse.responseValue || ''}
                              onChange={(e) =>
                                onChangeResponse(itemKey, {
                                  ...currentResponse,
                                  responseValue: e.target.value
                                })
                              }
                              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                            >
                              <option value="">Select option...</option>
                              {cleanOptionsList.map((opt, i) => (
                                <option key={i} value={opt}>
                                  {opt}
                                </option>
                              ))}
                              {!cleanOptionsList.some(opt => opt.toLowerCase().includes('other')) && (
                                <option value="Other — Specify in Remarks">Other — Specify in Remarks</option>
                              )}
                            </select>
                          ) : field.type === 'date' ? (
                            <input
                              type="date"
                              value={currentResponse.responseValue || ''}
                              onChange={(e) =>
                                onChangeResponse(itemKey, {
                                  ...currentResponse,
                                  responseValue: e.target.value
                                })
                              }
                              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="Enter observation / value..."
                              value={currentResponse.responseValue || ''}
                              onChange={(e) =>
                                onChangeResponse(itemKey, {
                                  ...currentResponse,
                                  responseValue: e.target.value
                                })
                              }
                              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                            />
                          )}
                        </div>

                        {/* Remarks */}
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Remarks</span>
                          <input
                            type="text"
                            placeholder="Add specific remarks..."
                            value={currentResponse.remarks || ''}
                            onChange={(e) =>
                              onChangeResponse(itemKey, {
                                ...currentResponse,
                                remarks: e.target.value
                              })
                            }
                            className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                          />
                        </div>

                        {/* Photo */}
                        <div className="mt-auto pt-2">
                          <HTPhotoCaptureWidget
                            photos={currentResponse.photoUrls || []}
                            onChange={(photos) =>
                              onChangeResponse(itemKey, {
                                ...currentResponse,
                                photoUrls: photos
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 mt-2 bg-slate-100/60 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-slate-400" />
                        <span>Item marked Not Applicable for this equipment instance.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            ) : activeStage.type === 'custom' ? (
              <div className="w-full">
                {activeStage.content}
              </div>
            ) : null}

            {/* Next Button / Footer */}
            {activeStageIndex < allStages.length - 1 && (
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={handleNextSection}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all"
                >
                  Next Section
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 flex items-center justify-center flex-1 text-slate-400">
            Select a section to begin
          </div>
        )}
      </div>
    </div>
  );
};
