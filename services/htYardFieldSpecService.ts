import { supabase } from './supabase';
import { ModuleSpec, FieldSpec, SectionSpec, CustomFieldSpec, HTMasterCategory, HTFieldType } from '../types/htYard';
import { HT_YARD_FIELD_SPECS } from '../config/htYardFieldSpecs';
import { isOfflineEnabled } from './offline/featureFlag';
import { isOnline } from './offline/networkStatus';

export const CATEGORY_TO_MODULE_MAP: Record<string, string> = {
  'RMUMD': 'RMU',
  'TRMaster Data': 'Transformer',
  'LTKMD': 'LT_Kiosk',
  'VCB': 'VCB',
  'VCBMD': 'VCB',
  'Switchgear': 'Switchgear',
  'HT_Panel': 'HT_Panel',
  'HT Panel': 'HT_Panel',
  'Meter_Cubicle': 'Meter_Cubicle',
  'Meter Cubicle': 'Meter_Cubicle',
  'CSS': 'CSS',
  'Cable Details': 'RMU',
  'HTYardCommon': 'HT_Yard_Common'
};

export const MODULE_TO_CATEGORY_MAP: Record<string, HTMasterCategory> = {
  'RMU': 'RMUMD',
  'Transformer': 'TRMaster Data',
  'LT_Kiosk': 'LTKMD',
  'VCB': 'VCB',
  'Switchgear': 'Switchgear',
  'HT_Panel': 'HT_Panel',
  'Meter_Cubicle': 'Meter_Cubicle',
  'CSS': 'CSS',
  'HT_Yard_Common': 'HTYardCommon'
};

export function resolveCategoryForModule(moduleType: string): HTMasterCategory {
  if (!moduleType) return 'RMUMD';
  if (MODULE_TO_CATEGORY_MAP[moduleType]) return MODULE_TO_CATEGORY_MAP[moduleType];
  const clean = moduleType.replace(/\s+/g, '_');
  if (MODULE_TO_CATEGORY_MAP[clean]) return MODULE_TO_CATEGORY_MAP[clean];
  try {
    const raw = localStorage.getItem('ht_custom_categories');
    if (raw) {
      const cats: string[] = JSON.parse(raw);
      const found = cats.find(c => 
        c.toLowerCase() === moduleType.toLowerCase() || 
        c.toLowerCase() === moduleType.replace(/_/g, ' ').toLowerCase() ||
        c.toLowerCase().replace(/\s+/g, '_') === moduleType.toLowerCase()
      );
      if (found) return found as HTMasterCategory;
    }
  } catch (e) {
    console.debug('Failed to read ht_custom_categories in resolveCategoryForModule', e);
  }
  return moduleType as HTMasterCategory;
}

export const htYardFieldSpecService = {
  // Get all custom field specs for a category
  async getCustomFieldSpecs(category: HTMasterCategory): Promise<CustomFieldSpec[]> {
    let dbSpecs: CustomFieldSpec[] = [];

    // 1. Supabase Online Fetch
    if (!isOfflineEnabled() || isOnline()) {
      try {
        const { data, error } = await supabase
          .from('ht_custom_field_specs')
          .select('*')
          .eq('category', category)
          .eq('is_active', true);

        if (!error && data) {
          dbSpecs = data.map((row: any) => ({
            id: row.id,
            category: row.category as HTMasterCategory,
            moduleType: row.module_type,
            sectionKey: row.section_key,
            sectionTitle: row.section_title,
            fieldKey: row.field_key,
            fieldLabel: row.field_label,
            fieldType: row.field_type as HTFieldType,
            optionsCategory: row.options_category,
            optionsFieldKey: row.options_field_key,
            isManufacturerField: row.is_manufacturer_field,
            unit: row.unit,
            placeholder: row.placeholder,
            displayOrder: row.display_order,
            isActive: row.is_active,
            isCustom: row.is_custom,
            parentFieldKey: row.parent_field_key,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
        }
      } catch (err) {
        console.warn('[htYardFieldSpecService] Error fetching custom field specs from Supabase:', err);
      }
    }

    // 2. LocalStorage Fallback & Merge
    let localSpecs: CustomFieldSpec[] = [];
    try {
      const stored = localStorage.getItem(`ht_custom_field_specs_${category}`);
      if (stored) {
        localSpecs = JSON.parse(stored);
      }
    } catch (err) {
      console.debug('Failed to parse localSpecs', err);
    }

    // Merge: DB items take precedence over local, and local over empty
    const map = new Map<string, CustomFieldSpec>();
    localSpecs.forEach(s => map.set(`${s.sectionKey}_${s.fieldKey}`, s));
    dbSpecs.forEach(s => map.set(`${s.sectionKey}_${s.fieldKey}`, s));

    return Array.from(map.values());
  },

  // Save or update a custom field spec (including type conversions)
  async saveFieldSpec(spec: CustomFieldSpec): Promise<CustomFieldSpec> {
    const category = spec.category;
    let existing: CustomFieldSpec[] = [];
    let existingTarget: any = null;
    try {
      existing = await this.getCustomFieldSpecs(category);
      const rawTargets = localStorage.getItem('ht_custom_field_targets');
      const targetsMap = rawTargets ? JSON.parse(rawTargets) : {};
      const catTargets: any[] = targetsMap[category] || [];
      existingTarget = catTargets.find((t: any) => t.key === spec.fieldKey);
    } catch (e) {
      console.debug('Failed to read existing spec during save', e);
    }

    const existingLocal = existing.find(s => s.fieldKey === spec.fieldKey);
    const resolvedParentKey = spec.parentFieldKey !== undefined
      ? (spec.parentFieldKey || undefined)
      : (existingLocal?.parentFieldKey || existingTarget?.parentFieldKey || undefined);

    const payload = {
      category: spec.category,
      module_type: spec.moduleType,
      section_key: spec.sectionKey,
      section_title: spec.sectionTitle,
      field_key: spec.fieldKey,
      field_label: spec.fieldLabel,
      field_type: spec.fieldType || 'text',
      options_category: spec.optionsCategory || spec.category,
      options_field_key: spec.optionsFieldKey || spec.fieldKey,
      is_manufacturer_field: spec.isManufacturerField ?? false,
      unit: spec.unit || null,
      placeholder: spec.placeholder || null,
      display_order: spec.displayOrder ?? 0,
      is_active: spec.isActive ?? true,
      is_custom: spec.isCustom ?? true,
      parent_field_key: resolvedParentKey || null,
      updated_at: new Date().toISOString()
    };

    // 1. Try Supabase Save
    try {
      if (spec.id && !spec.id.startsWith('local-')) {
        const { data, error } = await supabase
          .from('ht_custom_field_specs')
          .update(payload)
          .eq('id', spec.id)
          .select()
          .single();

        if (!error && data) {
          spec = { ...spec, id: data.id, parentFieldKey: resolvedParentKey, updatedAt: data.updated_at };
        }
      } else {
        const { data, error } = await supabase
          .from('ht_custom_field_specs')
          .upsert(payload, { onConflict: 'category,module_type,section_key,field_key' })
          .select()
          .single();

        if (!error && data) {
          spec = { ...spec, id: data.id, parentFieldKey: resolvedParentKey, updatedAt: data.updated_at };
        }
      }
    } catch (e) {
      console.warn('[htYardFieldSpecService] Supabase save failed, saving to local mirror', e);
    }

    // 2. Save to LocalStorage mirror
    try {
      const newId = spec.id || `local-fspec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const updatedItem = { ...spec, parentFieldKey: resolvedParentKey, id: newId };
      const filtered = existing.filter(s => s.fieldKey !== spec.fieldKey);
      filtered.push(updatedItem);
      localStorage.setItem(`ht_custom_field_specs_${category}`, JSON.stringify(filtered));

      // Also ensure standard target key mapping is updated
      const rawTargets = localStorage.getItem('ht_custom_field_targets');
      const targetsMap = rawTargets ? JSON.parse(rawTargets) : {};
      const catTargets: any[] = targetsMap[category] || [];
      const targetIdx = catTargets.findIndex((t: any) => t.key === spec.fieldKey);
      if (targetIdx >= 0) {
        catTargets[targetIdx] = {
          ...catTargets[targetIdx],
          label: spec.fieldLabel,
          section: spec.sectionTitle,
          parentFieldKey: resolvedParentKey
        };
      } else {
        catTargets.push({
          key: spec.fieldKey,
          label: spec.fieldLabel,
          section: spec.sectionTitle,
          parentFieldKey: resolvedParentKey
        });
      }
      targetsMap[category] = catTargets;
      localStorage.setItem('ht_custom_field_targets', JSON.stringify(targetsMap));
    } catch (err) {
      console.debug('Failed to update ht_custom_field_targets', err);
    }

    // Dispatch global event for live reactive update across components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { spec } }));
    }

    return spec;
  },

  // Delete or deactivate a field spec
  async deleteFieldSpec(category: HTMasterCategory, fieldKey: string, sectionKey: string): Promise<boolean> {
    try {
      await supabase
        .from('ht_custom_field_specs')
        .update({ is_active: false })
        .eq('category', category)
        .eq('field_key', fieldKey);
    } catch (err) {
      console.debug('Failed to deactivate field spec in DB', err);
    }

    try {
      const existing = await this.getCustomFieldSpecs(category);
      const updated = existing.filter(s => s.fieldKey !== fieldKey);
      localStorage.setItem(`ht_custom_field_specs_${category}`, JSON.stringify(updated));
    } catch (err) {
      console.debug('Failed to update local field specs', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, fieldKey, sectionKey } }));
    }

    return true;
  },

  // Get custom sections for a category
  getCustomSections(category: HTMasterCategory): { sectionKey: string; title: string }[] {
    try {
      const raw = localStorage.getItem(`ht_custom_sections_${category}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Save or create a new section for a category
  async saveSection(category: HTMasterCategory, title: string, sectionKey?: string): Promise<{ sectionKey: string; title: string }> {
    const cleanTitle = title.trim();
    const cleanKey = sectionKey || `custom_sec_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    try {
      const customRaw = localStorage.getItem(`ht_custom_sections_${category}`);
      const customList: { sectionKey: string; title: string }[] = customRaw ? JSON.parse(customRaw) : [];
      const existingIdx = customList.findIndex(c => c.sectionKey === cleanKey || c.title.toLowerCase() === cleanTitle.toLowerCase());
      if (existingIdx >= 0) {
        customList[existingIdx].title = cleanTitle;
      } else {
        customList.push({ sectionKey: cleanKey, title: cleanTitle });
      }
      localStorage.setItem(`ht_custom_sections_${category}`, JSON.stringify(customList));

      // If it was in hidden sections list, unhide it
      const rawHidden = localStorage.getItem(`ht_hidden_sections_${category}`);
      if (rawHidden) {
        const hiddenList: string[] = JSON.parse(rawHidden);
        const filtered = hiddenList.filter(h => h.toLowerCase() !== cleanKey.toLowerCase() && h.toLowerCase() !== cleanTitle.toLowerCase());
        localStorage.setItem(`ht_hidden_sections_${category}`, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('[htYardFieldSpecService] Error saving section:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, action: 'saveSection', sectionKey: cleanKey, title: cleanTitle } }));
    }
    return { sectionKey: cleanKey, title: cleanTitle };
  },

  // Rename an existing or custom section
  async renameSection(category: HTMasterCategory, oldKeyOrTitle: string, newTitle: string, optionalKey?: string): Promise<boolean> {
    const cleanOld = oldKeyOrTitle.trim();
    const cleanNew = newTitle.trim();
    if (!cleanNew || cleanOld === cleanNew) return true;

    try {
      // 1. Update sectionRenames map
      const renamesRaw = localStorage.getItem(`ht_section_renames_${category}`);
      const renamesMap = renamesRaw ? JSON.parse(renamesRaw) : {};
      renamesMap[cleanOld] = cleanNew;
      if (optionalKey && optionalKey !== cleanOld) {
        renamesMap[optionalKey] = cleanNew;
      }
      localStorage.setItem(`ht_section_renames_${category}`, JSON.stringify(renamesMap));

      // 2. Update custom sections if custom
      const customRaw = localStorage.getItem(`ht_custom_sections_${category}`);
      if (customRaw) {
        const customList: any[] = JSON.parse(customRaw);
        customList.forEach(c => {
          if (c.sectionKey === cleanOld || c.title === cleanOld || (optionalKey && c.sectionKey === optionalKey)) {
            c.title = cleanNew;
          }
        });
        localStorage.setItem(`ht_custom_sections_${category}`, JSON.stringify(customList));
      }

      // 3. Update custom field specs
      const customSpecs = await this.getCustomFieldSpecs(category);
      for (const spec of customSpecs) {
        if (spec.sectionKey === cleanOld || spec.sectionTitle === cleanOld || (optionalKey && spec.sectionKey === optionalKey)) {
          await this.saveFieldSpec({ ...spec, sectionTitle: cleanNew });
        }
      }

      // 4. Update targets in ht_custom_field_targets
      const targetsRaw = localStorage.getItem('ht_custom_field_targets');
      if (targetsRaw) {
        const targetsMap = JSON.parse(targetsRaw);
        if (targetsMap[category]) {
          targetsMap[category].forEach((t: any) => {
            if (t.section === cleanOld || (optionalKey && t.section === optionalKey)) t.section = cleanNew;
          });
          localStorage.setItem('ht_custom_field_targets', JSON.stringify(targetsMap));
        }
      }
    } catch (e) {
      console.warn('[htYardFieldSpecService] Error renaming section:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, action: 'renameSection', old: cleanOld, new: cleanNew } }));
    }
    return true;
  },

  // Duplicate an entire question / checkpoint card with all its follow-up sub-questions (e.g. Fire Extinguishers Unit 2, Unit 3...)
  async duplicateField(
    category: HTMasterCategory,
    moduleType: string,
    sectionKey: string,
    sectionTitle: string,
    sourceField: FieldSpec,
    newLabel?: string
  ): Promise<FieldSpec> {
    const cleanSourceKey = sourceField.key;
    const timestamp = Date.now().toString().slice(-4);
    const newFieldKey = `custom_${cleanSourceKey}_unit_${timestamp}`;
    const finalLabel = newLabel?.trim() || `${sourceField.label} (Unit 2)`;

    // 1. Save duplicate main field
    const newSpec: CustomFieldSpec = {
      category,
      moduleType,
      sectionKey,
      sectionTitle,
      fieldKey: newFieldKey,
      fieldLabel: finalLabel,
      fieldType: sourceField.type || 'select',
      optionsCategory: sourceField.optionsCategory || category,
      optionsFieldKey: sourceField.optionsFieldKey || sourceField.key,
      unit: sourceField.unit,
      placeholder: sourceField.placeholder,
      isCustom: true,
      isActive: true
    };
    await this.saveFieldSpec(newSpec);

    // 2. Clone all sub-questions / subFields attached to this field
    const clonedSubFields: FieldSpec[] = [];
    if (sourceField.subFields && sourceField.subFields.length > 0) {
      for (const sf of sourceField.subFields) {
        const subTimestamp = Date.now().toString().slice(-4) + Math.random().toString(36).substring(2, 5);
        const newSubKey = `sub_${sf.key.replace(/^sub_/, '')}_${subTimestamp}`;
        const subSpec: CustomFieldSpec = {
          category,
          moduleType,
          sectionKey,
          sectionTitle,
          fieldKey: newSubKey,
          fieldLabel: sf.label,
          fieldType: sf.type || 'text',
          optionsCategory: sf.optionsCategory || category,
          optionsFieldKey: sf.optionsFieldKey || sf.key,
          unit: sf.unit,
          placeholder: sf.placeholder,
          parentFieldKey: newFieldKey,
          isCustom: true,
          isActive: true
        };
        await this.saveFieldSpec(subSpec);
        clonedSubFields.push({
          key: newSubKey,
          label: sf.label,
          type: sf.type || 'text',
          unit: sf.unit,
          placeholder: sf.placeholder,
          optionsCategory: sf.optionsCategory || category,
          optionsFieldKey: sf.optionsFieldKey || sf.key,
          parentFieldKey: newFieldKey,
          isCustom: true
        });
      }
    }

    return {
      ...sourceField,
      key: newFieldKey,
      label: finalLabel,
      isCustom: true,
      subFields: clonedSubFields
    };
  },

  // Delete/hide an existing or custom section
  async deleteSection(category: HTMasterCategory, sectionKeyOrTitle: string): Promise<boolean> {
    const clean = sectionKeyOrTitle.trim();
    try {
      // 1. Add to hidden sections
      const raw = localStorage.getItem(`ht_hidden_sections_${category}`);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.some(h => h.toLowerCase() === clean.toLowerCase())) {
        list.push(clean);
      }
      localStorage.setItem(`ht_hidden_sections_${category}`, JSON.stringify(list));

      // 2. Remove from custom sections
      const customRaw = localStorage.getItem(`ht_custom_sections_${category}`);
      if (customRaw) {
        const customList: any[] = JSON.parse(customRaw);
        const updated = customList.filter(c => c.sectionKey.toLowerCase() !== clean.toLowerCase() && c.title.toLowerCase() !== clean.toLowerCase());
        localStorage.setItem(`ht_custom_sections_${category}`, JSON.stringify(updated));
      }

      // 3. Deactivate custom fields in this section
      const customSpecs = await this.getCustomFieldSpecs(category);
      const toDeactivate = customSpecs.filter(s => s.sectionKey.toLowerCase() === clean.toLowerCase() || s.sectionTitle.toLowerCase() === clean.toLowerCase());
      for (const spec of toDeactivate) {
        await this.deleteFieldSpec(category, spec.fieldKey, spec.sectionKey);
      }

      // 4. Remove from ht_custom_field_targets
      const targetsRaw = localStorage.getItem('ht_custom_field_targets');
      if (targetsRaw) {
        const targetsMap = JSON.parse(targetsRaw);
        if (targetsMap[category]) {
          targetsMap[category] = targetsMap[category].filter((t: any) => t.section?.toLowerCase() !== clean.toLowerCase() && t.sectionKey?.toLowerCase() !== clean.toLowerCase());
          localStorage.setItem('ht_custom_field_targets', JSON.stringify(targetsMap));
        }
      }
    } catch (e) {
      console.warn('[htYardFieldSpecService] Error deleting section:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, action: 'deleteSection', section: clean } }));
    }
    return true;
  },

  // Get full merged module spec with baseline specs + custom overrides + newly added fields
  async getMergedModuleSpec(moduleType: string, categoryOverride?: HTMasterCategory): Promise<ModuleSpec> {
    const category = categoryOverride || resolveCategoryForModule(moduleType);
    const baseline = HT_YARD_FIELD_SPECS[moduleType] || HT_YARD_FIELD_SPECS[moduleType.replace(/\s+/g, '_')] || {
      moduleType: moduleType as any,
      title: `${moduleType.replace(/_/g, ' ')} Audit Report`,
      description: `${moduleType.replace(/_/g, ' ')} inspection checklist`,
      repeatsPerSite: true,
      sections: [
        {
          sectionKey: 'equipment_details',
          title: 'Equipment Details',
          fields: [
            { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: category, isManufacturerField: true },
            { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
            { key: 'serial_no', label: '3. Serial No.', type: 'text' },
            { key: 'capacity', label: '4. Capacity / Rating', type: 'select', optionsCategory: category, optionsFieldKey: 'capacity' },
            { key: 'model_no', label: '5. Model No.', type: 'text' }
          ]
        },
        {
          sectionKey: 'equipment_accessories',
          title: 'Equipment Accessories & Relays',
          fields: [
            { key: 'protection_relay', label: '6. Protection Relay Details', type: 'select', optionsCategory: category, optionsFieldKey: 'protection_relay' },
            { key: 'mf_meter', label: '7. Multi Function Meter', type: 'select', optionsCategory: category, optionsFieldKey: 'mf_meter' },
            { key: 'control_mcb', label: '8. Control MCBs', type: 'select', optionsCategory: category, optionsFieldKey: 'control_mcb' },
            { key: 'voltmeter', label: '9. Volt Meter', type: 'select', optionsCategory: category, optionsFieldKey: 'voltmeter' },
            { key: 'ammeter', label: '10. Ammeter', type: 'select', optionsCategory: category, optionsFieldKey: 'ammeter' }
          ]
        },
        {
          sectionKey: 'installation_condition',
          title: 'Installation Condition & Safety',
          fields: [
            { key: 'foundation_cond', label: '11. Condition of Foundation', type: 'select', optionsCategory: category, optionsFieldKey: 'foundation_cond' },
            { key: 'cable_laying', label: '12. Laying of Cables', type: 'select', optionsCategory: category, optionsFieldKey: 'cable_laying' },
            { key: 'body_condition', label: '13. Body Condition', type: 'select', optionsCategory: category, optionsFieldKey: 'body_condition' },
            { key: 'earth_pit_location', label: '14. Earthing Terminals & Grounding', type: 'text' },
            { key: 'labelling', label: '15. Labelling & Danger Board', type: 'select', optionsCategory: category, optionsFieldKey: 'labelling' }
          ]
        },
        {
          sectionKey: 'operation_maintenance',
          title: 'Operation & Maintenance',
          fields: [
            { key: 'door_condition', label: '16. Condition of Doors & Locks', type: 'select', optionsCategory: category, optionsFieldKey: 'door_condition' },
            { key: 'operating_levers', label: '17. Availability of Operating Handles / Levers', type: 'boolean' }
          ]
        }
      ]
    };

    const hiddenSections: string[] = (() => {
      try {
        const raw = localStorage.getItem(`ht_hidden_sections_${category}`);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();

    const sectionRenames: Record<string, string> = (() => {
      try {
        const raw = localStorage.getItem(`ht_section_renames_${category}`);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })();

    const customSectionsList: { sectionKey: string; title: string }[] = (() => {
      try {
        const raw = localStorage.getItem(`ht_custom_sections_${category}`);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();

    // Deep clone baseline, filtering out hidden sections and applying renames
    const mergedSpec: ModuleSpec = {
      ...baseline,
      sections: baseline.sections
        .filter(sec => {
          const isHidden = hiddenSections.some(h => 
            h.toLowerCase() === sec.sectionKey.toLowerCase() || 
            h.toLowerCase() === sec.title.toLowerCase()
          );
          return !isHidden;
        })
        .map(sec => {
          const renamedTitle = sectionRenames[sec.sectionKey] || sectionRenames[sec.title] || sec.title;
          return {
            ...sec,
            title: renamedTitle,
            fields: sec.fields.map(f => ({ ...f, subFields: f.subFields ? [...f.subFields] : [] }))
          };
        })
    };

    // Add registered custom sections if not already present and not hidden
    customSectionsList.forEach(cs => {
      const isHidden = hiddenSections.some(h => 
        h.toLowerCase() === cs.sectionKey.toLowerCase() || 
        h.toLowerCase() === cs.title.toLowerCase()
      );
      if (isHidden) return;
      const renamedTitle = sectionRenames[cs.sectionKey] || sectionRenames[cs.title] || cs.title;
      const existing = mergedSpec.sections.find(s => 
        s.sectionKey.toLowerCase() === cs.sectionKey.toLowerCase() || 
        s.title.toLowerCase() === renamedTitle.toLowerCase()
      );
      if (!existing) {
        mergedSpec.sections.push({
          sectionKey: cs.sectionKey,
          title: renamedTitle,
          fields: []
        });
      }
    });

    // Helper to find or create a section in mergedSpec
    const findOrCreateSection = (sectionNameOrKey?: string): SectionSpec => {
      if (!sectionNameOrKey) {
        return mergedSpec.sections[0] || { sectionKey: 'general', title: 'General', fields: [] };
      }
      const clean = sectionNameOrKey.trim().toLowerCase();
      // 1. Direct sectionKey match
      const byKey = mergedSpec.sections.find(s => s.sectionKey.toLowerCase() === clean);
      if (byKey) return byKey;

      // 2. Direct title match
      const byTitle = mergedSpec.sections.find(s => s.title.toLowerCase() === clean);
      if (byTitle) return byTitle;

      // 3. Substring match
      const bySub = mergedSpec.sections.find(s => 
        s.title.toLowerCase().includes(clean) || 
        clean.includes(s.title.toLowerCase()) ||
        s.sectionKey.toLowerCase().includes(clean.replace(/\s+/g, '_')) ||
        clean.replace(/\s+/g, '_').includes(s.sectionKey.toLowerCase())
      );
      if (bySub) return bySub;

      // Check if section was explicitly hidden
      const isHidden = hiddenSections.some(h => 
        h.toLowerCase() === clean || 
        h.toLowerCase() === clean.replace(/\s+/g, '_')
      );
      if (isHidden) {
        return mergedSpec.sections[0] || { sectionKey: 'general', title: 'General', fields: [] };
      }

      // 4. Create new section
      const newKey = clean.replace(/[^a-z0-9]/g, '_');
      const renamedTitle = sectionRenames[newKey] || sectionRenames[sectionNameOrKey] || sectionNameOrKey;
      const newSec: SectionSpec = {
        sectionKey: newKey,
        title: renamedTitle,
        fields: []
      };
      mergedSpec.sections.push(newSec);
      return newSec;
    };

    // 1. Apply custom field specs overrides across ALL sections
    const customSpecs = await this.getCustomFieldSpecs(category);
    (customSpecs || []).forEach(cs => {
      if (cs.isActive === false) return;

      // Search if field already exists anywhere in any section or subfields
      let foundExisting = false;
      for (const sec of mergedSpec.sections) {
        const existing = sec.fields.find(f => f.key === cs.fieldKey);
        if (existing) {
          existing.label = cs.fieldLabel || existing.label;
          existing.type = cs.fieldType || existing.type;
          existing.unit = cs.unit !== undefined ? cs.unit : existing.unit;
          existing.placeholder = cs.placeholder !== undefined ? cs.placeholder : existing.placeholder;
          existing.optionsCategory = cs.optionsCategory || existing.optionsCategory || category;
          existing.optionsFieldKey = cs.optionsFieldKey || existing.optionsFieldKey || cs.fieldKey;
          if (cs.parentFieldKey) existing.parentFieldKey = cs.parentFieldKey;
          existing.isCustom = true;
          foundExisting = true;
          break;
        }
        for (const parentF of sec.fields) {
          if (parentF.subFields) {
            const existingSub = parentF.subFields.find(sf => sf.key === cs.fieldKey);
            if (existingSub) {
              existingSub.label = cs.fieldLabel || existingSub.label;
              existingSub.type = cs.fieldType || existingSub.type;
              existingSub.unit = cs.unit !== undefined ? cs.unit : existingSub.unit;
              existingSub.placeholder = cs.placeholder !== undefined ? cs.placeholder : existingSub.placeholder;
              existingSub.optionsCategory = cs.optionsCategory || existingSub.optionsCategory || category;
              existingSub.optionsFieldKey = cs.optionsFieldKey || existingSub.optionsFieldKey || cs.fieldKey;
              if (cs.parentFieldKey) existingSub.parentFieldKey = cs.parentFieldKey;
              existingSub.isCustom = true;
              foundExisting = true;
              break;
            }
          }
        }
        if (foundExisting) break;
      }

      // If not found in any existing section, add to target section
      if (!foundExisting) {
        const targetSec = findOrCreateSection(cs.sectionTitle || cs.sectionKey);
        targetSec.fields.push({
          key: cs.fieldKey,
          label: cs.fieldLabel,
          type: cs.fieldType || 'select',
          optionsCategory: cs.optionsCategory || category,
          optionsFieldKey: cs.optionsFieldKey || cs.fieldKey,
          isManufacturerField: cs.isManufacturerField,
          unit: cs.unit,
          placeholder: cs.placeholder,
          parentFieldKey: cs.parentFieldKey,
          isCustom: true
        });
      }
    });

    // 2. Merge user-configured field targets from Master Data Admin (ht_custom_field_targets)
    try {
      const rawTargets = localStorage.getItem('ht_custom_field_targets');
      if (rawTargets) {
        const targetsMap = JSON.parse(rawTargets);
        const catTargets: any[] = targetsMap[category] || [];
        catTargets.forEach(t => {
          if (!t.key) return;
          // Check if field already exists anywhere in mergedSpec
          let exists = false;
          for (const s of mergedSpec.sections) {
            const found = s.fields.find(f => f.key === t.key);
            if (found) {
              if (t.parentFieldKey && !found.parentFieldKey) found.parentFieldKey = t.parentFieldKey;
              exists = true;
              break;
            }
          }
          if (!exists) {
            const targetSec = findOrCreateSection(t.section);
            targetSec.fields.push({
              key: t.key,
              label: t.label,
              type: 'select',
              optionsCategory: category,
              optionsFieldKey: t.key,
              parentFieldKey: t.parentFieldKey,
              isCustom: true
            });
          }
        });
      }
    } catch (e) {
      console.debug('Failed to merge ht_custom_field_targets', e);
    }

    // 3. Build subQuestions / subFields hierarchy for follow-up questions
    mergedSpec.sections.forEach(sec => {
      const allFields = [...sec.fields];
      const fieldMap = new Map<string, FieldSpec>();
      allFields.forEach(f => {
        f.subFields = f.subFields || [];
        fieldMap.set(f.key, f);
      });

      // Also index fields from other sections in case parent is in another section
      mergedSpec.sections.forEach(otherSec => {
        otherSec.fields.forEach(f => {
          if (!fieldMap.has(f.key)) {
            f.subFields = f.subFields || [];
            fieldMap.set(f.key, f);
          }
        });
      });

      const rootFields: FieldSpec[] = [];
      allFields.forEach(f => {
        if (f.parentFieldKey && fieldMap.has(f.parentFieldKey) && f.parentFieldKey !== f.key) {
          const parent = fieldMap.get(f.parentFieldKey)!;
          parent.subFields = parent.subFields || [];
          const existingSubIndex = parent.subFields.findIndex(sf => sf.key === f.key);
          if (existingSubIndex >= 0) {
            parent.subFields[existingSubIndex] = { ...parent.subFields[existingSubIndex], ...f };
          } else {
            parent.subFields.push(f);
          }
        } else if (!f.parentFieldKey) {
          rootFields.push(f);
        }
      });

      // Deduplicate subFields on root fields
      rootFields.forEach(rf => {
        if (rf.subFields && rf.subFields.length > 0) {
          const seenSubKeys = new Set<string>();
          rf.subFields = rf.subFields.filter(sf => {
            if (seenSubKeys.has(sf.key)) return false;
            seenSubKeys.add(sf.key);
            return true;
          });
        }
      });

      sec.fields = rootFields;
    });

    return mergedSpec;
  },

  // Reset all custom overrides for a category back to default baseline
  async resetCategoryFieldSpecs(category: HTMasterCategory): Promise<void> {
    try {
      await supabase
        .from('ht_custom_field_specs')
        .delete()
        .eq('category', category);
    } catch (err) {
      console.debug('Failed to reset field specs in DB', err);
    }

    localStorage.removeItem(`ht_custom_field_specs_${category}`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, reset: true } }));
    }
  }
};
