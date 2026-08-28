import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, HelpCircle, Check, Plus, Minus, Pencil, X, Calendar, 
  Image, Hash, AlignLeft, MapPin, Sparkles, Clock, ExternalLink, 
  Activity, Cpu, Layers, ShieldCheck, Sliders, RefreshCw, AlertTriangle,
  Trash2, Settings2, Tag
} from 'lucide-react';
import { ModuleSpec, HTAuditResponse } from '../../types/htYard';
import { htYardMasterDataService } from '../../services/htYardMasterDataService';
import { htYardFieldSpecService } from '../../services/htYardFieldSpecService';
import { htEquipmentCatalogService, EquipmentCatalogItem } from '../../services/htEquipmentCatalogService';
import { reverseGeocode } from '../../utils/locationUtils';
import { Geolocation } from '@capacitor/geolocation';
import { HTPhotoCaptureWidget } from './HTPhotoCaptureWidget.tsx';
import toast from 'react-hot-toast';

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
  onLogAction?: (entry: { actionType: 'CREATE' | 'EDIT' | 'DELETE' | 'DUPLICATE' | 'SAVE'; target: string; details: string }) => void;
  duplicatedStages?: Record<string, { id: string; label: string }[]>;
  onDuplicatedStagesChange?: (stages: Record<string, { id: string; label: string }[]>) => void;
}

export const HTAuditFormEngine: React.FC<HTAuditFormEngineProps> = ({
  spec,
  equipmentInstanceId = 'site',
  selectedManufacturer,
  responses,
  onChangeResponse,
  customStages = [],
  onLogAction,
  duplicatedStages: propsDuplicatedStages,
  onDuplicatedStagesChange
}) => {
  const [activeSpecState, setActiveSpecState] = useState<ModuleSpec>(spec);
  const [activeSectionKey, setActiveSectionKey] = useState<string>(spec.sections[0]?.sectionKey || '');
  const [masterOptionsMap, setMasterOptionsMap] = useState<Record<string, any[]>>({});
  
  // Smart GPS & Catalog States
  const [fetchingGpsKey, setFetchingGpsKey] = useState<string | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('ALL');

  // Dynamic stage duplication state
  const [duplicatedStages, setDuplicatedStages] = useState<Record<string, { id: string; label: string }[]>>(
    propsDuplicatedStages || {}
  );
  // editingTitleId: the duplicate stage currently being renamed in the RIGHT PANEL header
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Field Editing Modal State
  const [editingField, setEditingField] = useState<{
    sectionKey: string;
    sectionTitle: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
    unit: string;
    placeholder: string;
    optionsCategory?: string;
    optionsFieldKey?: string;
    isCustom?: boolean;
  } | null>(null);
  const [fieldModalChoices, setFieldModalChoices] = useState<any[]>([]);
  const [quickAddChoiceInput, setQuickAddChoiceInput] = useState('');
  const [isSavingField, setIsSavingField] = useState(false);

  // Add Field to Section Modal State
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('select');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [newFieldChoices, setNewFieldChoices] = useState('');
  const [isAddingField, setIsAddingField] = useState(false);

  const MODULE_TO_CAT_MAP: Record<string, string> = {
    'RMU': 'RMUMD',
    'Transformer': 'TRMaster Data',
    'LT_Kiosk': 'LTKMD',
    'HT_Yard_Common': 'HTYardCommon'
  };

  // Load choices when editing a field
  useEffect(() => {
    if (editingField && (editingField.fieldType === 'select' || editingField.fieldType === 'searchable_select')) {
      const cat = (editingField.optionsCategory || MODULE_TO_CAT_MAP[spec.moduleType] || 'LTKMD') as any;
      const targetKey = editingField.optionsFieldKey || editingField.fieldKey;
      htYardMasterDataService.getMasterOptions(cat).then(opts => {
        const matching = opts.filter(o => (o.fieldKey === targetKey || o.fieldKey === editingField.fieldKey) && o.isActive !== false);
        setFieldModalChoices(matching);
      }).catch(() => setFieldModalChoices([]));
    } else {
      setFieldModalChoices([]);
    }
  }, [editingField, spec.moduleType]);

  useEffect(() => {
    if (propsDuplicatedStages) {
      setDuplicatedStages(propsDuplicatedStages);
    }
  }, [propsDuplicatedStages]);

  const updateDuplicatedStages = (newStages: Record<string, { id: string; label: string }[]>) => {
    setDuplicatedStages(newStages);
    if (onDuplicatedStagesChange) {
      onDuplicatedStagesChange(newStages);
    }
  };

  // Save changes to field configuration
  const handleSaveFieldConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField || !editingField.fieldLabel.trim()) return;
    setIsSavingField(true);
    try {
      const cat = (editingField.optionsCategory || MODULE_TO_CAT_MAP[spec.moduleType] || 'LTKMD') as any;
      await htYardFieldSpecService.saveFieldSpec({
        category: cat,
        moduleType: spec.moduleType,
        sectionKey: editingField.sectionKey,
        sectionTitle: editingField.sectionTitle,
        fieldKey: editingField.fieldKey,
        fieldLabel: editingField.fieldLabel.trim(),
        fieldType: editingField.fieldType as any,
        optionsCategory: cat,
        optionsFieldKey: editingField.fieldKey,
        unit: editingField.unit.trim() || undefined,
        placeholder: editingField.placeholder.trim() || undefined,
        isCustom: editingField.isCustom ?? true
      });
      toast.success(`Updated question "${editingField.fieldLabel}"!`);
      setEditingField(null);
      await loadMergedSpec();
      await loadCategoryOptions();
    } catch (err) {
      toast.error('Failed to update question');
    } finally {
      setIsSavingField(false);
    }
  };

  // Add new field to the active section
  const handleAddNewFieldToSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;
    setIsAddingField(true);
    try {
      const cat = (MODULE_TO_CAT_MAP[spec.moduleType] || 'LTKMD') as any;
      const cleanKey = `custom_${newFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
      const activeStage = allStages.find(s => s.key === activeSectionKey);
      const sectionKey = (activeStage?.type === 'spec' || activeStage?.type === 'spec_dup') && activeStage.section ? activeStage.section.sectionKey : activeSectionKey;
      const sectionTitle = activeStage?.title || 'Equipment Details';

      await htYardFieldSpecService.saveFieldSpec({
        category: cat,
        moduleType: spec.moduleType,
        sectionKey: sectionKey,
        sectionTitle: sectionTitle,
        fieldKey: cleanKey,
        fieldLabel: newFieldLabel.trim(),
        fieldType: newFieldType as any,
        optionsCategory: cat,
        optionsFieldKey: cleanKey,
        unit: newFieldUnit.trim() || undefined,
        isCustom: true
      });

      // If initial choices provided
      if (newFieldChoices.trim() && (newFieldType === 'select' || newFieldType === 'searchable_select')) {
        const choiceItems = newFieldChoices.split(/[,\n]/).map(c => c.trim()).filter(Boolean);
        for (const choice of choiceItems) {
          await htYardMasterDataService.saveMasterOption({
            category: cat,
            fieldKey: cleanKey,
            optionValue: choice,
            isActive: true
          });
        }
      }

      toast.success(`Added question "${newFieldLabel.trim()}" to ${sectionTitle}!`);
      setShowAddFieldModal(false);
      setNewFieldLabel('');
      setNewFieldUnit('');
      setNewFieldChoices('');
      setNewFieldType('select');
      await loadMergedSpec();
      await loadCategoryOptions();
    } catch (err) {
      toast.error('Failed to add question');
    } finally {
      setIsAddingField(false);
    }
  };

  // Delete/remove field from active section
  const handleDeleteFieldFromSection = async (fieldKey: string, fieldLabel: string) => {
    if (!window.confirm(`Are you sure you want to remove question "${fieldLabel}" from this section?`)) return;
    try {
      const cat = (MODULE_TO_CAT_MAP[spec.moduleType] || 'LTKMD') as any;
      const activeStage = allStages.find(s => s.key === activeSectionKey);
      const sectionKey = (activeStage?.type === 'spec' || activeStage?.type === 'spec_dup') && activeStage.section ? activeStage.section.sectionKey : activeSectionKey;
      await htYardFieldSpecService.deleteFieldSpec(cat, fieldKey, sectionKey);
      toast.success(`Removed question "${fieldLabel}"!`);
      await loadMergedSpec();
      await loadCategoryOptions();
    } catch (err) {
      toast.error('Failed to remove question');
    }
  };

  // Add choice option to dropdown when editing field
  const handleAddChoiceToField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField || !quickAddChoiceInput.trim()) return;
    try {
      const cat = (editingField.optionsCategory || MODULE_TO_CAT_MAP[spec.moduleType] || 'LTKMD') as any;
      const targetKey = editingField.optionsFieldKey || editingField.fieldKey;
      const created = await htYardMasterDataService.saveMasterOption({
        category: cat,
        fieldKey: targetKey,
        optionValue: quickAddChoiceInput.trim(),
        isActive: true
      });
      setFieldModalChoices(prev => [...prev, created]);
      setQuickAddChoiceInput('');
      toast.success(`Added option "${quickAddChoiceInput.trim()}"`);
      await loadCategoryOptions();
    } catch (err) {
      toast.error('Failed to add choice option');
    }
  };

  // Delete choice option from dropdown
  const handleDeleteChoiceOption = async (optId: string, optValue: string) => {
    try {
      await htYardMasterDataService.deleteMasterOption(optId);
      setFieldModalChoices(prev => prev.filter(o => o.id !== optId));
      toast.success(`Removed option "${optValue}"`);
      await loadCategoryOptions();
    } catch (err) {
      toast.error('Failed to remove option');
    }
  };

  // Load dynamically merged specs (baseline + custom field overrides)
  const loadMergedSpec = async () => {
    try {
      const merged = await htYardFieldSpecService.getMergedModuleSpec(spec.moduleType);
      setActiveSpecState(merged);
      if (merged.sections.length > 0 && !activeSectionKey) {
        setActiveSectionKey(merged.sections[0].sectionKey);
      }
    } catch (e) {
      setActiveSpecState(spec);
    }
  };

  // When spec changes or custom field definitions update, reload
  useEffect(() => {
    loadMergedSpec();
    loadCategoryOptions();

    const handleSpecUpdate = () => {
      loadMergedSpec();
      loadCategoryOptions();
    };
    window.addEventListener('ht_field_specs_updated', handleSpecUpdate);
    return () => window.removeEventListener('ht_field_specs_updated', handleSpecUpdate);
  }, [spec.moduleType, selectedManufacturer]);

  useEffect(() => {
    if (activeSpecState.sections.length > 0) {
      if (!activeSpecState.sections.some(s => s.sectionKey === activeSectionKey)) {
        setActiveSectionKey(activeSpecState.sections[0].sectionKey);
      }
    } else if (customStages.length > 0) {
      setActiveSectionKey(customStages[0].key);
    }
    // Clear duplicates when switching equipment instance
    setDuplicatedStages({});
    setEditingTitleId(null);
  }, [activeSpecState.moduleType]);

  useEffect(() => {
    loadCategoryOptions();
  }, [activeSpecState, selectedManufacturer]);

  const handleDuplicateStage = (originalKey: string, originalTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = duplicatedStages[originalKey] || [];
    const newId = `dup_${originalKey}_${Date.now()}`;
    const newLabel = `${originalTitle} (Copy ${existing.length + 1})`;
    const updated = { ...duplicatedStages, [originalKey]: [...existing, { id: newId, label: newLabel }] };
    updateDuplicatedStages(updated);
    // Navigate to the duplicate and immediately open the inline title editor
    setActiveSectionKey(newId);
    setEditingTitleId(newId);
    setEditingTitleValue(newLabel);
    if (onLogAction) {
      onLogAction({
        actionType: 'DUPLICATE',
        target: originalTitle,
        details: `Duplicated stage "${originalTitle}" to "${newLabel}"`
      });
    }
    // Focus the input on next frame
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  const handleRemoveDuplicate = (originalKey: string, dupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = duplicatedStages[originalKey] || [];
    const targetStage = existing.find(d => d.id === dupId);
    const updated = { ...duplicatedStages, [originalKey]: existing.filter(d => d.id !== dupId) };
    updateDuplicatedStages(updated);
    if (onLogAction) {
      onLogAction({
        actionType: 'DELETE',
        target: targetStage?.label || 'Duplicate Stage',
        details: `Deleted duplicate stage "${targetStage?.label || dupId}"`
      });
    }
    if (activeSectionKey === dupId) setActiveSectionKey(originalKey);
    if (editingTitleId === dupId) setEditingTitleId(null);
  };

  // Commit live-typed value back into duplicatedStages so sidebar stays in sync
  const handleTitleChange = (newVal: string, originalKey: string, dupId: string) => {
    setEditingTitleValue(newVal);
    const updated = {
      ...duplicatedStages,
      [originalKey]: (duplicatedStages[originalKey] || []).map(d => d.id === dupId ? { ...d, label: newVal } : d)
    };
    updateDuplicatedStages(updated);
  };

  const handleTitleBlur = () => {
    // Trim on blur; if empty restore a fallback
    setDuplicatedStages(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(origKey => {
        updated[origKey] = updated[origKey].map(d => {
          if (d.id === editingTitleId) {
            const finalLabel = d.label.trim() || 'Untitled Stage';
            if (onLogAction && finalLabel !== editingTitleValue) {
              onLogAction({
                actionType: 'EDIT',
                target: finalLabel,
                details: `Renamed duplicate stage to "${finalLabel}"`
              });
            }
            return { ...d, label: finalLabel };
          }
          return d;
        });
      });
      return updated;
    });
    setEditingTitleId(null);
  };

  const loadCategoryOptions = async () => {
    const categoriesNeeded = new Set<string>();
    activeSpecState.sections.forEach((sec) => {
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

  // ─── 1. GPS Location Fetching Handler ─────────────────────────────────────────
  const handleFetchGpsLocation = async (itemKey: string, fieldLabel: string, currentResponse: Partial<HTAuditResponse>) => {
    setFetchingGpsKey(itemKey);
    try {
      let lat: number | null = null;
      let lon: number | null = null;
      let accuracy: number = 5;

      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        accuracy = Math.round(pos.coords.accuracy || 5);
      } catch (geoErr) {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (p) => {
                lat = p.coords.latitude;
                lon = p.coords.longitude;
                accuracy = Math.round(p.coords.accuracy || 5);
                resolve();
              },
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          });
        }
      }

      if (lat == null || lon == null) {
        throw new Error('Could not access device GPS sensor. Please verify location permissions.');
      }

      const address = await reverseGeocode(lat, lon);
      const timestamp = new Date().toLocaleString();
      const geoSummary = `${lat.toFixed(5)}, ${lon.toFixed(5)} | ±${accuracy}m | ${address}`;

      onChangeResponse(itemKey, {
        ...currentResponse,
        responseValue: geoSummary,
        remarks: currentResponse.remarks ? currentResponse.remarks : `Geo-tagged at ${timestamp} (GPS Accuracy ±${accuracy}m)`
      });

      toast.success(`📍 Geo-Tagged: ${address.split(',')[0]} (±${accuracy}m precision)`, { icon: '🎯' });
      if (onLogAction) {
        onLogAction({
          actionType: 'EDIT',
          target: fieldLabel,
          details: `Captured high-precision GPS geo-tag: ${geoSummary}`
        });
      }
    } catch (err: any) {
      console.warn('GPS location fetch error:', err);
      toast.error('GPS Fetch Failed: ' + (err?.message || 'Permission denied'));
    } finally {
      setFetchingGpsKey(null);
    }
  };

  // ─── 2. 1-Click OEM Model & Yard Preset Auto-Fill Handler ─────────────────
  const handleAutoFillFromModel = (catalogItem: EquipmentCatalogItem) => {
    let filledCount = 0;

    // Loop through ALL sections of the active module specification
    activeSpecState.sections.forEach(targetSection => {
      targetSection.fields.forEach(f => {
        const k = f.key.toLowerCase();
        const instancePrefix = `${equipmentInstanceId}_${targetSection.sectionKey}`;
        const targetItemKey = `${instancePrefix}_${f.key}`;
        const existing: HTAuditResponse = responses[targetItemKey] || {
          auditId: equipmentInstanceId || 'audit',
          equipmentInstanceId: equipmentInstanceId !== 'site' ? equipmentInstanceId : undefined,
          moduleType: spec.moduleType,
          sectionKey: targetSection.sectionKey,
          itemNumber: 1,
          fieldKey: f.key,
          fieldLabel: f.label,
          responseValue: '',
          remarks: '',
          photoUrls: [],
          isNotApplicable: false
        };

        let nextVal: string | null = null;

        // 1. Direct customSpecs check from preset
        if (catalogItem.customSpecs && catalogItem.customSpecs[f.key]) {
          nextVal = catalogItem.customSpecs[f.key];
        } 
        // 2. Yard common fields heuristic matching
        else if (catalogItem.category === 'YARD_COMMON') {
          if (k.includes('fenc') || k.includes('height')) nextVal = '2.4 Meters GI Chainlink with 3-strand Razor Barbed Wire';
          else if (k.includes('jelly') || k.includes('gravel')) nextVal = 'Yes';
          else if (k.includes('caution') || k.includes('board') || k.includes('danger')) nextVal = 'Yes';
          else if (k.includes('oil_filt') || k.includes('filtration')) nextVal = 'Completed - Moisture < 15 ppm, Acidity 0.03 mg KOH/g';
          else if (k.includes('bdv') || k.includes('dielectric')) nextVal = 'BDV 62 kV @ 2.5mm gap (Passed > 50 kV standard)';
          else if (k.includes('clean') || k.includes('cleanliness')) nextVal = 'Satisfactory / Clean';
          else if (k.includes('fire') || k.includes('extinguish')) nextVal = 'CO2 4.5kg + DCP 9kg';
          else if (k.includes('sand') || k.includes('bucket')) nextVal = 'Yes';
          else if (k.includes('report') || k.includes('approval') || k.includes('drawing') || k.includes('status')) nextVal = 'Yes';
        }
        // 3. Equipment technical specs matching
        else {
          if (k.includes('mfr') || k.includes('manufacturer') || f.isManufacturerField) {
            nextVal = catalogItem.manufacturer;
          } else if (k.includes('model')) {
            nextVal = catalogItem.modelNumber;
          } else if (k.includes('capacity') || k.includes('rating') || k.includes('current')) {
            nextVal = catalogItem.ratingCapacity || catalogItem.ratedCurrent || '';
          } else if (k.includes('voltage') || k.includes('rated_kv')) {
            nextVal = catalogItem.ratedVoltage;
          } else if (k.includes('breaking') || k.includes('ka')) {
            nextVal = catalogItem.breakingCapacity || '21 kA / 3s';
          } else if (k.includes('insul') || k.includes('medium') || k.includes('oil') || k.includes('gas') || k.includes('sf6')) {
            nextVal = catalogItem.insulationMedium || (catalogItem.category === 'RMU' ? 'SF6 Gas (1.42 bar)' : 'Mineral Oil Class 1');
          } else if (k.includes('life') || k.includes('span')) {
            nextVal = `${catalogItem.standardLifeSpanYears} Years`;
          } else if (k.includes('cool') || k.includes('phase')) {
            nextVal = catalogItem.coolingType || catalogItem.phases || '';
          } else if (k.includes('cable_rating')) {
            nextVal = catalogItem.category === 'RMU' ? '3C x 300 sq.mm XLPE' : '3.5C x 240 sq.mm Al XLPE';
          } else if (k.includes('relay') || k.includes('protection')) {
            nextVal = catalogItem.manufacturer.includes('ABB') ? 'ABB REF615 Numerical Relay' :
                      catalogItem.manufacturer.includes('Schneider') ? 'Schneider Micom P122' : 'Numerical Overcurrent + Earth Fault Relay';
          } else if (k.includes('foundation')) {
            nextVal = 'RCC Plinth Foundation (Good Condition)';
          } else if (k.includes('rubber_mat') || k.includes('rain_shade')) {
            nextVal = 'Yes';
          }
        }

        if (nextVal !== null) {
          onChangeResponse(targetItemKey, { ...existing, responseValue: nextVal });
          filledCount++;
        }
      });
    });

    setShowCatalogModal(false);
    toast.success(`✨ 1-Click Auto-Filled ${filledCount} field specifications from ${catalogItem.modelNumber}!`, { icon: '⚡' });
    if (onLogAction) {
      onLogAction({
        actionType: 'EDIT',
        target: catalogItem.modelName,
        details: `1-Click Auto-filled ${filledCount} technical parameters from ${catalogItem.modelNumber}`
      });
    }
  };

  // ─── 3. Life Span & Age Helper ──────────────────────────────────────────────
  const getAssetAgeAndLifespan = (standardLifespanYears: number = 25) => {
    // Look for mfg_year in instance responses
    let mfgYear = new Date().getFullYear();
    const allResp = Object.values(responses);
    const mfgResp = allResp.find(r => 
      (r.fieldKey?.includes('mfg') || r.fieldKey?.includes('year') || r.fieldLabel?.toLowerCase().includes('year')) &&
      r.responseValue && r.responseValue.trim() !== ''
    );
    if (mfgResp?.responseValue) {
      const match = mfgResp.responseValue.match(/\b(19\d\d|20\d\d)\b/);
      if (match) mfgYear = parseInt(match[1], 10);
    }

    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - mfgYear);
    const rul = Math.max(0, standardLifespanYears - age);
    const percentElapsed = Math.min(100, Math.round((age / standardLifespanYears) * 100));
    const percentRemaining = 100 - percentElapsed;

    let healthStatus: 'GOOD' | 'WARNING' | 'CRITICAL' = 'GOOD';
    let advisory = `Asset is operating within expected nominal lifespan. Continue standard preventive maintenance.`;

    if (rul <= 5 || percentRemaining <= 20) {
      healthStatus = 'CRITICAL';
      advisory = `🚨 Critical Aging Alert: Asset has reached ${percentElapsed}% of design lifespan. Recommend Residual Life Assessment (RLA) & capital replacement planning.`;
    } else if (rul <= 10 || percentRemaining <= 40) {
      healthStatus = 'WARNING';
      advisory = `⚠️ Moderate Aging: Asset is ${age} years old. Recommend enhanced diagnostic testing (DGA, thermography, contact resistance).`;
    }

    return { mfgYear, age, standardLifespanYears, rul, percentElapsed, percentRemaining, healthStatus, advisory };
  };

  const getSectionProgress = (sectionKey: string) => {
    const section = activeSpecState.sections.find(s => s.sectionKey === sectionKey);
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

  // Build allStages — spec stages with their duplicates interleaved, then custom stages
  const allStages: Array<{
    key: string;
    title: string;
    type: 'spec' | 'spec_dup' | 'custom' | 'custom_dup';
    section?: typeof activeSpecState.sections[0];
    content?: React.ReactNode;
    subtitle: string;
    isDone: boolean;
    originalKey?: string;
    isDuplicate?: boolean;
  }> = [];

  activeSpecState.sections.forEach(s => {
    // Push the original spec stage
    allStages.push({
      key: s.sectionKey,
      title: s.title,
      type: 'spec',
      section: s,
      subtitle: `${s.fields.length} checklist points`,
      isDone: getSectionProgress(s.sectionKey).isDone
    });
    // Push any duplicates of this stage right after it
    (duplicatedStages[s.sectionKey] || []).forEach(dup => {
      allStages.push({
        key: dup.id,
        title: dup.label,
        type: 'spec_dup',
        section: s,  // reuse same fields spec
        subtitle: `${s.fields.length} checklist points (copy)`,
        isDone: false,
        originalKey: s.sectionKey,
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
    // Push any duplicates of this custom stage right after it
    (duplicatedStages[cs.key] || []).forEach(dup => {
      allStages.push({
        key: dup.id,
        title: dup.label,
        type: 'custom_dup',
        content: cs.content,  // same content node
        subtitle: `${cs.subtitle || 'Custom stage'} (copy)`,
        isDone: false,
        originalKey: cs.key,
        isDuplicate: true
      });
    });
  });

  const activeStageIndex = allStages.findIndex(s => s.key === activeSectionKey);
  const activeStage = allStages[activeStageIndex];
  // spec_dup reuses the same section definition as its original
  const activeSection = (activeStage?.type === 'spec' || activeStage?.type === 'spec_dup')
    ? activeStage.section ?? null
    : null;

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
          
          <div className="space-y-5">
            {allStages.map((stage, idx) => {
              const isActive = stage.key === activeSectionKey;
              const isDone = stage.isDone;

              return (
                <div key={stage.key} className="relative z-10 group">
                  <div className="flex items-start gap-3">
                    {/* Stage clickable row */}
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

                    {/* Right-side action icons */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      {/* + Duplicate: on ALL non-duplicate stages (spec and custom) */}
                      {!stage.isDuplicate && (
                        <button
                          onClick={e => handleDuplicateStage(stage.key, stage.title, e)}
                          className="w-5 h-5 rounded-full bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors"
                          title="Duplicate this stage"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}

                      {/* − Remove: only on duplicate stages */}
                      {stage.isDuplicate && (
                        <button
                          onClick={e => handleRemoveDuplicate(stage.originalKey!, stage.key, e)}
                          className="w-5 h-5 rounded-full bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-800/60 text-rose-500 dark:text-rose-400 flex items-center justify-center transition-colors"
                          title="Remove this duplicate stage"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
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
            {/* Right panel header — editable for copied and regular stages */}
            <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-3">
              {editingTitleId === activeStage.key ? (
                // Inline editable title input
                <div className="flex items-center gap-2 flex-1 max-w-xl">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editingTitleValue}
                    onChange={e => handleTitleChange(e.target.value, activeStage.originalKey || activeStage.key, activeStage.key)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleTitleBlur();
                      if (e.key === 'Escape') setEditingTitleId(null);
                    }}
                    placeholder="Enter section heading..."
                    className="flex-1 text-lg font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border-2 border-emerald-500 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleTitleBlur}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTitleId(null)}
                    className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                    {activeStage.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTitleId(activeStage.key);
                      setEditingTitleValue(activeStage.title);
                      setTimeout(() => titleInputRef.current?.focus(), 30);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-600 hover:text-emerald-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer shrink-0"
                    title="Rename Section Heading"
                  >
                    <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Rename Heading</span>
                  </button>
                </div>
              )}

              {/* Action Buttons on Right: + Add Question to this Section */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldLabel('');
                    setNewFieldUnit('');
                    setNewFieldChoices('');
                    setNewFieldType('select');
                    setShowAddFieldModal(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  title={`Add a new question directly to "${activeStage.title}"`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Question to Section</span>
                </button>
              </div>
            </div>

            {/* Top Smart OEM / Yard Preset Auto-Fill Banner */}
            {(activeStage.type === 'spec' || activeStage.type === 'spec_dup') && activeSection && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white shadow-lg border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold tracking-wide uppercase text-emerald-300">
                        {spec.moduleType === 'HT_Yard_Common'
                          ? 'Substation Yard Infrastructure & Compliance Auto-Fill'
                          : `Smart ${spec.title || 'Equipment'} Model Catalog Auto-Fill`}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                        ⚡ 1-Click
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {spec.moduleType === 'HT_Yard_Common'
                        ? 'Instantly populate standard yard specifications (2.4m GI Fencing, 40mm Jelly gravel, CEA Danger Boards, BDV oil test & CEIG reports).'
                        : 'Instantly populate technical specs (Voltage, Capacity, Breaking current, Relays, Lifespan, Insulation) for Cummins, ABB, Schneider, Siemens & Kirloskar.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogCategoryFilter(spec.moduleType === 'HT_Yard_Common' ? 'YARD_COMMON' : spec.moduleType === 'RMU' ? 'RMU' : spec.moduleType === 'Transformer' ? 'TRANSFORMER' : 'ALL');
                    setShowCatalogModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Cpu className="w-4 h-4" />
                  {spec.moduleType === 'HT_Yard_Common' ? 'Select Substation Yard Preset' : 'Browse 60+ OEM Models Database'}
                </button>
              </div>
            )}

            {(activeStage.type === 'spec' || activeStage.type === 'spec_dup') && activeSection ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activeSection.fields.map((field, itemIdx) => {
                // For duplicated stages, namespace the responses by the duplicate's unique key
                const instancePrefix = activeStage.isDuplicate ? `${equipmentInstanceId}_${activeStage.key}` : `${equipmentInstanceId}_${activeSection!.sectionKey}`;
                const itemKey = `${instancePrefix}_${field.key}`;
                const currentResponse: HTAuditResponse = responses[itemKey] || {
                  auditId: equipmentInstanceId || 'audit',
                  equipmentInstanceId: equipmentInstanceId !== 'site' ? equipmentInstanceId : undefined,
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
                  const matching = categoryOptions.filter(o => (o.fieldKey === targetFieldKey || o.fieldKey === field.key) && o.isActive !== false);
                  if (matching.length > 0) {
                    optionsList = matching.map(o => o.optionValue);
                  } else {
                    const fallback = categoryOptions.filter(o => o.fieldKey === 'generic' && o.isActive !== false);
                    optionsList = fallback.map(o => o.optionValue);
                  }
                }
                const cleanOptionsList = Array.from(
                  new Set(
                    optionsList
                      .map(opt => (opt || '').trim())
                      .filter(Boolean)
                      .map(opt => (opt.toLowerCase() === 'other' ? 'Other — Specify in Remarks' : opt))
                  )
                );

                return (
                  <div key={field.key} className="flex flex-col p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/20 shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <label className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug truncate">
                          {field.label}
                        </label>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit Field Question Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingField({
                              sectionKey: activeSection.sectionKey,
                              sectionTitle: activeStage.title,
                              fieldKey: field.key,
                              fieldLabel: field.label,
                              fieldType: field.type || 'text',
                              unit: field.unit || '',
                              placeholder: field.placeholder || '',
                              optionsCategory: field.optionsCategory,
                              optionsFieldKey: field.optionsFieldKey,
                              isCustom: field.isCustom
                            });
                          }}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-400 hover:text-emerald-600 transition-colors border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
                          title={`Edit Question "${field.label}"`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Field Question Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteFieldFromSection(field.key, field.label)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
                          title={`Delete Question "${field.label}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Mark N/A checkbox */}
                        <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium pt-0.5 ml-1">
                          <input
                            type="checkbox"
                            checked={currentResponse.isNotApplicable || false}
                            onChange={(e) => {
                              const isNA = e.target.checked;
                              onChangeResponse(itemKey, {
                                ...currentResponse,
                                isNotApplicable: isNA
                              });
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500/20 w-3.5 h-3.5"
                          />
                        </label>
                      </div>
                    </div>

                    {!currentResponse.isNotApplicable ? (
                      <div className="flex-1 flex flex-col space-y-4">
                        {/* Input Selector */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              Observation / Value {field.unit ? `(${field.unit})` : ''}
                            </span>
                            {field.isCustom && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                                Custom
                              </span>
                            )}
                          </div>

                          {field.type === 'gps_location' ? (
                            <div className="space-y-2">
                              {currentResponse.responseValue ? (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                                      <MapPin className="w-3 h-3" /> Geo-Tagged Verified
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleFetchGpsLocation(itemKey, field.label, currentResponse)}
                                      disabled={fetchingGpsKey === itemKey}
                                      className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
                                    >
                                      <RefreshCw className={`w-3 h-3 ${fetchingGpsKey === itemKey ? 'animate-spin' : ''}`} />
                                      Re-Fetch
                                    </button>
                                  </div>
                                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                                    {currentResponse.responseValue}
                                  </div>
                                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40 text-[10px] text-slate-500">
                                    <span>High Precision GPS Sensor</span>
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentResponse.responseValue.split('|')[0] || currentResponse.responseValue)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5"
                                    >
                                      View Map <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleFetchGpsLocation(itemKey, field.label, currentResponse)}
                                  disabled={fetchingGpsKey === itemKey}
                                  className="w-full py-3 px-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                                >
                                  <MapPin className={`w-4 h-4 ${fetchingGpsKey === itemKey ? 'animate-bounce' : ''}`} />
                                  {fetchingGpsKey === itemKey ? 'Fetching High-Precision Coordinates...' : '📍 Fetch Exact GPS Location (1-Tap)'}
                                </button>
                              )}
                            </div>
                          ) : field.type === 'lifespan_calculator' ? (
                            (() => {
                              const standardYears = parseInt(field.unit || '25', 10) || 25;
                              const { mfgYear, age, rul, percentElapsed, percentRemaining, healthStatus, advisory } = getAssetAgeAndLifespan(standardYears);
                              return (
                                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-800/50 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      Mfg Year: <span className="font-extrabold font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-amber-200">{mfgYear}</span>
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                      healthStatus === 'GOOD' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                      healthStatus === 'WARNING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    }`}>
                                      {healthStatus === 'GOOD' ? '🟢 Prime Life' : healthStatus === 'WARNING' ? '🟡 Moderate Aging' : '🔴 Critical / EOL'}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-center">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-amber-100 dark:border-slate-700">
                                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Asset Age</span>
                                      <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{age} Years Old</span>
                                    </div>
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-amber-100 dark:border-slate-700">
                                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Remaining Useful Life</span>
                                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{rul} Years Left</span>
                                    </div>
                                  </div>

                                  {/* Degradation Progress Bar */}
                                  <div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                      <span>Lifespan Elapsed: {percentElapsed}%</span>
                                      <span>Design Life: {standardYears} Yrs</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                      <div
                                        style={{ width: `${percentElapsed}%` }}
                                        className={`h-full ${
                                          healthStatus === 'GOOD' ? 'bg-emerald-500' :
                                          healthStatus === 'WARNING' ? 'bg-amber-500' : 'bg-rose-600'
                                        }`}
                                      />
                                    </div>
                                  </div>

                                  <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 italic leading-relaxed">
                                    {advisory}
                                  </p>
                                </div>
                              );
                            })()
                          ) : field.type === 'model_catalog_autofill' ? (
                            <div className="space-y-2">
                              <select
                                value={currentResponse.responseValue || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  onChangeResponse(itemKey, {
                                    ...currentResponse,
                                    responseValue: val
                                  });
                                  const found = htEquipmentCatalogService.getModelDetails(val);
                                  if (found) {
                                    handleAutoFillFromModel(found);
                                  }
                                }}
                                className="w-full px-3.5 py-2 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                              >
                                <option value="">Select or Search OEM Model...</option>
                                {htEquipmentCatalogService.searchCatalog('', spec.moduleType).map((m) => (
                                  <option key={m.id} value={m.modelNumber}>
                                    {m.manufacturer} — {m.modelNumber} ({m.ratingCapacity})
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setShowCatalogModal(true)}
                                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[11px] shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                1-Click Auto-Fill Specifications
                              </button>
                            </div>
                          ) : field.type === 'digital_signature' ? (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Digital Signoff Stamp
                                </span>
                                {currentResponse.responseValue && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                                    Signed & Verified
                                  </span>
                                )}
                              </div>
                              <input
                                type="text"
                                placeholder="Enter signing engineer name or PIN..."
                                value={currentResponse.responseValue || ''}
                                onChange={(e) =>
                                  onChangeResponse(itemKey, {
                                    ...currentResponse,
                                    responseValue: e.target.value,
                                    remarks: currentResponse.remarks || `Digitally attested on ${new Date().toLocaleDateString()}`
                                  })
                                }
                                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-xs"
                              />
                            </div>
                          ) : field.type === 'boolean' ? (
                            <select
                              value={currentResponse.responseValue || 'Yes'}
                              onChange={(e) => {
                                const val = e.target.value;
                                onChangeResponse(itemKey, {
                                  ...currentResponse,
                                  responseValue: val
                                });
                                if (onLogAction) {
                                  onLogAction({
                                    actionType: 'EDIT',
                                    target: field.label,
                                    details: `Updated "${field.label}" = "${val}"`
                                  });
                                }
                              }}
                              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                            >
                              <option value="Yes">Yes / Compliant</option>
                              <option value="No">No / Non-Compliant</option>
                              <option value="Details Not Available">Details Not Available</option>
                            </select>
                          ) : field.type === 'select' || field.type === 'searchable_select' || field.type === 'cascading_select' ? (
                            <select
                              value={currentResponse.responseValue || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                onChangeResponse(itemKey, {
                                  ...currentResponse,
                                  responseValue: val
                                });
                                if (onLogAction) {
                                  onLogAction({
                                    actionType: 'EDIT',
                                    target: field.label,
                                    details: `Selected "${val}" for "${field.label}"`
                                  });
                                }
                              }}
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
                          ) : field.type === 'number' ? (
                            <div className="relative">
                              <input
                                type="number"
                                step="any"
                                placeholder={field.placeholder || `Enter number in ${field.unit || 'units'}...`}
                                value={currentResponse.responseValue || ''}
                                onChange={(e) =>
                                  onChangeResponse(itemKey, {
                                    ...currentResponse,
                                    responseValue: e.target.value
                                  })
                                }
                                className="w-full pl-3.5 pr-12 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                              />
                              {field.unit && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                  {field.unit}
                                </span>
                              )}
                            </div>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              rows={2}
                              placeholder={field.placeholder || 'Enter observation or detailed remarks...'}
                              value={currentResponse.responseValue || ''}
                              onChange={(e) =>
                                onChangeResponse(itemKey, {
                                  ...currentResponse,
                                  responseValue: e.target.value
                                })
                              }
                              className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-y"
                            />
                          ) : field.type === 'photo' ? (
                            <div className="p-2.5 bg-cyan-50/60 dark:bg-cyan-950/30 rounded-xl border border-cyan-200/60 dark:border-cyan-800/40 flex items-center justify-between text-xs text-cyan-800 dark:text-cyan-300">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Image className="w-4 h-4 text-cyan-600" /> Photo Capture Required
                              </span>
                              <span className="text-[11px] font-bold">
                                {currentResponse.photoUrls?.length || 0} attached
                              </span>
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder={field.placeholder || 'Enter observation / value...'}
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

              {/* Bottom Add Question Banner for Active Section */}
              <div className="mt-8 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-extrabold shrink-0 border border-emerald-200/50">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      Need another question or checklist point in {activeStage.title}?
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Add custom questions, breaker details, ratings, or dropdown lists directly to this section.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldLabel('');
                    setNewFieldUnit('');
                    setNewFieldChoices('');
                    setNewFieldType('select');
                    setShowAddFieldModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer w-full sm:w-auto justify-center"
                >
                  <Plus className="w-3.5 h-3.5" /> + Add Question
                </button>
              </div>
            </div>
            ) : (activeStage.type === 'custom' || activeStage.type === 'custom_dup') ? (
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

      {/* 40+ OEM EQUIPMENT CATALOG SELECTION MODAL */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Master Equipment Specification Catalog
                  </h2>
                  <p className="text-xs text-slate-400">
                    Select any OEM model to auto-populate all engineering ratings in 1-click
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by Cummins 500kVA, ABB SafeRing, Schneider, Kirloskar..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                {catalogSearch && (
                  <button onClick={() => setCatalogSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={catalogCategoryFilter}
                onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold"
              >
                <option value="ALL">All Categories</option>
                <option value="YARD_COMMON">🏞️ Yard Infrastructure & HIRA Presets (11kV / 33kV / Tech Park)</option>
                <option value="DG_SET">⚡ DG Sets (Cummins, Kirloskar, CAT)</option>
                <option value="RMU">🔄 Ring Main Units (ABB, Schneider, Siemens)</option>
                <option value="TRANSFORMER">⚡ Transformers (Oil & Dry Type)</option>
                <option value="HT_PANEL">🛡️ HT/LT Breakers & Panels</option>
                <option value="LT_KIOSK">📦 LT Feeder Pillars</option>
              </select>
            </div>

            {/* Catalog Items Grid */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[50vh]">
              {htEquipmentCatalogService.searchCatalog(catalogSearch, catalogCategoryFilter).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {item.modelNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {item.ratingCapacity}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {item.manufacturer}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                      <span>⚡ {item.ratedVoltage}</span>
                      {item.breakingCapacity && <span>🛡️ {item.breakingCapacity}</span>}
                      {item.insulationMedium && <span>🧪 {item.insulationMedium}</span>}
                      <span>⏳ {item.standardLifeSpanYears} Yrs Lifespan</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAutoFillFromModel(item)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-center cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> 1-Click Auto-Fill
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EDIT QUESTION / CONFIGURE FIELD MODAL */}
      {editingField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Edit Question Specification
                  </h2>
                  <p className="text-xs text-slate-400">
                    Customize the question title, answer format, unit, or choices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFieldConfig} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question / Checkpoint Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingField.fieldLabel}
                  onChange={(e) => setEditingField({ ...editingField, fieldLabel: e.target.value })}
                  placeholder="e.g. Incomer MCCB/ACB Rating & Details"
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Answer Format / Type
                  </label>
                  <select
                    value={editingField.fieldType}
                    onChange={(e) => setEditingField({ ...editingField, fieldType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  >
                    <option value="select">🔘 Select from Dropdown List</option>
                    <option value="text">📝 Short Text Input</option>
                    <option value="textarea">📄 Multi-line Detailed Remarks</option>
                    <option value="number">🔢 Number / Measurement Value</option>
                    <option value="date">📅 Calendar Date</option>
                    <option value="boolean">🔘 Yes / No Switch</option>
                    <option value="photo">📷 Photo Attachment</option>
                    <option value="gps_location">📍 GPS Location Verified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unit / Suffix (Optional)
                  </label>
                  <input
                    type="text"
                    value={editingField.unit}
                    onChange={(e) => setEditingField({ ...editingField, unit: e.target.value })}
                    placeholder="e.g. A, V, kVA, Deg C, mm"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* If dropdown type: show & manage options */}
              {(editingField.fieldType === 'select' || editingField.fieldType === 'searchable_select') && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      Dropdown Choices ({fieldModalChoices.length})
                    </span>
                    <span className="text-[10px] text-slate-400">Manage selectable choices</span>
                  </div>

                  {/* List of choices */}
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {fieldModalChoices.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">No choices added yet. Add below.</p>
                    ) : (
                      fieldModalChoices.map((opt) => (
                        <div
                          key={opt.id}
                          className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-200"
                        >
                          <span className="font-semibold">{opt.optionValue}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteChoiceOption(opt.id, opt.optionValue)}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded-lg"
                            title="Delete choice"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Quick Add choice input */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <input
                      type="text"
                      value={quickAddChoiceInput}
                      onChange={(e) => setQuickAddChoiceInput(e.target.value)}
                      placeholder="Type a new choice option..."
                      className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddChoiceToField}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer shadow-2xs"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingField}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingField ? 'Saving...' : 'Save Question Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD QUESTION TO SECTION MODAL */}
      {showAddFieldModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Add New Question to Section
                  </h2>
                  <p className="text-xs text-slate-400">
                    Add a new checkpoint directly into <span className="font-bold text-slate-600 dark:text-slate-200">{activeStage.title}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFieldModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewFieldToSection} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question / Checkpoint Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="e.g. MCCB Breaking Capacity / Make"
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Answer Format / Type
                  </label>
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  >
                    <option value="select">🔘 Select from Dropdown List</option>
                    <option value="text">📝 Short Text Input</option>
                    <option value="textarea">📄 Multi-line Detailed Remarks</option>
                    <option value="number">🔢 Number / Measurement Value</option>
                    <option value="date">📅 Calendar Date</option>
                    <option value="boolean">🔘 Yes / No Switch</option>
                    <option value="photo">📷 Photo Attachment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unit / Suffix (Optional)
                  </label>
                  <input
                    type="text"
                    value={newFieldUnit}
                    onChange={(e) => setNewFieldUnit(e.target.value)}
                    placeholder="e.g. A, V, kVA, mm"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* If dropdown type: allow entering initial choices */}
              {(newFieldType === 'select' || newFieldType === 'searchable_select') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Dropdown Choices (Comma or new-line separated)
                  </label>
                  <textarea
                    rows={3}
                    value={newFieldChoices}
                    onChange={(e) => setNewFieldChoices(e.target.value)}
                    placeholder="e.g. Siemens 630A, ABB 800A, Schneider 1000A, L&T 400A"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none resize-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddFieldModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingField}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isAddingField ? 'Adding...' : 'Add Question to Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

