import { supabase } from './supabase';
import { HTMasterOption, HTMasterCategory } from '../types/htYard';
import { isOfflineEnabled } from './offline/featureFlag';
import { isOnline } from './offline/networkStatus';
import { cacheMasterOptions, getCachedMasterOptions, invalidateMasterOptions } from './offline/cache';

export const htYardMasterDataService = {
  // Fetch options by category and optional manufacturer
  // Fetch options by category and optional manufacturer
  async getMasterOptions(category: HTMasterCategory, manufacturer?: string): Promise<HTMasterOption[]> {
    let dbOptions: HTMasterOption[] = [];

    // ── Online path (fetch from Supabase) ───────────────
    if (!isOfflineEnabled() || isOnline()) {
      try {
        let query = supabase
          .from('ht_master_options')
          .select('*')
          .eq('category', category)
          .eq('is_active', true);

        if (manufacturer) {
          query = query.or(`manufacturer.eq.${manufacturer},manufacturer.is.null`);
        }

        const { data, error } = await query;
        if (!error && data) {
          dbOptions = data.map((item) => ({
            id: item.id,
            category: item.category as HTMasterCategory,
            manufacturer: item.manufacturer,
            fieldKey: item.field_key,
            optionValue: item.option_value,
            isActive: item.is_active,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          }));
          // Write-through: cache the full category result in IDB
          cacheMasterOptions(dbOptions).catch(() => {});
        }
      } catch (err) {
        console.warn('Error fetching Supabase master options:', err);
      }
    }

    // ── Fallback to IDB cache if DB returns empty or offline ──
    if (dbOptions.length === 0 && isOfflineEnabled()) {
      try {
        const cached = await getCachedMasterOptions(category);
        if (cached.length > 0) {
          dbOptions = manufacturer
            ? cached.filter((o) => !o.manufacturer || o.manufacturer === manufacturer)
            : cached;
        }
      } catch {
        /* ignore IDB cache read error */
      }
    }

    // ── Local Storage Fallback items ──
    let localOptions: HTMasterOption[] = [];
    try {
      const stored = localStorage.getItem(`ht_master_options_${category}`);
      if (stored) {
        localOptions = JSON.parse(stored);
      }
    } catch {
      /* ignore localStorage read error */
    }

    // ── Deleted options blacklist ──
    const deletedSet = new Set<string>();
    try {
      const rawDeleted = localStorage.getItem('ht_deleted_master_options');
      if (rawDeleted) {
        const list: string[] = JSON.parse(rawDeleted);
        list.forEach(item => deletedSet.add(item.toLowerCase()));
      }
    } catch {
      /* ignore localStorage read error */
    }

    const isDeleted = (opt: HTMasterOption) => {
      if (opt.isActive === false) return true;
      if (opt.id && deletedSet.has(opt.id.toLowerCase())) return true;
      const valLower = (opt.optionValue || '').trim().toLowerCase();
      if (!valLower) return true;
      if (deletedSet.has(`opt_${valLower}`)) return true;
      if (opt.category && opt.fieldKey && deletedSet.has(`${opt.category}_${opt.fieldKey}_${valLower}`.toLowerCase())) return true;
      if (opt.category && deletedSet.has(`${opt.category}_${valLower}`.toLowerCase())) return true;
      return false;
    };

    // ── Seed items ──
    const seedOptions = getInitialSeedOptions(category, manufacturer);

    // ── Combine & Deduplicate ──
    // Custom/DB/Local items placed FIRST (on top of seed items)
    const combined: HTMasterOption[] = [];
    const seenKeys = new Set<string>();

    const addOption = (opt: HTMasterOption) => {
      if (isDeleted(opt)) return;
      const dedupKey = `${opt.category}_${opt.fieldKey}_${(opt.optionValue || '').trim().toLowerCase()}`;
      if (!seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey);
        combined.push(opt);
      }
    };

    // 1. Newly added / DB / Local options placed ON TOP
    localOptions.forEach(addOption);
    dbOptions.forEach(addOption);

    // 2. Default Seed Options added below
    seedOptions.forEach(addOption);

    return combined;
  },

  // Save or update a master option
  async saveMasterOption(option: Partial<HTMasterOption>): Promise<HTMasterOption | null> {
    const payload = {
      category: option.category,
      manufacturer: option.manufacturer || null,
      field_key: option.fieldKey || 'generic',
      option_value: option.optionValue,
      is_active: option.isActive ?? true
    };

    // Un-blacklist if re-adding this option
    try {
      const rawDeleted = localStorage.getItem('ht_deleted_master_options');
      if (rawDeleted && option.optionValue) {
        const valLower = option.optionValue.trim().toLowerCase();
        const deletedList: string[] = JSON.parse(rawDeleted);
        const filtered = deletedList.filter(item => {
          if (option.id && item.toLowerCase() === option.id.toLowerCase()) return false;
          if (item.toLowerCase() === `opt_${valLower}`) return false;
          if (option.category && item.toLowerCase() === `${option.category}_${valLower}`.toLowerCase()) return false;
          if (option.category && option.fieldKey && item.toLowerCase() === `${option.category}_${option.fieldKey}_${valLower}`.toLowerCase()) return false;
          return true;
        });
        localStorage.setItem('ht_deleted_master_options', JSON.stringify(filtered));
      }
    } catch {
      /* ignore */
    }

    try {
      if (option.id && !option.id.startsWith('seed-') && !option.id.startsWith('local-')) {
        const { data, error } = await supabase
          .from('ht_master_options')
          .update(payload)
          .eq('id', option.id)
          .select()
          .single();
        if (!error && data) {
          // Invalidate IDB cache so next read re-fetches fresh data
          invalidateMasterOptions(data.category).catch(() => {});
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category: data.category, fieldKey: data.field_key } }));
            window.dispatchEvent(new CustomEvent('ht_master_options_updated', { detail: { category: data.category, fieldKey: data.field_key } }));
          }
          return {
            id: data.id,
            category: data.category as HTMasterCategory,
            manufacturer: data.manufacturer,
            fieldKey: data.field_key,
            optionValue: data.option_value,
            isActive: data.is_active
          };
        }
      } else {
        const { data, error } = await supabase
          .from('ht_master_options')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          // Invalidate IDB cache so next read gets the new row
          invalidateMasterOptions(data.category).catch(() => {});
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category: data.category, fieldKey: data.field_key } }));
            window.dispatchEvent(new CustomEvent('ht_master_options_updated', { detail: { category: data.category, fieldKey: data.field_key } }));
          }
          return {
            id: data.id,
            category: data.category as HTMasterCategory,
            manufacturer: data.manufacturer,
            fieldKey: data.field_key,
            optionValue: data.option_value,
            isActive: data.is_active
          };
        }
      }
    } catch (e) {
      console.warn('Supabase save failed, falling back to local storage', e);
    }

    // Local Storage Fallback
    const category = option.category || 'RMUMD';
    const currentOptions = await this.getMasterOptions(category);
    const newId = option.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newOption: HTMasterOption = {
      id: newId,
      category: category,
      manufacturer: option.manufacturer || undefined,
      fieldKey: option.fieldKey || 'generic',
      optionValue: option.optionValue || '',
      isActive: option.isActive ?? true
    };

    const updated = currentOptions.filter(o => o.id !== newId);
    updated.unshift(newOption);
    localStorage.setItem(`ht_master_options_${category}`, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, fieldKey: option.fieldKey } }));
      window.dispatchEvent(new CustomEvent('ht_master_options_updated', { detail: { category, fieldKey: option.fieldKey } }));
    }

    return newOption;
  },

  // Soft & Hard delete option with persistent blacklist across seed, cache, and DB
  async deleteMasterOption(id: string, category?: HTMasterCategory, optionValue?: string, fieldKey?: string): Promise<boolean> {
    try {
      if (id && !id.startsWith('seed-') && !id.startsWith('local-')) {
        await supabase
          .from('ht_master_options')
          .update({ is_active: false })
          .eq('id', id);
        await supabase
          .from('ht_master_options')
          .delete()
          .eq('id', id);
      } else if (optionValue && category) {
        await supabase
          .from('ht_master_options')
          .update({ is_active: false })
          .eq('category', category)
          .eq('option_value', optionValue);
      }
    } catch (e) {
      console.warn('Supabase delete option failed, proceeding with local deletion & blacklist', e);
    }

    // 1. Blacklist in ht_deleted_master_options so seed/local/remote never reappears
    try {
      const rawDeleted = localStorage.getItem('ht_deleted_master_options');
      const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (id && !deletedList.includes(id)) deletedList.push(id);
      if (id && !deletedList.includes(id.toLowerCase())) deletedList.push(id.toLowerCase());

      if (optionValue) {
        const valLower = optionValue.trim().toLowerCase();
        if (category && fieldKey) {
          const sig1 = `${category}_${fieldKey}_${valLower}`;
          if (!deletedList.includes(sig1)) deletedList.push(sig1);
        }
        if (category) {
          const sig2 = `${category}_${valLower}`;
          if (!deletedList.includes(sig2)) deletedList.push(sig2);
        }
        const sig3 = `opt_${valLower}`;
        if (!deletedList.includes(sig3)) deletedList.push(sig3);
      }
      localStorage.setItem('ht_deleted_master_options', JSON.stringify(deletedList));
    } catch (e) {
      console.debug('Failed to update ht_deleted_master_options', e);
    }

    // 2. Remove from LocalStorage caches for this category (or all categories if unspecified)
    const catsToClean: string[] = category
      ? [category]
      : ['RMUMD', 'TRMaster Data', 'LTKMD', 'Cable Details', 'HTYardCommon', 'VCB', 'Switchgear', 'HT_Panel', 'Meter_Cubicle', 'CSS'];

    for (const cat of catsToClean) {
      try {
        const stored = localStorage.getItem(`ht_master_options_${cat}`);
        if (stored) {
          const options: HTMasterOption[] = JSON.parse(stored);
          const updated = options.filter(o => {
            if (id && o.id === id) return false;
            if (optionValue && o.optionValue && o.optionValue.trim().toLowerCase() === optionValue.trim().toLowerCase()) {
              if (fieldKey && o.fieldKey && o.fieldKey !== fieldKey) return true;
              return false;
            }
            return true;
          });
          localStorage.setItem(`ht_master_options_${cat}`, JSON.stringify(updated));
        }
      } catch (err) {
        console.debug('Failed to clean local storage options', err);
      }
    }

    if (category) {
      invalidateMasterOptions(category).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category, fieldKey, optionValue } }));
      window.dispatchEvent(new CustomEvent('ht_master_options_updated', { detail: { category, fieldKey, optionValue } }));
    }

    return true;
  },

  // Reset category or all to initial seed data
  async resetToInitialSeed(category?: HTMasterCategory): Promise<void> {
    const cats: HTMasterCategory[] = category ? [category] : ['RMUMD', 'TRMaster Data', 'LTKMD', 'Cable Details', 'HTYardCommon', 'VCB', 'Switchgear', 'HT_Panel', 'Meter_Cubicle', 'CSS'];
    for (const cat of cats) {
      localStorage.removeItem(`ht_master_options_${cat}`);
    }
    if (!category) {
      localStorage.removeItem('ht_deleted_master_options');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ht_field_specs_updated', { detail: { category } }));
      window.dispatchEvent(new CustomEvent('ht_master_options_updated', { detail: { category } }));
    }
  }
};

// Default seed fallback list extracted from HT_yard.xlsx
function getInitialSeedOptions(category: HTMasterCategory, manufacturer?: string): HTMasterOption[] {
  const seed: HTMasterOption[] = [];

  if (category === 'Cable Details') {
    const rmuCables = [
      '1 R 3Core 400 Sq. mm',
      '1 R 3Core 300 Sq. mm',
      '1 R 3Core 240 Sq. mm',
      '1 R 3Core 185 Sq. mm',
      '1 R 3Core 150 Sq. mm',
      '1 R 3Core 120 Sq. mm',
      '1 R 3Core 95 Sq. mm'
    ];
    rmuCables.forEach((val, idx) => {
      seed.push({ id: `seed-cable-rmu-${idx}`, category: 'Cable Details', fieldKey: 'cable_rating_rmu', optionValue: val, isActive: true });
    });

    const transformerCables = [
      '1 R 3Core 400 Sq. mm',
      '1 R 3Core 300 Sq. mm',
      '1 R 3Core 240 Sq. mm',
      '1 R 3Core 185 Sq. mm',
      '1 R 3Core 150 Sq. mm',
      '1 R 3Core 120 Sq. mm',
      '1 R 3Core 95 Sq. mm',
      '2 R 3.5Core 400 Sq. mm',
      '2 R 3.5Core 300 Sq. mm',
      '2 R 3.5Core 240 Sq. mm',
      '2 R 3.5Core 185 Sq. mm',
      '2 R 3.5Core 150 Sq. mm',
      '2 R 3.5Core 120 Sq. mm',
      '2 R 3.5Core 95 Sq. mm',
      '3 R 3.5Core 400 Sq. mm',
      '3 R 3.5Core 300 Sq. mm',
      '3 R 3.5Core 240 Sq. mm',
      '3 R 3.5Core 185 Sq. mm',
      '3 R 3.5Core 150 Sq. mm',
      '3 R 3.5Core 120 Sq. mm',
      '3 R 3.5Core 95 Sq. mm',
      '4 R 3.5Core 400 Sq. mm',
      '4 R 3.5Core 300 Sq. mm',
      '4 R 3.5Core 240 Sq. mm',
      '4 R 3.5Core 185 Sq. mm',
      '4 R 3.5Core 150 Sq. mm',
      '4 R 3.5Core 120 Sq. mm',
      '4 R 3.5Core 95 Sq. mm'
    ];
    transformerCables.forEach((val, idx) => {
      seed.push({ id: `seed-cable-tr-${idx}`, category: 'Cable Details', fieldKey: 'cable_rating_transformer', optionValue: val, isActive: true });
    });

    const ltKioskCables = [
      '1 R 3.5 Core 400 Sq. mm',
      '1 R 3.5 Core 300 Sq. mm',
      '1 R 3.5 Core 240 Sq. mm',
      '1 R 3.5 Core 185 Sq. mm',
      '1 R 3.5 Core 150 Sq. mm',
      '1 R 3.5 Core 120 Sq. mm',
      '1 R 3.5 Core 95 Sq. mm',
      '2 R 3.5Core 400 Sq. mm',
      '2 R 3.5Core 300 Sq. mm',
      '2 R 3.5Core 240 Sq. mm',
      '2 R 3.5Core 185 Sq. mm',
      '2 R 3.5Core 150 Sq. mm',
      '2 R 3.5Core 120 Sq. mm',
      '2 R 3.5Core 95 Sq. mm',
      '3 R 3.5Core 400 Sq. mm',
      '3 R 3.5Core 300 Sq. mm',
      '3 R 3.5Core 240 Sq. mm',
      '3 R 3.5Core 185 Sq. mm',
      '3 R 3.5Core 150 Sq. mm',
      '3 R 3.5Core 120 Sq. mm',
      '3 R 3.5Core 95 Sq. mm',
      '4 R 3.5Core 400 Sq. mm',
      '4 R 3.5Core 300 Sq. mm',
      '4 R 3.5Core 240 Sq. mm',
      '4 R 3.5Core 185 Sq. mm',
      '4 R 3.5Core 150 Sq. mm',
      '4 R 3.5Core 120 Sq. mm',
      '4 R 3.5Core 95 Sq. mm'
    ];
    ltKioskCables.forEach((val, idx) => {
      seed.push({ id: `seed-cable-ltk-${idx}`, category: 'Cable Details', fieldKey: 'cable_rating_ltkiosk', optionValue: val, isActive: true });
    });
  } else if (category === 'RMUMD') {
    const rmumfrs = [
      'ABB', 'Areva', 'Banavathy Power System Pvt.ltd', 'C & S',
      'Deltacontrol & Switchgears LLP Bangalore', 'Electri Fab',
      'Eswari electricals Pvt. Ltd', 'LUCY Electric india pvt.ltd',
      'Pace Switch gears Pvt Ltd', 'Pristine Engg Services',
      'Schneider', 'Siemens', 'Star Switchgears'
    ];
    rmumfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-rmu-mfr-${idx}`, category: 'RMUMD', fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });

    const noOfWays = ['2 Ways', '3 Ways', '4 Ways', '5 Ways', '6 Ways', '7 Ways'];
    noOfWays.forEach((w, idx) => {
      seed.push({ id: `seed-rmu-ways-${idx}`, category: 'RMUMD', fieldKey: 'no_of_ways', optionValue: w, isActive: true });
    });

    const noOfSections = ['2 nos', '3 nos', '4 nos', '5 nos', '6 nos'];
    noOfSections.forEach((s, idx) => {
      seed.push({ id: `seed-rmu-sections-${idx}`, category: 'RMUMD', fieldKey: 'no_of_sections', optionValue: s, isActive: true });
    });

    const powerIndicators = ['IEC62271-206', 'ANDA-DXN2-T2', 'ANDA-DXN2-T', 'Schneider-IEC61958'];
    powerIndicators.forEach((pi, idx) => {
      seed.push({ id: `seed-rmu-pi-${idx}`, category: 'RMUMD', fieldKey: 'power_indicator', optionValue: pi, isActive: true });
    });

    const protectionRelays = ['C & S', 'C & S- C5DPR-V2', 'C & S-Model C50', 'ASHIDA Numerical', 'C & S- CSDPR-V2-100'];
    protectionRelays.forEach((r, idx) => {
      seed.push({ id: `seed-rmu-relay-${idx}`, category: 'RMUMD', fieldKey: 'protection_relay', optionValue: r, isActive: true });
    });

    const mfMeters = ['Secure', 'Elmeasure EN8400', 'RISH master 3430', 'Schneider EM6400NG', 'Elmeasure-SL1300', 'EAPL'];
    mfMeters.forEach((m, idx) => {
      seed.push({ id: `seed-rmu-mfm-${idx}`, category: 'RMUMD', fieldKey: 'mf_meter', optionValue: m, isActive: true });
    });

    const faultIndicators = ['C & S', 'Siemens, Model SICAM F1', 'EKL1B', 'CGL-31', 'EMG,FKL5000', 'EKL 8002 NG', 'EMG,FKL8000', 'Crompton Greaves'];
    faultIndicators.forEach((fi, idx) => {
      seed.push({ id: `seed-rmu-fi-${idx}`, category: 'RMUMD', fieldKey: 'fault_indicator', optionValue: fi, isActive: true });
    });

    const selectorSwitches = ['Open', 'Neutral', 'Close', 'Local', 'Remote'];
    selectorSwitches.forEach((sw, idx) => {
      seed.push({ id: `seed-rmu-sw-${idx}`, category: 'RMUMD', fieldKey: 'selector_switch', optionValue: sw, isActive: true });
    });

    const lineChargeIndicators = ['Green', 'Red'];
    lineChargeIndicators.forEach((lc, idx) => {
      seed.push({ id: `seed-rmu-lc-${idx}`, category: 'RMUMD', fieldKey: 'line_charge_indicator', optionValue: lc, isActive: true });
    });

    const sf6Statuses = ['Green - Mid level', 'Green - High level', 'Green - Low level', 'Red'];
    sf6Statuses.forEach((sf, idx) => {
      seed.push({ id: `seed-rmu-sf6-${idx}`, category: 'RMUMD', fieldKey: 'sf6_status', optionValue: sf, isActive: true });
    });

    const icOgs = ['From-', 'To-'];
    icOgs.forEach((ic, idx) => {
      seed.push({ id: `seed-rmu-icog-${idx}`, category: 'RMUMD', fieldKey: 'ic_og', optionValue: ic, isActive: true });
    });

    const outgoings = ['Incoming OD 1', 'Outgoing OD 2', 'Outgoing VL1', 'Outgoing VL2', 'Outgoing VL3', 'Outgoing VL4', 'Outgoing VL5'];
    outgoings.forEach((og, idx) => {
      seed.push({ id: `seed-rmu-og-${idx}`, category: 'RMUMD', fieldKey: 'outgoing', optionValue: og, isActive: true });
    });

    const labellings = ['Yes, done', 'Not done', 'Not done properly'];
    labellings.forEach((lbl, idx) => {
      seed.push({ id: `seed-rmu-lbl-${idx}`, category: 'RMUMD', fieldKey: 'labelling', optionValue: lbl, isActive: true });
    });

    const doorConditions = ['Good', 'Damaged', 'Lock Not Working', 'Rusted / Painting Required'];
    doorConditions.forEach((d, idx) => {
      seed.push({ id: `seed-rmu-door-${idx}`, category: 'RMUMD', fieldKey: 'door_condition', optionValue: d, isActive: true });
    });

    const vcbBreakers = ['Star Switchgears', 'C & S', 'ABB', 'Siemens', 'Eswari electricals Pvt. Ltd', 'Schneider', 'Deltacontrol & Switchgears LLP Bangalore', 'Banavathy Power System Pvt.ltd'];
    vcbBreakers.forEach((vcb, idx) => {
      seed.push({ id: `seed-rmu-vcb-${idx}`, category: 'RMUMD', fieldKey: 'vcb_breaker_make', optionValue: vcb, isActive: true });
    });

    const capacities = ['1000 A', '800 A', '630 A', '400 A', '320 A', '200 A', '250 A', '160 A', '125 A', 'Details not available'];
    capacities.forEach((cap, idx) => {
      seed.push({ id: `seed-rmu-cap-${idx}`, category: 'RMUMD', fieldKey: 'capacity', optionValue: cap, isActive: true });
    });

    const masterTripRelays = ['Avana EMR 151'];
    masterTripRelays.forEach((mtr, idx) => {
      seed.push({ id: `seed-rmu-mtr-${idx}`, category: 'RMUMD', fieldKey: 'master_trip_relay', optionValue: mtr, isActive: true });
    });

    const tcSupervisions = ['Avana SPM 003'];
    tcSupervisions.forEach((tc, idx) => {
      seed.push({ id: `seed-rmu-tc-${idx}`, category: 'RMUMD', fieldKey: 'tc_supervision_relay', optionValue: tc, isActive: true });
    });

    const annunciators = ['Minilec MBAS 08', 'Alan MLD-02'];
    annunciators.forEach((ann, idx) => {
      seed.push({ id: `seed-rmu-ann-${idx}`, category: 'RMUMD', fieldKey: 'annunciator', optionValue: ann, isActive: true });
    });

    const trProtectionRelays = ['Avana EMR 261'];
    trProtectionRelays.forEach((tpr, idx) => {
      seed.push({ id: `seed-rmu-tpr-${idx}`, category: 'RMUMD', fieldKey: 'tr_protection_relay', optionValue: tpr, isActive: true });
    });

    const selectorSwitchRelays = ['Telergon GT'];
    selectorSwitchRelays.forEach((ssr, idx) => {
      seed.push({ id: `seed-rmu-ssr-${idx}`, category: 'RMUMD', fieldKey: 'selector_switch_relay', optionValue: ssr, isActive: true });
    });

    const controlMcbs = ['ABB', 'Legrand', 'HPL', 'L & T', 'C & S', 'Schneider', 'Mitsubishi Electric', 'Socomec', 'Havell\'s', 'Siemens'];
    controlMcbs.forEach((mcb, idx) => {
      seed.push({ id: `seed-rmu-mcb-${idx}`, category: 'RMUMD', fieldKey: 'control_mcb', optionValue: mcb, isActive: true });
    });

    const acbBreakers = ['ABB', 'Legrand', 'HPL', 'L & T', 'C & S', 'Schneider', 'Mitsubishi Electric', 'Socomec', 'Havell\'s', 'Siemens'];
    acbBreakers.forEach((acb, idx) => {
      seed.push({ id: `seed-rmu-acb-${idx}`, category: 'RMUMD', fieldKey: 'acb_breaker_make', optionValue: acb, isActive: true });
    });

    const voltmeters = ['Schneider', 'Elmeasure', 'Rish fine'];
    voltmeters.forEach((vm, idx) => {
      seed.push({ id: `seed-rmu-vm-${idx}`, category: 'RMUMD', fieldKey: 'voltmeter', optionValue: vm, isActive: true });
    });

    const powerPacks = ['Alan Model - AAP-230110'];
    powerPacks.forEach((pp, idx) => {
      seed.push({ id: `seed-rmu-pp-${idx}`, category: 'RMUMD', fieldKey: 'power_pack_battery_backup', optionValue: pp, isActive: true });
    });

    const noncContactors = ['ABB', 'Legrand', 'HPL', 'L & T', 'C & S', 'Schneider', 'Mitsubishi Electric', 'Socomec', 'Havell\'s', 'Siemens'];
    noncContactors.forEach((nc, idx) => {
      seed.push({ id: `seed-rmu-nc-${idx}`, category: 'RMUMD', fieldKey: 'nonc_contactor', optionValue: nc, isActive: true });
    });

    const relays1 = ['Jyoti ltd', 'ABB', 'Schneider', 'Osram'];
    relays1.forEach((r1, idx) => {
      seed.push({ id: `seed-rmu-r1-${idx}`, category: 'RMUMD', fieldKey: 'relay_1', optionValue: r1, isActive: true });
    });

    const bodyCond = ['Good', 'Damaged', 'Rusted / Painting Required', 'Minor Scratches'];
    bodyCond.forEach((b, idx) => {
      seed.push({ id: `seed-rmu-body-${idx}`, category: 'RMUMD', fieldKey: 'body_condition', optionValue: b, isActive: true });
    });
  } else if (category === 'TRMaster Data') {
    const trmfrs = [
      'C & S', 'Chetan', 'Chetana', 'Classic', 'ESENN', 'Karnatak',
      'Kiran', 'Kirloskar', 'Nagashr', 'Switch', 'SPS', 'Uni Power',
      'Universal', 'Vijay', 'VMC', 'VOLTE', 'Other'
    ];
    trmfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-tr-mfr-${idx}`, category: 'TRMaster Data', fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });

    const capacities = ['250 KVA', '500 KVA', '630 KVA', '800 KVA', '1000 KVA'];
    capacities.forEach((cap, idx) => {
      seed.push({ id: `seed-tr-cap-${idx}`, category: 'TRMaster Data', fieldKey: 'capacity', optionValue: cap, isActive: true });
    });

    const coilMaterials = ['Aluminum', 'Copper', 'Details not available'];
    coilMaterials.forEach((cm, idx) => {
      seed.push({ id: `seed-tr-cm-${idx}`, category: 'TRMaster Data', fieldKey: 'coil_material', optionValue: cm, isActive: true });
    });

    const oilLevelIndicators = ['Oil level Visible', 'Oil level not clearly Visible'];
    oilLevelIndicators.forEach((oli, idx) => {
      seed.push({ id: `seed-tr-oli-${idx}`, category: 'TRMaster Data', fieldKey: 'oil_level_indicator', optionValue: oli, isActive: true });
    });

    const oilTempIndicators = ['Provided', 'Not provided'];
    oilTempIndicators.forEach((oti, idx) => {
      seed.push({ id: `seed-tr-oti-${idx}`, category: 'TRMaster Data', fieldKey: 'oil_temp_indicator', optionValue: oti, isActive: true });
    });

    const windingTempIndicators = ['Provided', 'Not provided'];
    windingTempIndicators.forEach((wti, idx) => {
      seed.push({ id: `seed-tr-wti-${idx}`, category: 'TRMaster Data', fieldKey: 'winding_temp_indicator', optionValue: wti, isActive: true });
    });

    const prvs = ['Provided', 'Not provided'];
    prvs.forEach((prv, idx) => {
      seed.push({ id: `seed-tr-prv-${idx}`, category: 'TRMaster Data', fieldKey: 'prv', optionValue: prv, isActive: true });
    });

    const drainValves = ['Plug type', 'Gate Valve type'];
    drainValves.forEach((dv, idx) => {
      seed.push({ id: `seed-tr-dv-${idx}`, category: 'TRMaster Data', fieldKey: 'drain_valve', optionValue: dv, isActive: true });
    });

    const tapChangers = ['Auto', 'Manual'];
    tapChangers.forEach((tc, idx) => {
      seed.push({ id: `seed-tr-tc-${idx}`, category: 'TRMaster Data', fieldKey: 'tap_changer', optionValue: tc, isActive: true });
    });

    const tapPositions = ['Position 1', 'Position 2', 'Position 3', 'Position 4', 'Position 5'];
    tapPositions.forEach((tp, idx) => {
      seed.push({ id: `seed-tr-tp-${idx}`, category: 'TRMaster Data', fieldKey: 'tap_position', optionValue: tp, isActive: true });
    });

    const conservatorConds = ['Ok', 'Rusted', 'Painting Required', 'Leakage noticed', 'Painting Required & Leakage noticed'];
    conservatorConds.forEach((cc, idx) => {
      seed.push({ id: `seed-tr-cc-${idx}`, category: 'TRMaster Data', fieldKey: 'conservator_cond', optionValue: cc, isActive: true });
    });

    const explosionVents = ['Provided', 'Not provided'];
    explosionVents.forEach((ev, idx) => {
      seed.push({ id: `seed-tr-ev-${idx}`, category: 'TRMaster Data', fieldKey: 'explosion_vent', optionValue: ev, isActive: true });
    });

    const airBreathers = ['Good condition', 'Not in good condition'];
    airBreathers.forEach((ab, idx) => {
      seed.push({ id: `seed-tr-ab-${idx}`, category: 'TRMaster Data', fieldKey: 'air_breather', optionValue: ab, isActive: true });
    });

    const neutralEarthing = ['Good condition', 'Connections are loose & rusted'];
    neutralEarthing.forEach((ne, idx) => {
      seed.push({ id: `seed-tr-ne-${idx}`, category: 'TRMaster Data', fieldKey: 'neutral_earth_terminals', optionValue: ne, isActive: true });
    });

    const bodyEarthing = ['Yes, done', 'Not done'];
    bodyEarthing.forEach((be, idx) => {
      seed.push({ id: `seed-tr-be-${idx}`, category: 'TRMaster Data', fieldKey: 'body_earth_terminals', optionValue: be, isActive: true });
    });

    const liftingLugs = ['Yes, Okay', 'Not done'];
    liftingLugs.forEach((ll, idx) => {
      seed.push({ id: `seed-tr-ll-${idx}`, category: 'TRMaster Data', fieldKey: 'lifting_lugs', optionValue: ll, isActive: true });
    });

    const foundationConds = ['Good', 'Cracks found'];
    foundationConds.forEach((fc, idx) => {
      seed.push({ id: `seed-tr-fc-${idx}`, category: 'TRMaster Data', fieldKey: 'foundation_cond', optionValue: fc, isActive: true });
    });

    const cableLayings = ['Through Cable Trench', 'Underground', 'Partially Through Cable Trench'];
    cableLayings.forEach((cl, idx) => {
      seed.push({ id: `seed-tr-cl-${idx}`, category: 'TRMaster Data', fieldKey: 'cable_laying', optionValue: cl, isActive: true });
    });

    const incomingFixing = ['Yes, done', 'Not done', 'Not visible'];
    incomingFixing.forEach((inc, idx) => {
      seed.push({ id: `seed-tr-inc-${idx}`, category: 'TRMaster Data', fieldKey: 'incoming_cable_fixing', optionValue: inc, isActive: true });
    });

    const outgoingFixing = ['Ok', 'Not properly fixed'];
    outgoingFixing.forEach((out, idx) => {
      seed.push({ id: `seed-tr-out-${idx}`, category: 'TRMaster Data', fieldKey: 'outgoing_cable_fixing', optionValue: out, isActive: true });
    });

    const glandConds = ['Good', 'Damaged'];
    glandConds.forEach((gc, idx) => {
      seed.push({ id: `seed-tr-gc-${idx}`, category: 'TRMaster Data', fieldKey: 'gland_condition', optionValue: gc, isActive: true });
    });

    const glandEarthing = ['Yes, done', 'Not done', 'Not visible'];
    glandEarthing.forEach((ge, idx) => {
      seed.push({ id: `seed-tr-ge-${idx}`, category: 'TRMaster Data', fieldKey: 'gland_earthing', optionValue: ge, isActive: true });
    });

    const bodyConds = ['Good', 'Rusted', 'Painting Required'];
    bodyConds.forEach((bc, idx) => {
      seed.push({ id: `seed-tr-bc-${idx}`, category: 'TRMaster Data', fieldKey: 'body_condition', optionValue: bc, isActive: true });
    });

    const silicaGels = ['Blue Colour', 'Pink Colour', 'Pinkish White', 'Bluish Pink', 'White color'];
    silicaGels.forEach((sg, idx) => {
      seed.push({ id: `seed-tr-sg-${idx}`, category: 'TRMaster Data', fieldKey: 'silica_gel', optionValue: sg, isActive: true });
    });

    const oilLevels = ['High', 'Mid-level', 'Low-level', 'Not visible'];
    oilLevels.forEach((ol, idx) => {
      seed.push({ id: `seed-tr-oil-${idx}`, category: 'TRMaster Data', fieldKey: 'oil_level', optionValue: ol, isActive: true });
    });

    const oilLeakages = ['No', 'Yes'];
    oilLeakages.forEach((olk, idx) => {
      seed.push({ id: `seed-tr-olk-${idx}`, category: 'TRMaster Data', fieldKey: 'oil_leakage', optionValue: olk, isActive: true });
    });

    const hummingSounds = ['Yes', 'No'];
    hummingSounds.forEach((hs, idx) => {
      seed.push({ id: `seed-tr-hs-${idx}`, category: 'TRMaster Data', fieldKey: 'humming_sound', optionValue: hs, isActive: true });
    });
  } else if (category === 'LTKMD') {
    const ltmfrs = [
      'Balaji Control System', 'Balaji Electro Controls', 'Benaka Switch Gear Pvt.Ltd',
      'Deltacontrol & Switchgears LLP Bangalore', 'Details not available', 'DSK Enterprises',
      'Electro Fab', 'GV Engineer & Controls', 'Hasanamba Power Systems',
      'L & T Switch Gears', 'L & T (India) Private Limited', 'Load Controls Private Devices',
      'M/s. Star Power Control Pvt Ltd', 'MAA Power Controls', 'Mrudani Power Controls',
      'Nikitech Electric', 'Pace Control', 'Pace Switch gears Pvt Ltd',
      'Paras Power Engineer ing PVT.Ltd', 'Power-Pack Engineers & Panel Builders',
      'Power Plus Pvt Ltd', 'RJMS Electricians private limited', 'S Kumar Infratech pvt ltd',
      'S V Kamath Techno Systems', 'Sharav Controls', 'Somnath Controls India Pvt. Ltd',
      'Sun Electro Systems Pvt. Ltd', 'Surya Switch Gears', 'Vajra Controls',
      'VV System & Power Panel Pvt. Ltd.', 'Other'
    ];
    ltmfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-ltk-mfr-${idx}`, category: 'LTKMD', fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });

    const capacities = [
      '1600 A', '1000 A', '800 A', '630 A', '400 A', '320 A',
      '200 A', '250 A', '160 A', '125 A', '100 A', '63 A', 'Details not available'
    ];
    capacities.forEach((cap, idx) => {
      seed.push({ id: `seed-ltk-cap-${idx}`, category: 'LTKMD', fieldKey: 'capacity', optionValue: cap, isActive: true });
    });

    const incomerMccbs = [
      'ABB', 'Legrand', 'HPL', 'L & T', 'C & S', 'Schneider',
      'Mitsubishi Electric', 'Socomec', 'Indo Asia', 'Havell\'s', 'Siemens'
    ];
    incomerMccbs.forEach((mccb, idx) => {
      seed.push({ id: `seed-ltk-mccb-${idx}`, category: 'LTKMD', fieldKey: 'incomer_mccb_make', optionValue: mccb, isActive: true });
    });

    const earthLeakageRelays = [
      'Not provided', 'Elmeasure', 'Conzerv', 'Kapco Electricals',
      'Karthikeya Electricals', 'MECO', 'Nagaba Electricals', 'Prok dv\'s',
      'Rish fine', 'Schneider', 'SVPT', 'Trinity'
    ];
    earthLeakageRelays.forEach((elr, idx) => {
      seed.push({ id: `seed-ltk-elr-${idx}`, category: 'LTKMD', fieldKey: 'earth_leakage_relay', optionValue: elr, isActive: true });
    });

    const elrStatus = ['Working', 'Not Working'];
    elrStatus.forEach((st, idx) => {
      seed.push({ id: `seed-ltk-elr-st-${idx}`, category: 'LTKMD', fieldKey: 'status', parentFieldKey: 'earth_leakage_relay', optionValue: st, isActive: true });
    });

    const voltmeters = ['Schneider', 'Elmeasure'];
    voltmeters.forEach((vm, idx) => {
      seed.push({ id: `seed-ltk-vm-${idx}`, category: 'LTKMD', fieldKey: 'voltmeter', optionValue: vm, isActive: true });
    });

    const ammeters = ['Schneider', 'Elmeasure'];
    ammeters.forEach((am, idx) => {
      seed.push({ id: `seed-ltk-am-${idx}`, category: 'LTKMD', fieldKey: 'ammeter', optionValue: am, isActive: true });
    });

    const mfMeters = ['Schneider', 'Conzerv', 'Elmeasure', 'U-Solar Clean Energy Solutions Pvt. Ltd'];
    mfMeters.forEach((mfm, idx) => {
      seed.push({ id: `seed-ltk-mfm-${idx}`, category: 'LTKMD', fieldKey: 'mf_meter', optionValue: mfm, isActive: true });
    });

    const selectorSwitches = ['L & T', 'Not provided'];
    selectorSwitches.forEach((sw, idx) => {
      seed.push({ id: `seed-ltk-sw-${idx}`, category: 'LTKMD', fieldKey: 'selector_switch_make', optionValue: sw, isActive: true });
    });

    const bescomMasterMeters = ['Yes, Available', 'Not available'];
    bescomMasterMeters.forEach((bmm, idx) => {
      seed.push({ id: `seed-ltk-bmm-${idx}`, category: 'LTKMD', fieldKey: 'bescom_master_meter', optionValue: bmm, isActive: true });
    });

    const ctRatios = ['600/5', '400/5', '800/5', '500/5', '1600/5'];
    ctRatios.forEach((ctr, idx) => {
      seed.push({ id: `seed-ltk-ctr-${idx}`, category: 'LTKMD', fieldKey: 'ct_ratio', optionValue: ctr, isActive: true });
    });

    const ctConstants = ['K=120', 'K=160', 'K=80', 'K=100', 'K=320'];
    ctConstants.forEach((ctc, idx) => {
      seed.push({ id: `seed-ltk-ctc-${idx}`, category: 'LTKMD', fieldKey: 'ct_constant', optionValue: ctc, isActive: true });
    });

    const ctVas = ['3.75', '5', '1'];
    ctVas.forEach((va, idx) => {
      seed.push({ id: `seed-ltk-va-${idx}`, category: 'LTKMD', fieldKey: 'ct_va', optionValue: va, isActive: true });
    });

    const ctCls = ['0.50', '1'];
    ctCls.forEach((cl, idx) => {
      seed.push({ id: `seed-ltk-cl-${idx}`, category: 'LTKMD', fieldKey: 'ct_cl', optionValue: cl, isActive: true });
    });

    const bescomSeals = ['Yes, done', 'Not done'];
    bescomSeals.forEach((bs, idx) => {
      seed.push({ id: `seed-ltk-bs-${idx}`, category: 'LTKMD', fieldKey: 'bescom_seal', optionValue: bs, isActive: true });
    });

    const ctClassifications = ['Cl 0.5'];
    ctClassifications.forEach((ctclass, idx) => {
      seed.push({ id: `seed-ltk-ctclass-${idx}`, category: 'LTKMD', fieldKey: 'ct_classification', optionValue: ctclass, isActive: true });
    });

    const outgoingMccbs = ['Schneider', 'Socomec', 'L & T', 'ABB', 'Mitsubishi Electric', 'Legrand', 'C & S', 'HPL', 'Siemens'];
    outgoingMccbs.forEach((out, idx) => {
      seed.push({ id: `seed-ltk-out-${idx}`, category: 'LTKMD', fieldKey: 'outgoing_mccb_make', optionValue: out, isActive: true });
    });

    const outgoingCapacities = ['125 A', '400 A', '630 A', '160 A', '800 A'];
    outgoingCapacities.forEach((outcap, idx) => {
      seed.push({ id: `seed-ltk-outcap-${idx}`, category: 'LTKMD', fieldKey: 'outgoing_capacity', optionValue: outcap, isActive: true });
    });

    const busCouplers = ['C & S', 'Havell\'s'];
    busCouplers.forEach((bc, idx) => {
      seed.push({ id: `seed-ltk-bc-${idx}`, category: 'LTKMD', fieldKey: 'bus_coupler', optionValue: bc, isActive: true });
    });

    const pfcControllers = ['EPCOS', 'Elmeasure', 'BELUK', 'BLR CXD', 'L & T'];
    pfcControllers.forEach((pfc, idx) => {
      seed.push({ id: `seed-ltk-pfc-${idx}`, category: 'LTKMD', fieldKey: 'pfc_controller', optionValue: pfc, isActive: true });
    });

    const capBankSizes = ['5 KVAR', '10 KVAR', '15 KVAR', '20 KVAR', '30 KVAR', '50 KVAR'];
    capBankSizes.forEach((cbs, idx) => {
      seed.push({ id: `seed-ltk-cbs-${idx}`, category: 'LTKMD', fieldKey: 'cap_bank_sizes', optionValue: cbs, isActive: true });
    });

    const relayTimers = ['Salzer', 'EAPL', 'Selec'];
    relayTimers.forEach((rt, idx) => {
      seed.push({ id: `seed-ltk-rt-${idx}`, category: 'LTKMD', fieldKey: 'relay_timer_lvm', optionValue: rt, isActive: true });
    });
  } else if (category === 'HTYardCommon') {
    const cleanlinessOptions = ['Good / Clean', 'Satisfactory', 'Needs Cleaning', 'Vegetation Overgrowth / Debris', 'Poor'];
    cleanlinessOptions.forEach((val, idx) => {
      seed.push({ id: `seed-yc-${idx}`, category: 'HTYardCommon', fieldKey: 'yard_cleanliness', optionValue: val, isActive: true });
    });
    const fireExtOptions = ['CO2 Type Available & Valid', 'DCP / ABC Powder Type Available & Valid', 'FOAM Type Available', 'Available but Expired', 'Not Available'];
    fireExtOptions.forEach((val, idx) => {
      seed.push({ id: `seed-fe-${idx}`, category: 'HTYardCommon', fieldKey: 'fire_extinguishers', optionValue: val, isActive: true });
    });
  } else if (category === 'VCB' || category === 'VCBMD') {
    const vcbmfrs = ['ABB', 'Siemens', 'Schneider Electric', 'L & T', 'C & S Electric', 'BHEL', 'Crompton Greaves', 'Megawin Switchgear', 'Jyoti Ltd'];
    vcbmfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-vcb-mfr-${idx}`, category: category, fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
    const vcbCapacities = ['630 A', '800 A', '1250 A', '1600 A', '2000 A', '2500 A', '3150 A'];
    vcbCapacities.forEach((cap, idx) => {
      seed.push({ id: `seed-vcb-cap-${idx}`, category: category, fieldKey: 'capacity', optionValue: cap, isActive: true });
    });
    const breakingCapacities = ['13.1 kA', '20 kA', '25 kA', '26.3 kA', '31.5 kA', '40 kA'];
    breakingCapacities.forEach((bc, idx) => {
      seed.push({ id: `seed-vcb-bc-${idx}`, category: category, fieldKey: 'breaking_capacity', optionValue: bc, isActive: true });
    });
    const vcbRelays = ['Schneider Micom P122', 'ABB REF615', 'Siemens 7SJ82', 'C & S C5DPR', 'ASHIDA Numerical Relay', 'L & T CSPR'];
    vcbRelays.forEach((r, idx) => {
      seed.push({ id: `seed-vcb-relay-${idx}`, category: category, fieldKey: 'protection_relay', optionValue: r, isActive: true });
    });
    const tcRelays = ['Alstom XR102', 'ABB SPER 1B1 C4', 'Siemens 7PA26', 'Schneider Micom'];
    tcRelays.forEach((tc, idx) => {
      seed.push({ id: `seed-vcb-tc-${idx}`, category: category, fieldKey: 'tc_supervision_relay', optionValue: tc, isActive: true });
    });
    const masterTrips = ['Alstom VAJH13', 'ABB RXMS1', 'Siemens 7PA30', 'ER High Speed 86'];
    masterTrips.forEach((mt, idx) => {
      seed.push({ id: `seed-vcb-mt-${idx}`, category: category, fieldKey: 'master_trip_relay', optionValue: mt, isActive: true });
    });
    const vcbMeters = ['Schneider EM6400NG', 'Elmeasure EN8400', 'Secure Elite 440', 'Rish Master 3440'];
    vcbMeters.forEach((m, idx) => {
      seed.push({ id: `seed-vcb-mfm-${idx}`, category: category, fieldKey: 'mf_meter', optionValue: m, isActive: true });
    });
    const vcbVoltmeters = ['Rishabh', 'Elmeasure', 'Secure', 'Schneider', 'L & T', 'AE'];
    vcbVoltmeters.forEach((vm, idx) => {
      seed.push({ id: `seed-vcb-vm-${idx}`, category: category, fieldKey: 'voltmeter', optionValue: vm, isActive: true });
    });
    const vcbAmmeters = ['Rishabh', 'Elmeasure', 'Secure', 'Schneider', 'L & T', 'AE'];
    vcbAmmeters.forEach((am, idx) => {
      seed.push({ id: `seed-vcb-am-${idx}`, category: category, fieldKey: 'ammeter', optionValue: am, isActive: true });
    });
    const vcbMcbs = ['Schneider', 'Siemens', 'ABB', 'L & T', 'Legrand', 'C & S'];
    vcbMcbs.forEach((mcb, idx) => {
      seed.push({ id: `seed-vcb-mcb-${idx}`, category: category, fieldKey: 'control_mcb', optionValue: mcb, isActive: true });
    });
    const vcbIndicators = ['ANDA-DXN2', 'Schneider IEC61958', 'EAPL Indication', 'LED Cluster (R-Y-B)'];
    vcbIndicators.forEach((ind, idx) => {
      seed.push({ id: `seed-vcb-ind-${idx}`, category: category, fieldKey: 'power_indicator', optionValue: ind, isActive: true });
    });
    const vacuumStatuses = ['Healthy / Vacuum Intact', 'Pressure Normal', 'Degraded', 'Requires Hi-Pot Test'];
    vacuumStatuses.forEach((vs, idx) => {
      seed.push({ id: `seed-vcb-vs-${idx}`, category: category, fieldKey: 'vacuum_status', optionValue: vs, isActive: true });
    });
    const foundations = ['Good RCC Plinth', 'Minor Cracks', 'Settlement Observed', 'Needs Civil Repair'];
    foundations.forEach((f, idx) => {
      seed.push({ id: `seed-vcb-fnd-${idx}`, category: category, fieldKey: 'foundation_cond', optionValue: f, isActive: true });
    });
    const cableLayings = ['Properly Supported with Trefoil Clamps', 'Directly in Trench', 'Clamping Loose', 'Dressed Properly'];
    cableLayings.forEach((cl, idx) => {
      seed.push({ id: `seed-vcb-cl-${idx}`, category: category, fieldKey: 'cable_laying', optionValue: cl, isActive: true });
    });
    const glandConds = ['Brass Compression Gland with Earth Tag', 'Adequate & Tight', 'Loose Gland', 'Missing Earthing Tag'];
    glandConds.forEach((gc, idx) => {
      seed.push({ id: `seed-vcb-gc-${idx}`, category: category, fieldKey: 'gland_condition', optionValue: gc, isActive: true });
    });
    const bodyConds = ['Good / No Rust', 'Minor Paint Peeling', 'Corrosion Observed', 'IP54 Enclosure Intact'];
    bodyConds.forEach((bc, idx) => {
      seed.push({ id: `seed-vcb-bc-${idx}`, category: category, fieldKey: 'body_condition', optionValue: bc, isActive: true });
    });
    const labellings = ['Yes, Clear Caution & Feeder Name', 'Faded Labels', 'Not Done', 'CEA Danger Board Posted'];
    labellings.forEach((lbl, idx) => {
      seed.push({ id: `seed-vcb-lbl-${idx}`, category: category, fieldKey: 'labelling', optionValue: lbl, isActive: true });
    });
    const doorConds = ['Good / Door Interlock Functioning', 'Gasket Damaged', 'Lock Defective', 'Earthing Jumper Secure'];
    doorConds.forEach((dc, idx) => {
      seed.push({ id: `seed-vcb-dc-${idx}`, category: category, fieldKey: 'door_condition', optionValue: dc, isActive: true });
    });
  } else if (category === 'Switchgear') {
    const swmfrs = ['ABB', 'Siemens', 'Schneider Electric', 'L & T', 'C & S Electric', 'BHEL', 'Pace Switchgear', 'Electri Fab'];
    swmfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-sw-mfr-${idx}`, category: category, fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
    const swCaps = ['630 A', '800 A', '1250 A', '1600 A', '2000 A', '2500 A', '3150 A', '4000 A'];
    swCaps.forEach((cap, idx) => {
      seed.push({ id: `seed-sw-cap-${idx}`, category: category, fieldKey: 'capacity', optionValue: cap, isActive: true });
    });
    const panelNos = ['2 Panels (1 I/C + 1 O/G)', '3 Panels (1 I/C + 2 O/G)', '4 Panels', '5 Panels', '6 Panels'];
    panelNos.forEach((pn, idx) => {
      seed.push({ id: `seed-sw-pn-${idx}`, category: category, fieldKey: 'no_of_panels', optionValue: pn, isActive: true });
    });
    const swRelays = ['ABB REF615', 'Schneider Micom P141', 'Siemens 7SJ85', 'ASHIDA Numerical'];
    swRelays.forEach((r, idx) => {
      seed.push({ id: `seed-sw-relay-${idx}`, category: category, fieldKey: 'protection_relay', optionValue: r, isActive: true });
    });
    const annunciators = ['Minilec', 'Procon', 'Alan', 'EAPL 8-Window', 'EAPL 12-Window'];
    annunciators.forEach((ann, idx) => {
      seed.push({ id: `seed-sw-ann-${idx}`, category: category, fieldKey: 'annunciator', optionValue: ann, isActive: true });
    });
    const selectorSwitches = ['Local / Remote', 'Auto / Manual', 'Trip / Neutral / Close (TNC)', 'Ammeter Selector (OFF-R-Y-B)', 'Voltmeter Selector (OFF-RY-YB-BR)'];
    selectorSwitches.forEach((ss, idx) => {
      seed.push({ id: `seed-sw-ss-${idx}`, category: category, fieldKey: 'selector_switch', optionValue: ss, isActive: true });
    });
    const swMeters = ['Schneider EM6400NG', 'Elmeasure EN8400', 'Secure Elite 440', 'Rish Master 3440'];
    swMeters.forEach((m, idx) => {
      seed.push({ id: `seed-sw-mfm-${idx}`, category: category, fieldKey: 'mf_meter', optionValue: m, isActive: true });
    });
    const swMcbs = ['Schneider', 'Siemens', 'ABB', 'L & T', 'C & S'];
    swMcbs.forEach((mcb, idx) => {
      seed.push({ id: `seed-sw-mcb-${idx}`, category: category, fieldKey: 'control_mcb', optionValue: mcb, isActive: true });
    });
    const swIndicators = ['R-Y-B Phase Lamps Available', 'LED Cluster Indicator', 'Defective Phase Lamp'];
    swIndicators.forEach((ind, idx) => {
      seed.push({ id: `seed-sw-ind-${idx}`, category: category, fieldKey: 'power_indicator', optionValue: ind, isActive: true });
    });
    const foundations = ['Good Condition', 'Level Plinth Foundation', 'Minor Settlement', 'Needs Grouting'];
    foundations.forEach((f, idx) => {
      seed.push({ id: `seed-sw-fnd-${idx}`, category: category, fieldKey: 'foundation_cond', optionValue: f, isActive: true });
    });
    const cableLayings = ['Trench with GI Perforated Tray', 'Direct on Plinth', 'Needs Cable Dressing'];
    cableLayings.forEach((cl, idx) => {
      seed.push({ id: `seed-sw-cl-${idx}`, category: category, fieldKey: 'cable_laying', optionValue: cl, isActive: true });
    });
    const bodyConds = ['Good Powder Coating', 'Corrosion Free', 'Dust Ingress Observed', 'IP4X Verified'];
    bodyConds.forEach((bc, idx) => {
      seed.push({ id: `seed-sw-bc-${idx}`, category: category, fieldKey: 'body_condition', optionValue: bc, isActive: true });
    });
    const earthTerminals = ['Double Earth Connected to Main Grid', 'Single Earth Connected', 'Loose Terminal Connection'];
    earthTerminals.forEach((et, idx) => {
      seed.push({ id: `seed-sw-et-${idx}`, category: category, fieldKey: 'body_earth_terminals', optionValue: et, isActive: true });
    });
    const labellings = ['Mimic Diagram & Feeder Name Done', 'SLD Posted on Panel', 'Labelling Missing'];
    labellings.forEach((lbl, idx) => {
      seed.push({ id: `seed-sw-lbl-${idx}`, category: category, fieldKey: 'labelling', optionValue: lbl, isActive: true });
    });
    const doorConds = ['Interlocked with Breaker / Good Gaskets', 'Defective Key Interlock', 'Smooth Door Hinges'];
    doorConds.forEach((dc, idx) => {
      seed.push({ id: `seed-sw-dc-${idx}`, category: category, fieldKey: 'door_condition', optionValue: dc, isActive: true });
    });
  } else if (category === 'HT_Panel' || category === 'HT Panel') {
    const htmfrs = ['ABB', 'Schneider Electric', 'Siemens', 'L & T', 'C & S Electric', 'Kirloskar', 'Electri Fab'];
    htmfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-ht-mfr-${idx}`, category: category, fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
    const htCaps = ['11 kV / 630 A', '11 kV / 1250 A', '22 kV / 630 A', '33 kV / 1250 A', '33 kV / 2000 A'];
    htCaps.forEach((cap, idx) => {
      seed.push({ id: `seed-ht-cap-${idx}`, category: category, fieldKey: 'capacity', optionValue: cap, isActive: true });
    });
    const breakerTypes = ['VCB (Vacuum Circuit Breaker)', 'SF6 Gas Breaker', 'ACB (Air Circuit Breaker)'];
    breakerTypes.forEach((bt, idx) => {
      seed.push({ id: `seed-ht-bt-${idx}`, category: category, fieldKey: 'breaker_type', optionValue: bt, isActive: true });
    });
    const htRelays = ['Overcurrent & Earth Fault (50/51, 50N/51N)', 'Differential Relay (87)', 'Under/Over Voltage (27/59)', 'Schneider Micom', 'ABB Relion'];
    htRelays.forEach((r, idx) => {
      seed.push({ id: `seed-ht-relay-${idx}`, category: category, fieldKey: 'protection_relay', optionValue: r, isActive: true });
    });
    const masterTrips = ['High Speed Tripping 86 Relay Present', 'Electromechanical 86', 'Integrated Numerical Trip'];
    masterTrips.forEach((mt, idx) => {
      seed.push({ id: `seed-ht-mt-${idx}`, category: category, fieldKey: 'master_trip_relay', optionValue: mt, isActive: true });
    });
    const htMeters = ['Schneider EM6400NG', 'Elmeasure EN8400', 'Secure Elite 440', 'L & T Quasar'];
    htMeters.forEach((m, idx) => {
      seed.push({ id: `seed-ht-mfm-${idx}`, category: category, fieldKey: 'mf_meter', optionValue: m, isActive: true });
    });
    const htMcbs = ['Schneider C60N', 'Siemens 5SY', 'ABB S200', 'L & T Exora'];
    htMcbs.forEach((mcb, idx) => {
      seed.push({ id: `seed-ht-mcb-${idx}`, category: category, fieldKey: 'control_mcb', optionValue: mcb, isActive: true });
    });
    const powerPacks = ['24V DC Power Pack with Float-Boost Charger', '110V DC Battery Bank', '230V AC Direct (No DC Backup)', 'Healthy Battery Condition'];
    powerPacks.forEach((pp, idx) => {
      seed.push({ id: `seed-ht-pp-${idx}`, category: category, fieldKey: 'power_pack_battery_backup', optionValue: pp, isActive: true });
    });
    const htIndicators = ['R-Y-B LED Line Indication', 'Indication Lamps Working', 'Bulb Blown / Needs Replacement'];
    htIndicators.forEach((ind, idx) => {
      seed.push({ id: `seed-ht-ind-${idx}`, category: category, fieldKey: 'power_indicator', optionValue: ind, isActive: true });
    });
    const foundations = ['RCC Channel Base (Level)', 'Plinth Foundation Good', 'Grouting Needed'];
    foundations.forEach((f, idx) => {
      seed.push({ id: `seed-ht-fnd-${idx}`, category: category, fieldKey: 'foundation_cond', optionValue: f, isActive: true });
    });
    const cableLayings = ['Cable Trench with Cover Slabs', 'Cable Trays Clamped', 'Needs Sealing against Rodents'];
    cableLayings.forEach((cl, idx) => {
      seed.push({ id: `seed-ht-cl-${idx}`, category: category, fieldKey: 'cable_laying', optionValue: cl, isActive: true });
    });
    const glandEarthings = ['Brass Glands with 25x3 Copper Earth Strip', 'Double Earthing Verified', 'Earthing Disconnected'];
    glandEarthings.forEach((ge, idx) => {
      seed.push({ id: `seed-ht-ge-${idx}`, category: category, fieldKey: 'gland_earthing', optionValue: ge, isActive: true });
    });
    const bodyConds = ['IP54 Enclosure / Good Condition', 'Clean Interior', 'Rust Spots Near Bottom'];
    bodyConds.forEach((bc, idx) => {
      seed.push({ id: `seed-ht-bc-${idx}`, category: category, fieldKey: 'body_condition', optionValue: bc, isActive: true });
    });
    const earthTerminals = ['2 Distinct Earth Points Connected to Ground Ring', 'Single Earth Only'];
    earthTerminals.forEach((et, idx) => {
      seed.push({ id: `seed-ht-et-${idx}`, category: category, fieldKey: 'body_earth_terminals', optionValue: et, isActive: true });
    });
    const labellings = ['CEA Caution Board Displayed', 'Danger 11kV / 33kV Plate Affixed', 'Feeder Tagged'];
    labellings.forEach((lbl, idx) => {
      seed.push({ id: `seed-ht-lbl-${idx}`, category: category, fieldKey: 'labelling', optionValue: lbl, isActive: true });
    });
    const doorConds = ['Padlockable with Neoprene Gasket', 'Door Earthing Braid Intact', 'Key Available'];
    doorConds.forEach((dc, idx) => {
      seed.push({ id: `seed-ht-dc-${idx}`, category: category, fieldKey: 'door_condition', optionValue: dc, isActive: true });
    });
  } else if (category === 'Meter_Cubicle' || category === 'Meter Cubicle') {
    const mcMfrs = ['ABB', 'Schneider', 'Siemens', 'L & T', 'Secure Meters', 'Visiontek', 'Genus Power', 'Capital Power'];
    mcMfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-mc-mfr-${idx}`, category: category, fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
    const mcCaps = ['11 kV Class', '22 kV Class', '33 kV Class', '11kV / √3 : 110V / √3 PT'];
    mcCaps.forEach((cap, idx) => {
      seed.push({ id: `seed-mc-cap-${idx}`, category: category, fieldKey: 'capacity', optionValue: cap, isActive: true });
    });
    const masterMeters = ['Secure Premier 300 (0.2s Class)', 'L & T ER300P (0.2s Class)', 'Schneider ION7400', 'Genus TOD Meter'];
    masterMeters.forEach((mm, idx) => {
      seed.push({ id: `seed-mc-mm-${idx}`, category: category, fieldKey: 'bescom_master_meter', optionValue: mm, isActive: true });
    });
    const bescomSeals = ['Intact & Serial Number Verified', 'Lead Seal Tampered / Missing', 'Paper Seal Intact', 'Optical Port Sealed'];
    bescomSeals.forEach((bs, idx) => {
      seed.push({ id: `seed-mc-bs-${idx}`, category: category, fieldKey: 'bescom_seal', optionValue: bs, isActive: true });
    });
    const ctRatios = ['10/5 A', '20/5 A', '30/5 A', '50/5 A', '100/5 A', '200/5 A', '300/5 A', '400/5 A'];
    ctRatios.forEach((cr, idx) => {
      seed.push({ id: `seed-mc-cr-${idx}`, category: category, fieldKey: 'ct_ratio', optionValue: cr, isActive: true });
    });
    const ctConstants = ['1.0', '0.5', '0.2S', '0.2'];
    ctConstants.forEach((cc, idx) => {
      seed.push({ id: `seed-mc-cc-${idx}`, category: category, fieldKey: 'ct_constant', optionValue: cc, isActive: true });
    });
    const ctClasses = ['Class 0.2S (Revenue Grade)', 'Class 0.5S', 'Class 0.2', 'Class 0.5'];
    ctClasses.forEach((ccl, idx) => {
      seed.push({ id: `seed-mc-ccl-${idx}`, category: category, fieldKey: 'ct_cl', optionValue: ccl, isActive: true });
    });
    const ctVas = ['5 VA', '10 VA', '15 VA', '30 VA'];
    ctVas.forEach((va, idx) => {
      seed.push({ id: `seed-mc-va-${idx}`, category: category, fieldKey: 'ct_va', optionValue: va, isActive: true });
    });
    const mcMeters = ['Check Meter Present & Synchronized', 'Multi Function Display Ok', 'CT/PT Secondary Connected to TTB'];
    mcMeters.forEach((m, idx) => {
      seed.push({ id: `seed-mc-mfm-${idx}`, category: category, fieldKey: 'mf_meter', optionValue: m, isActive: true });
    });
    const foundations = ['Good Foundation Plinth', 'Vibration Free', 'Water Ingress Protected'];
    foundations.forEach((f, idx) => {
      seed.push({ id: `seed-mc-fnd-${idx}`, category: category, fieldKey: 'foundation_cond', optionValue: f, isActive: true });
    });
    const cableLayings = ['HT Incomer in Conduit / Trench', 'Secondary Wiring Sealed & Shielded'];
    cableLayings.forEach((cl, idx) => {
      seed.push({ id: `seed-mc-cl-${idx}`, category: category, fieldKey: 'cable_laying', optionValue: cl, isActive: true });
    });
    const bodyConds = ['Weatherproof Outdoor Cubicle (IP55)', 'Sealing Holes Intact', 'No Rust'];
    bodyConds.forEach((bc, idx) => {
      seed.push({ id: `seed-mc-bc-${idx}`, category: category, fieldKey: 'body_condition', optionValue: bc, isActive: true });
    });
    const earthTerminals = ['Dual Earth Terminals Connected to Grid', 'Neutral Point Grounded'];
    earthTerminals.forEach((et, idx) => {
      seed.push({ id: `seed-mc-et-${idx}`, category: category, fieldKey: 'body_earth_terminals', optionValue: et, isActive: true });
    });
    const labellings = ['Consumer RR No. & BESCOM Meter ID Displayed', 'Danger Notice Affixed'];
    labellings.forEach((lbl, idx) => {
      seed.push({ id: `seed-mc-lbl-${idx}`, category: category, fieldKey: 'labelling', optionValue: lbl, isActive: true });
    });
    const doorConds = ['Viewing Glass Clean & Intact', 'Padlocked by Utility / BESCOM', 'Double Door Sealed'];
    doorConds.forEach((dc, idx) => {
      seed.push({ id: `seed-mc-dc-${idx}`, category: category, fieldKey: 'door_condition', optionValue: dc, isActive: true });
    });
  } else if (category === 'CSS') {
    const cssMfrs = ['ABB (Compact Secondary Substation)', 'Schneider Electric (Biosco CSS)', 'Siemens', 'L & T', 'Raychem RPG', 'Tavrida Electric'];
    cssMfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-css-mfr-${idx}`, category: category, fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
    const cssCaps = ['250 kVA', '500 kVA', '630 kVA', '750 kVA', '1000 kVA', '1250 kVA', '1500 kVA', '2000 kVA'];
    cssCaps.forEach((cap, idx) => {
      seed.push({ id: `seed-css-cap-${idx}`, category: category, fieldKey: 'capacity', optionValue: cap, isActive: true });
    });
    const coilMaterials = ['Copper Winding (Class F/H)', 'Aluminum Winding (Class F)'];
    coilMaterials.forEach((cm, idx) => {
      seed.push({ id: `seed-css-cm-${idx}`, category: category, fieldKey: 'coil_material', optionValue: cm, isActive: true });
    });
    const sf6Statuses = ['Gas Pressure in Green Zone (Normal)', 'Gas Pressure Low (Alarm)', 'Vacuum RMU Section Healthy'];
    sf6Statuses.forEach((sf, idx) => {
      seed.push({ id: `seed-css-sf-${idx}`, category: category, fieldKey: 'sf6_status', optionValue: sf, isActive: true });
    });
    const cssRelays = ['Numerical OC/EF Relay (Micom / REF615)', 'Integrated Self-Powered Relay (WIC1)'];
    cssRelays.forEach((r, idx) => {
      seed.push({ id: `seed-css-relay-${idx}`, category: category, fieldKey: 'protection_relay', optionValue: r, isActive: true });
    });
    const oilTempIndicators = ['OTI In Range (< 65°C)', 'OTI High', 'WTI Normal', 'Dry Type RTD Sensors Working'];
    oilTempIndicators.forEach((oti, idx) => {
      seed.push({ id: `seed-css-oti-${idx}`, category: category, fieldKey: 'oil_temp_indicator', optionValue: oti, isActive: true });
    });
    const prvs = ['Pressure Relief Valve Normal / No Trip', 'Oil Seepage Observed at PRV'];
    prvs.forEach((prv, idx) => {
      seed.push({ id: `seed-css-prv-${idx}`, category: category, fieldKey: 'prv', optionValue: prv, isActive: true });
    });
    const airBreathers = ['Silica Gel Deep Blue (Dry & Active)', 'Silica Gel Pink (Needs Replacement)', 'Oil Cup Clean & Filled'];
    airBreathers.forEach((ab, idx) => {
      seed.push({ id: `seed-css-ab-${idx}`, category: category, fieldKey: 'air_breather', optionValue: ab, isActive: true });
    });
    const incomerMccbs = ['Schneider ACB / MCCB', 'ABB Emax / Tmax', 'L & T Omega', 'Siemens 3WL'];
    incomerMccbs.forEach((inm, idx) => {
      seed.push({ id: `seed-css-inm-${idx}`, category: category, fieldKey: 'incomer_mccb_make', optionValue: inm, isActive: true });
    });
    const capBanks = ['50 kVAR APFC', '100 kVAR APFC', '150 kVAR APFC', '200 kVAR APFC', '250 kVAR APFC', '300 kVAR APFC'];
    capBanks.forEach((cb, idx) => {
      seed.push({ id: `seed-css-cb-${idx}`, category: category, fieldKey: 'cap_bank_sizes', optionValue: cb, isActive: true });
    });
    const cssMeters = ['Schneider EM6400NG', 'Elmeasure EN8400', 'Secure Elite 440', 'Rishabh 3440'];
    cssMeters.forEach((m, idx) => {
      seed.push({ id: `seed-css-mfm-${idx}`, category: category, fieldKey: 'mf_meter', optionValue: m, isActive: true });
    });
    const cssVoltmeters = ['Rishabh', 'Elmeasure', 'Secure', 'Schneider', 'L & T'];
    cssVoltmeters.forEach((vm, idx) => {
      seed.push({ id: `seed-css-vm-${idx}`, category: category, fieldKey: 'voltmeter', optionValue: vm, isActive: true });
    });
    const cssAmmeters = ['Rishabh', 'Elmeasure', 'Secure', 'Schneider', 'L & T'];
    cssAmmeters.forEach((am, idx) => {
      seed.push({ id: `seed-css-am-${idx}`, category: category, fieldKey: 'ammeter', optionValue: am, isActive: true });
    });
    const cssMcbs = ['Schneider', 'Siemens', 'ABB', 'L & T', 'C & S'];
    cssMcbs.forEach((mcb, idx) => {
      seed.push({ id: `seed-css-mcb-${idx}`, category: category, fieldKey: 'control_mcb', optionValue: mcb, isActive: true });
    });
    const foundations = ['Engineered Concrete Foundation Plinth with Oil Catchment Sump', 'Plinth Level & Drained'];
    foundations.forEach((f, idx) => {
      seed.push({ id: `seed-css-fnd-${idx}`, category: category, fieldKey: 'foundation_cond', optionValue: f, isActive: true });
    });
    const cableLayings = ['Bottom Entry MV / LV Cable Trenches with Fire Stop Sealing', 'Cables Properly Clamped'];
    cableLayings.forEach((cl, idx) => {
      seed.push({ id: `seed-css-cl-${idx}`, category: category, fieldKey: 'cable_laying', optionValue: cl, isActive: true });
    });
    const bodyConds = ['Outdoor Canopy & Galvanized Steel Enclosure (IP54 / Class 10/20)', 'Clean Paint, No Corrosion'];
    bodyConds.forEach((bc, idx) => {
      seed.push({ id: `seed-css-bc-${idx}`, category: category, fieldKey: 'body_condition', optionValue: bc, isActive: true });
    });
    const earthTerminals = ['CSS Internal Copper Ring Bonded to Main Yard Earth Grid', 'Dual Earth Pits Verified'];
    earthTerminals.forEach((et, idx) => {
      seed.push({ id: `seed-css-et-${idx}`, category: category, fieldKey: 'body_earth_terminals', optionValue: et, isActive: true });
    });
    const labellings = ['Complete Single Line Diagram, Danger Caution & Rating Plates Mounted'];
    labellings.forEach((lbl, idx) => {
      seed.push({ id: `seed-css-lbl-${idx}`, category: category, fieldKey: 'labelling', optionValue: lbl, isActive: true });
    });
    const doorConds = ['Ventilation Louvers with Wire Mesh / All 3 Compartment Doors Padlocked'];
    doorConds.forEach((dc, idx) => {
      seed.push({ id: `seed-css-dc-${idx}`, category: category, fieldKey: 'door_condition', optionValue: dc, isActive: true });
    });
  }

  return seed;
}
