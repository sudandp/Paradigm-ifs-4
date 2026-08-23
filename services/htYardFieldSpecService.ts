import { supabase } from './supabase';
import { ModuleSpec, FieldSpec, SectionSpec, CustomFieldSpec, HTMasterCategory, HTFieldType } from '../types/htYard';
import { HT_YARD_FIELD_SPECS } from '../config/htYardFieldSpecs';
import { isOfflineEnabled } from './offline/featureFlag';
import { isOnline } from './offline/networkStatus';

export const CATEGORY_TO_MODULE_MAP: Record<string, string> = {
  'RMUMD': 'RMU',
  'TRMaster Data': 'Transformer',
  'LTKMD': 'LT_Kiosk',
  'Cable Details': 'RMU',
  'HTYardCommon': 'HT_Yard_Common'
};

export const MODULE_TO_CATEGORY_MAP: Record<string, HTMasterCategory> = {
  'RMU': 'RMUMD',
  'Transformer': 'TRMaster Data',
  'LT_Kiosk': 'LTKMD',
  'HT_Yard_Common': 'HTYardCommon'
};

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
          spec = { ...spec, id: data.id, updatedAt: data.updated_at };
        }
      } else {
        const { data, error } = await supabase
          .from('ht_custom_field_specs')
          .upsert(payload, { onConflict: 'category,module_type,section_key,field_key' })
          .select()
          .single();

        if (!error && data) {
          spec = { ...spec, id: data.id, updatedAt: data.updated_at };
        }
      }
    } catch (e) {
      console.warn('[htYardFieldSpecService] Supabase save failed, saving to local mirror', e);
    }

    // 2. Save to LocalStorage mirror
    try {
      const category = spec.category;
      const existing = await this.getCustomFieldSpecs(category);
      const newId = spec.id || `local-fspec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const updatedItem = { ...spec, id: newId };
      const filtered = existing.filter(s => !(s.sectionKey === spec.sectionKey && s.fieldKey === spec.fieldKey));
      filtered.push(updatedItem);
      localStorage.setItem(`ht_custom_field_specs_${category}`, JSON.stringify(filtered));

      // Also ensure standard target key mapping is updated
      const rawTargets = localStorage.getItem('ht_custom_field_targets');
      const targetsMap = rawTargets ? JSON.parse(rawTargets) : {};
      const catTargets: any[] = targetsMap[category] || [];
      if (!catTargets.some((t: any) => t.key === spec.fieldKey)) {
        catTargets.push({ key: spec.fieldKey, label: spec.fieldLabel, section: spec.sectionTitle });
        targetsMap[category] = catTargets;
        localStorage.setItem('ht_custom_field_targets', JSON.stringify(targetsMap));
      }
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
        .eq('field_key', fieldKey)
        .eq('section_key', sectionKey);
    } catch (err) {
      console.debug('Failed to deactivate field spec in DB', err);
    }

    try {
      const existing = await this.getCustomFieldSpecs(category);
      const updated = existing.filter(s => !(s.fieldKey === fieldKey && s.sectionKey === sectionKey));
      localStorage.setItem(`ht_custom_field_specs_${category}`, JSON.stringify(updated));
    } catch (err) {
      console.debug('Failed to update local field specs', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, fieldKey, sectionKey } }));
    }

    return true;
  },

  // Get full merged module spec with baseline specs + custom overrides + newly added fields
  async getMergedModuleSpec(moduleType: string, categoryOverride?: HTMasterCategory): Promise<ModuleSpec> {
    const category = categoryOverride || MODULE_TO_CATEGORY_MAP[moduleType] || 'RMUMD';
    const baseline = HT_YARD_FIELD_SPECS[moduleType] || {
      moduleType: moduleType as any,
      title: `${moduleType} Audit`,
      description: `${moduleType} inspection checklist`,
      repeatsPerSite: true,
      sections: []
    };

    // Deep clone baseline to avoid mutating static constant
    const mergedSpec: ModuleSpec = {
      ...baseline,
      sections: baseline.sections.map(sec => ({
        ...sec,
        fields: sec.fields.map(f => ({ ...f }))
      }))
    };

    // Load custom field specs
    const customSpecs = await this.getCustomFieldSpecs(category);
    if (!customSpecs || customSpecs.length === 0) {
      return mergedSpec;
    }

    const sectionMap = new Map<string, SectionSpec>();
    mergedSpec.sections.forEach(sec => sectionMap.set(sec.sectionKey, sec));

    customSpecs.forEach(cs => {
      if (cs.isActive === false) return;

      let targetSection = sectionMap.get(cs.sectionKey);
      if (!targetSection) {
        // If custom section doesn't exist, create it
        targetSection = {
          sectionKey: cs.sectionKey,
          title: cs.sectionTitle || cs.sectionKey,
          fields: []
        };
        mergedSpec.sections.push(targetSection);
        sectionMap.set(cs.sectionKey, targetSection);
      }

      // Check if this field overrides an existing baseline field
      const existingFieldIndex = targetSection.fields.findIndex(f => f.key === cs.fieldKey);
      const convertedField: FieldSpec = {
        key: cs.fieldKey,
        label: cs.fieldLabel,
        type: cs.fieldType,
        optionsCategory: cs.optionsCategory || category,
        optionsFieldKey: cs.optionsFieldKey || cs.fieldKey,
        isManufacturerField: cs.isManufacturerField,
        unit: cs.unit,
        placeholder: cs.placeholder,
        isCustom: true,
        displayOrder: cs.displayOrder
      };

      if (existingFieldIndex >= 0) {
        // Override baseline field with user's customized settings (e.g. type changed from text to select)
        targetSection.fields[existingFieldIndex] = {
          ...targetSection.fields[existingFieldIndex],
          ...convertedField
        };
      } else {
        // Append newly created custom field
        targetSection.fields.push(convertedField);
      }
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
