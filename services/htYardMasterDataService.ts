import { supabase } from './supabase';
import { HTMasterOption, HTMasterCategory } from '../types/htYard';

export const htYardMasterDataService = {
  // Fetch options by category and optional manufacturer
  async getMasterOptions(category: HTMasterCategory, manufacturer?: string): Promise<HTMasterOption[]> {
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
      if (error) {
        console.warn('Fallback to local master options due to error:', error.message);
        return getInitialSeedOptions(category, manufacturer);
      }

      if (!data || data.length === 0) {
        return getInitialSeedOptions(category, manufacturer);
      }

      return data.map((item) => ({
        id: item.id,
        category: item.category as HTMasterCategory,
        manufacturer: item.manufacturer,
        fieldKey: item.field_key,
        optionValue: item.option_value,
        isActive: item.is_active,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
    } catch (err) {
      console.error('Error in getMasterOptions:', err);
      return getInitialSeedOptions(category, manufacturer);
    }
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

    if (option.id) {
      const { data, error } = await supabase
        .from('ht_master_options')
        .update(payload)
        .eq('id', option.id)
        .select()
        .single();
      if (error) throw error;
      return {
        id: data.id,
        category: data.category,
        manufacturer: data.manufacturer,
        fieldKey: data.field_key,
        optionValue: data.option_value,
        isActive: data.is_active
      };
    } else {
      const { data, error } = await supabase
        .from('ht_master_options')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return {
        id: data.id,
        category: data.category,
        manufacturer: data.manufacturer,
        fieldKey: data.field_key,
        optionValue: data.option_value,
        isActive: data.is_active
      };
    }
  },

  // Soft delete option
  async deleteMasterOption(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ht_master_options')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

// Default seed fallback list extracted from HT_yard.xlsx
function getInitialSeedOptions(category: HTMasterCategory, manufacturer?: string): HTMasterOption[] {
  const seed: HTMasterOption[] = [];

  if (category === 'Cable Details') {
    const cableRatings = [
      '1R x 3C x 95 Sq. mm 11 KV ALAR XLPE HT cable',
      '1R x 3C x 240 Sq. mm 11 KV ALAR XLPE HT cable',
      '1R x 3C x 400 Sq. mm 11 KV ALAR XLPE HT cable',
      '3.5C x 300 Sq. mm LT XLPE Aluminium Armoured cable',
      '3.5C x 400 Sq. mm LT XLPE Aluminium Armoured cable',
      '4C x 16 Sq. mm Copper Armoured cable',
      'Other — Specify in Remarks'
    ];
    cableRatings.forEach((val, idx) => {
      seed.push({
        id: `seed-cable-${idx}`,
        category: 'Cable Details',
        fieldKey: 'cable_rating',
        optionValue: val,
        isActive: true
      });
    });
  } else if (category === 'RMUMD') {
    const rmumfrs = ['ABB', 'Schneider', 'Siemens', 'C & S', 'Areva', 'Vyoma', 'Other'];
    rmumfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-rmu-mfr-${idx}`, category: 'RMUMD', fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
    const relays = ['SEPAM Series 10', 'MICOM P122', 'Woodward WIC1', 'C&S CSEB', 'REJ603', 'Other'];
    relays.forEach((r, idx) => {
      seed.push({ id: `seed-rmu-relay-${idx}`, category: 'RMUMD', fieldKey: 'protection_relay', optionValue: r, isActive: true });
    });
    const bodyCond = ['Good', 'Rusted', 'Painting Required', 'Minor Scratches', 'Damaged'];
    bodyCond.forEach((b, idx) => {
      seed.push({ id: `seed-rmu-body-${idx}`, category: 'RMUMD', fieldKey: 'body_condition', optionValue: b, isActive: true });
    });
  } else if (category === 'TRMaster Data') {
    const trmfrs = ['Kirloskar', 'ABB', 'Schneider', 'Raychem', 'Voltamp', 'Prolec', 'Toshiba', 'Other'];
    trmfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-tr-mfr-${idx}`, category: 'TRMaster Data', fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
    const capacities = ['250 kVA', '500 kVA', '750 kVA', '1000 kVA', '1250 kVA', '1500 kVA', '2000 kVA'];
    capacities.forEach((cap, idx) => {
      seed.push({ id: `seed-tr-cap-${idx}`, category: 'TRMaster Data', fieldKey: 'capacity', optionValue: cap, isActive: true });
    });
    const oilLevels = ['Ok / Normal', 'Low - Top up required', 'Leakage noticed', 'Critical Low'];
    oilLevels.forEach((ol, idx) => {
      seed.push({ id: `seed-tr-oil-${idx}`, category: 'TRMaster Data', fieldKey: 'oil_level', optionValue: ol, isActive: true });
    });
  } else if (category === 'LTKMD') {
    const ltmfrs = ['L&T', 'Schneider', 'Siemens', 'ABB', 'C&S', 'Havells', 'Legrand', 'Other'];
    ltmfrs.forEach((mfr, idx) => {
      seed.push({ id: `seed-ltk-mfr-${idx}`, category: 'LTKMD', fieldKey: 'mfr_name', optionValue: mfr, isActive: true });
    });
  }

  return seed;
}
