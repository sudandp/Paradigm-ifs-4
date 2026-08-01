import React, { useState, useEffect, useRef } from 'react';
import { Check, HelpCircle, Plus, Minus, Pencil, Layers, ArrowLeft } from 'lucide-react';
import { 
  PPMCategoryTemplate, 
  PPMSectionTemplate, 
  PPMCheckPointTemplate, 
  PPMCriterionTemplate, 
  PPMObservation, 
  PPMSeverity 
} from '../../types/ppm';
import { HTPhotoCaptureWidget } from '../ht-yard/HTPhotoCaptureWidget';

export interface CustomStage {
  key: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  isDone?: boolean;
}

interface PPMAuditFormEngineProps {
  template: PPMCategoryTemplate;
  sectionInstanceId?: string;
  observations: Record<string, PPMObservation>;
  onChangeObservation: (criterionId: string, updates: Partial<PPMObservation>) => void;
  onBack?: () => void;
  customStages?: CustomStage[];
}

export const PPMAuditFormEngine: React.FC<PPMAuditFormEngineProps> = ({
  template,
  sectionInstanceId = 'main',
  observations,
  onChangeObservation,
  onBack,
  customStages = []
}) => {
  const [activeSectionKey, setActiveSectionKey] = useState<string>(template.sections[0]?.id || '');
  
  // ─── Stage Duplication State ───────────────────────────────────────────────
  const [duplicatedStages, setDuplicatedStages] = useState<Record<string, { id: string; label: string }[]>>({});
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  // Dynamic sub-equipment instances: { [sectionId]: [{ id: string, name: string }] }
  const [instancesMap, setInstancesMap] = useState<Record<string, { id: string; name: string }[]>>(() => {
    const initial: Record<string, { id: string; name: string }[]> = {};
    template.sections.forEach(s => {
      if (s.repeatable && s.subEquipmentType) {
        initial[s.id] = [
          { id: `${s.id}-1`, name: `${s.subEquipmentType.name} #1` }
        ];
      }
    });
    return initial;
  });

  const [activeInstanceIdMap, setActiveInstanceIdMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    template.sections.forEach(s => {
      if (s.repeatable && s.subEquipmentType) {
        initial[s.id] = `${s.id}-1`;
      }
    });
    return initial;
  });

  useEffect(() => {
    if (template.sections.length > 0) {
      setActiveSectionKey(template.sections[0].id);
    } else if (customStages.length > 0) {
      setActiveSectionKey(customStages[0].key);
    }
    setDuplicatedStages({});
    setEditingTitleId(null);
  }, [template]);

  const handleDuplicateStage = (originalKey: string, originalTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = duplicatedStages[originalKey] || [];
    const newId = `dup_${originalKey}_${Date.now()}`;
    const newLabel = `${originalTitle} (Copy ${existing.length + 1})`;
    const updated = { ...duplicatedStages, [originalKey]: [...existing, { id: newId, label: newLabel }] };
    setDuplicatedStages(updated);
    setActiveSectionKey(newId);
    setEditingTitleId(newId);
    setEditingTitleValue(newLabel);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  const handleRemoveDuplicate = (originalKey: string, dupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = duplicatedStages[originalKey] || [];
    const updated = { ...duplicatedStages, [originalKey]: existing.filter(d => d.id !== dupId) };
    setDuplicatedStages(updated);
    if (activeSectionKey === dupId) setActiveSectionKey(originalKey);
    if (editingTitleId === dupId) setEditingTitleId(null);
  };

  const handleTitleChange = (newVal: string, originalKey: string, dupId: string) => {
    setEditingTitleValue(newVal);
    setDuplicatedStages(prev => ({
      ...prev,
      [originalKey]: (prev[originalKey] || []).map(d => d.id === dupId ? { ...d, label: newVal } : d)
    }));
  };

  const handleTitleBlur = () => {
    setDuplicatedStages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(origKey => {
        updated[origKey] = updated[origKey].map(d =>
          d.id === editingTitleId && !d.label.trim()
            ? { ...d, label: 'Untitled Stage' }
            : d
        );
      });
      return updated;
    });
    setEditingTitleId(null);
  };

  const addInstance = (sectionId: string, subName: string) => {
    setInstancesMap(prev => {
      const currentList = prev[sectionId] || [];
      const nextNum = currentList.length + 1;
      const newInst = { id: `${sectionId}-${Date.now()}`, name: `${subName} #${nextNum}` };
      const updated = [...currentList, newInst];
      setActiveInstanceIdMap(p => ({ ...p, [sectionId]: newInst.id }));
      return { ...prev, [sectionId]: updated };
    });
  };

  const getSectionProgress = (sectionId: string) => {
    const section = template.sections.find(s => s.id === sectionId);
    if (!section) return { completed: 0, total: 0, isDone: false };

    let total = 0;
    let completed = 0;

    if (section.repeatable && section.subEquipmentType) {
      const instances = instancesMap[sectionId] || [];
      const checkPoints = section.subEquipmentType.defaultCheckPoints;
      instances.forEach(inst => {
        checkPoints.forEach(cp => {
          cp.criteria.forEach(crit => {
            total++;
            const critKey = `${inst.id}:${crit.id}`;
            const obs = observations[critKey] || observations[crit.id];
            if (obs && obs.severity) {
              completed++;
            }
          });
        });
      });
    } else {
      section.checkPoints.forEach(cp => {
        cp.criteria.forEach(crit => {
          total++;
          const obs = observations[crit.id];
          if (obs && obs.severity) {
            completed++;
          }
        });
      });
    }

    return { completed, total, isDone: total > 0 && completed === total };
  };

  // Build flattened stage list with interleaved duplicates
  const allStages: Array<{
    key: string;
    title: string;
    type: 'template' | 'template_dup' | 'custom' | 'custom_dup';
    section?: typeof template.sections[0];
    content?: React.ReactNode;
    subtitle: string;
    isDone: boolean;
    originalKey?: string;
    isDuplicate?: boolean;
  }> = [];

  template.sections.forEach(s => {
    let count = 0;
    if (s.repeatable && s.subEquipmentType) {
      count = s.subEquipmentType.defaultCheckPoints.reduce((acc, cp) => acc + cp.criteria.length, 0);
    } else {
      count = s.checkPoints.reduce((acc, cp) => acc + cp.criteria.length, 0);
    }
    allStages.push({
      key: s.id,
      title: s.title,
      type: 'template',
      section: s,
      subtitle: `${count} checklist points`,
      isDone: getSectionProgress(s.id).isDone
    });
    (duplicatedStages[s.id] || []).forEach(dup => {
      allStages.push({
        key: dup.id,
        title: dup.label,
        type: 'template_dup',
        section: s,
        subtitle: `${count} checklist points (copy)`,
        isDone: false,
        originalKey: s.id,
        isDuplicate: true
      });
    });
  });

  customStages.forEach(cs => {
    allStages.push({
      key: cs.key,
      title: cs.title,
      type: 'custom',
      content: cs.content,
      subtitle: cs.subtitle || 'Custom stage',
      isDone: cs.isDone || false
    });
    (duplicatedStages[cs.key] || []).forEach(dup => {
      allStages.push({
        key: dup.id,
        title: dup.label,
        type: 'custom_dup',
        content: cs.content,
        subtitle: `${cs.subtitle || 'Custom stage'} (copy)`,
        isDone: false,
        originalKey: cs.key,
        isDuplicate: true
      });
    });
  });

  const activeStageIndex = allStages.findIndex(s => s.key === activeSectionKey);
  const activeStage = allStages[activeStageIndex];
  const activeSection = (activeStage?.type === 'template' || activeStage?.type === 'template_dup')
    ? activeStage.section ?? null
    : null;

  const handleNextSection = () => {
    if (activeStageIndex < allStages.length - 1) {
      setActiveSectionKey(allStages[activeStageIndex + 1].key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Collect active criteria list
  const getActiveCriteriaList = (): { crit: PPMCriterionTemplate; checkPointLabel: string; instancePrefix?: string }[] => {
    if (!activeSection) return [];

    if (activeSection.repeatable && activeSection.subEquipmentType) {
      const curInstId = activeInstanceIdMap[activeSection.id] || `${activeSection.id}-1`;
      const list: { crit: PPMCriterionTemplate; checkPointLabel: string; instancePrefix?: string }[] = [];
      activeSection.subEquipmentType.defaultCheckPoints.forEach(cp => {
        cp.criteria.forEach(crit => {
          list.push({ crit, checkPointLabel: cp.label, instancePrefix: curInstId });
        });
      });
      return list;
    } else {
      const list: { crit: PPMCriterionTemplate; checkPointLabel: string }[] = [];
      activeSection.checkPoints.forEach(cp => {
        cp.criteria.forEach(crit => {
          list.push({ crit, checkPointLabel: cp.label });
        });
      });
      return list;
    }
  };

  const activeCriteriaList = getActiveCriteriaList();
  const currentInstances = activeSection && activeSection.repeatable ? (instancesMap[activeSection.id] || []) : [];

  return (
    <div className="space-y-4">
      {/* Top Bar for Equipment Units / Instances */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shrink-0 mr-1"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {currentInstances.length > 0 ? (
            currentInstances.map(inst => (
              <button
                key={inst.id}
                onClick={() => setActiveInstanceIdMap(p => ({ ...p, [activeSection!.id]: inst.id }))}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeInstanceIdMap[activeSection!.id] === inst.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> {inst.name}
              </button>
            ))
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-200/60 dark:border-emerald-800">
              <Layers className="w-3.5 h-3.5 text-emerald-600" /> {template.name} System
            </div>
          )}
        </div>

        {/* Add Equipment Unit Button */}
        {activeSection?.repeatable && activeSection.subEquipmentType && (
          <button
            onClick={() => addInstance(activeSection.id, activeSection.subEquipmentType!.name)}
            className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ml-auto"
          >
            <Plus className="w-4 h-4" /> Add {activeSection.subEquipmentType.name}
          </button>
        )}
      </div>

      {/* Main Engine Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Left Sidebar Stepper */}
        <div className="w-full md:w-72 md:border-r border-b md:border-b-0 border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6 md:p-8 shrink-0">
          <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-8">
            {template.name} Checklist
          </h3>

          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-[15px] top-4 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700 hidden md:block" />

            <div className="space-y-4">
              {allStages.map((stage, idx) => {
                const isActive = stage.key === activeSectionKey;
                const isDone = stage.isDone;

                return (
                  <div key={stage.key} className="flex items-start gap-2 relative z-10 group">
                    <button
                      onClick={() => setActiveSectionKey(stage.key)}
                      className="flex items-start gap-3 flex-1 text-left min-w-0"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors mt-0.5 ${
                        isActive 
                          ? 'bg-emerald-600 border-emerald-600 text-white' 
                          : isDone 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/40 dark:border-emerald-500'
                            : stage.isDuplicate
                              ? 'bg-slate-100 border-dashed border-slate-400 text-slate-400 dark:bg-slate-800 dark:border-slate-600'
                              : 'bg-white border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-600'
                      }`}>
                        {isDone && !isActive ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                      </div>

                      <div className="flex flex-col pt-0.5 min-w-0">
                        <span className={`text-sm font-bold transition-colors truncate ${
                          isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}>
                          {stage.title}
                          {stage.isDuplicate && (
                            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">copy</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {stage.subtitle}
                        </span>
                      </div>
                    </button>

                    {/* Action buttons (+ for original, - for duplicate) */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      {!stage.isDuplicate && (
                        <button
                          onClick={e => handleDuplicateStage(stage.key, stage.title, e)}
                          className="w-5 h-5 rounded-full bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors"
                          title="Duplicate this stage"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}

                      {stage.isDuplicate && (
                        <button
                          onClick={e => handleRemoveDuplicate(stage.originalKey!, stage.key, e)}
                          className="w-5 h-5 rounded-full bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-800/60 text-rose-500 dark:text-rose-400 flex items-center justify-center transition-colors"
                          title="Remove duplicate stage"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
          {activeStage ? (
            <div className="p-6 md:p-8 flex-1 flex flex-col">
              {/* Header Title with inline edit for duplicates */}
              <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center gap-3">
                {activeStage.isDuplicate && editingTitleId === activeStage.key ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editingTitleValue}
                    onChange={e => handleTitleChange(e.target.value, activeStage.originalKey!, activeStage.key)}
                    onBlur={handleTitleBlur}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
                    }}
                    className="flex-1 text-xl font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide bg-transparent border-b-2 border-emerald-500 outline-none pb-0.5 min-w-0"
                  />
                ) : (
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex-1">
                    STAGE {activeStageIndex + 1}: {activeStage.title}
                  </h2>
                )}
                {activeStage.isDuplicate && editingTitleId !== activeStage.key && (
                  <button
                    onClick={() => {
                      setEditingTitleId(activeStage.key);
                      setEditingTitleValue(activeStage.title);
                      setTimeout(() => titleInputRef.current?.focus(), 30);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                    title="Rename stage"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(activeStage.type === 'template' || activeStage.type === 'template_dup') ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {activeCriteriaList.map(({ crit, checkPointLabel, instancePrefix }, itemIdx) => {
                    const baseObsKey = instancePrefix ? `${instancePrefix}:${crit.id}` : crit.id;
                    const obsKey = activeStage.isDuplicate ? `${activeStage.key}_${baseObsKey}` : baseObsKey;
                    const obs: Partial<PPMObservation> = observations[obsKey] || {};
                    const isNA = obs.severity === 'NA';

                    return (
                      <div 
                        key={obsKey} 
                        className="flex flex-col p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/20 shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow"
                      >
                        {/* Title & Mark N/A */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                            {itemIdx + 1}. {crit.label}
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium shrink-0 pt-0.5">
                            <input
                              type="checkbox"
                              checked={isNA}
                              onChange={(e) =>
                                onChangeObservation(obsKey, {
                                  severity: e.target.checked ? 'NA' : 'OK'
                                })
                              }
                              className="rounded text-emerald-600 focus:ring-emerald-500/20 w-3.5 h-3.5"
                            />
                            Mark N/A
                          </label>
                        </div>

                        {!isNA ? (
                          <div className="flex-1 flex flex-col space-y-4">
                            {/* Observation / Value Input */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                                Observation / Value
                              </span>
                              {crit.inputType === 'YES_NO' ? (
                                <select
                                  value={obs.value === true ? 'Yes' : obs.value === false ? 'No' : (obs.value as string || 'Yes')}
                                  onChange={(e) =>
                                    onChangeObservation(obsKey, {
                                      value: e.target.value === 'Yes' ? true : e.target.value === 'No' ? false : e.target.value
                                    })
                                  }
                                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                                >
                                  <option value="Yes">Yes / Compliant</option>
                                  <option value="No">No / Non-Compliant</option>
                                  <option value="Details Not Available">Details Not Available</option>
                                </select>
                              ) : crit.inputType === 'NUMBER' ? (
                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    placeholder="Enter observation / value..."
                                    value={obs.value as string || ''}
                                    onChange={(e) => onChangeObservation(obsKey, { value: e.target.value })}
                                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all pr-12"
                                  />
                                  {crit.unit && (
                                    <span className="absolute right-3 text-xs text-slate-400 font-bold">{crit.unit}</span>
                                  )}
                                </div>
                              ) : crit.inputType === 'DATE' ? (
                                <input
                                  type="date"
                                  value={obs.value as string || ''}
                                  onChange={(e) => onChangeObservation(obsKey, { value: e.target.value })}
                                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                                />
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Enter observation / value..."
                                  value={obs.value as string || ''}
                                  onChange={(e) => onChangeObservation(obsKey, { value: e.target.value })}
                                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                                />
                              )}
                            </div>

                            {/* Severity Selector */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                                Severity / Status
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(['OK', 'MINOR', 'MEDIUM', 'MAJOR', 'CRITICAL'] as PPMSeverity[]).map(sev => (
                                  <button
                                    key={sev}
                                    type="button"
                                    onClick={() => onChangeObservation(obsKey, { severity: sev })}
                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                      obs.severity === sev 
                                        ? sev === 'OK' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                          sev === 'CRITICAL' ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300' :
                                          sev === 'MAJOR' ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300' :
                                          sev === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300' :
                                          'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300'
                                        : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {sev}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Remarks */}
                            <div>
                              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                                Remarks
                              </span>
                              <input
                                type="text"
                                placeholder="Add specific remarks..."
                                value={obs.remarks || ''}
                                onChange={(e) => onChangeObservation(obsKey, { remarks: e.target.value })}
                                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                              />
                            </div>

                            {/* Photo */}
                            <div className="mt-auto pt-2">
                              <HTPhotoCaptureWidget
                                photos={obs.photoUrl ? [obs.photoUrl] : []}
                                onChange={(photos) => onChangeObservation(obsKey, { photoUrl: photos[0] || '' })}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 mt-2 bg-slate-100/60 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-slate-400" />
                            <span>Item marked Not Applicable.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (activeStage.type === 'custom' || activeStage.type === 'custom_dup') ? (
                <div className="w-full">
                  {activeStage.content}
                </div>
              ) : null}

              {/* Next Section Button */}
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
    </div>
  );
};
