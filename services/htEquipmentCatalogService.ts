/**
 * htEquipmentCatalogService.ts
 * Next-Gen Electrical Equipment Master Catalog & Auto-Fill Intelligence Engine.
 * 
 * Provides pre-calibrated engineering specifications for top global & Indian OEMs:
 * - DG Sets: Cummins, Kirloskar (KOEL), Caterpillar (CAT), Mahindra Powerol, Ashok Leyland
 * - RMUs (Ring Main Units): ABB, Schneider Electric, Siemens, Lucy Electric, Eaton
 * - Transformers: Kirloskar, ABB, Siemens, Voltamp, Crompton Greaves (CG), Schneider
 * - HT/LT Breakers: ABB (VD4), Schneider (EasyPact), L&T, Siemens (SION)
 * - LT Kiosks: Standard 4-way, 6-way, 8-way distribution pillars
 */

export interface EquipmentCatalogItem {
  id: string;
  category: 'RMU' | 'TRANSFORMER' | 'LT_KIOSK' | 'DG_SET' | 'HT_PANEL' | 'YARD_COMMON';
  manufacturer: string;
  modelNumber: string;
  modelName: string;
  ratingCapacity: string;       // e.g. "500 kVA", "630 A", "1000 kVA"
  ratedVoltage: string;         // e.g. "415 V", "11 kV", "22 kV", "33 kV"
  ratedCurrent?: string;        // e.g. "695 A", "630 A", "1250 A"
  breakingCapacity?: string;    // e.g. "21 kA / 3s", "25 kA", "31.5 kA"
  insulationMedium?: string;    // e.g. "SF6 Gas (1.4 bar)", "Mineral Oil Class 1", "Vacuum Interrupter", "Cast Resin Class F/H"
  standardLifeSpanYears: number;// e.g. 20, 25, 30
  phases: string;               // e.g. "3-Phase, 4-Wire"
  frequency: string;            // e.g. "50 Hz"
  coolingType?: string;         // e.g. "Liquid Cooled Radiator", "ONAN", "AN/AF", "Natural Air"
  overhaulInterval?: string;    // e.g. "10,000 Hours", "10,000 Operations", "5 Years / DGA Test"
  recommendedIRThreshold?: string; // e.g. "> 1000 MΩ @ 2.5kV", "> 100 MΩ @ 1kV"
  suggestedInspectionNotes?: string;
  customSpecs?: Record<string, string>;
}

export const HT_EQUIPMENT_CATALOG: EquipmentCatalogItem[] = [
  // ─── 1. DIESEL GENERATOR (DG) SETS ──────────────────────────────────────────
  {
    id: 'dg-cummins-500kva',
    category: 'DG_SET',
    manufacturer: 'Cummins India Ltd',
    modelNumber: 'QSK19-G4 (500 kVA)',
    modelName: 'Cummins Powerica 500 kVA Silent DG Set',
    ratingCapacity: '500 kVA / 400 kW',
    ratedVoltage: '415 V',
    ratedCurrent: '695 A',
    standardLifeSpanYears: 20,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz',
    coolingType: 'Radiator Water Cooled (50/50 Glycol)',
    overhaulInterval: '10,000 Running Hours (Top Overhaul at 5,000 Hrs)',
    recommendedIRThreshold: '> 100 MΩ @ 1.0 kV DC',
    suggestedInspectionNotes: 'Verify lube oil 15W40 level, coolant pH (7.5-9.0), 24V DC battery specific gravity (1.240-1.280), and turbocharger axial play.'
  },
  {
    id: 'dg-cummins-250kva',
    category: 'DG_SET',
    manufacturer: 'Cummins India Ltd',
    modelNumber: 'QSL9-G5 (250 kVA)',
    modelName: 'Cummins 250 kVA CPCB II Silent DG Set',
    ratingCapacity: '250 kVA / 200 kW',
    ratedVoltage: '415 V',
    ratedCurrent: '347 A',
    standardLifeSpanYears: 20,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz',
    coolingType: 'Radiator Water Cooled',
    overhaulInterval: '10,000 Running Hours',
    recommendedIRThreshold: '> 100 MΩ @ 1.0 kV DC',
    suggestedInspectionNotes: 'Check fuel filters, V-belt tension, electronic governor actuator, and AMF panel synchronization.'
  },
  {
    id: 'dg-cummins-750kva',
    category: 'DG_SET',
    manufacturer: 'Cummins India Ltd',
    modelNumber: 'KTA38-G5 (750 kVA)',
    modelName: 'Cummins 750 kVA Heavy Duty DG Set',
    ratingCapacity: '750 kVA / 600 kW',
    ratedVoltage: '415 V',
    ratedCurrent: '1043 A',
    standardLifeSpanYears: 22,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz',
    coolingType: 'Heavy Duty Radiator + Heat Exchanger',
    overhaulInterval: '12,000 Running Hours',
    recommendedIRThreshold: '> 150 MΩ @ 1.0 kV DC',
    suggestedInspectionNotes: 'Inspect twin turbochargers, aftercooler core cleanliness, PT fuel pump calibration, and Woodward governor.'
  },
  {
    id: 'dg-cummins-1000kva',
    category: 'DG_SET',
    manufacturer: 'Cummins India Ltd',
    modelNumber: 'KTA50-G3 (1000 kVA)',
    modelName: 'Cummins 1000 kVA Megawatt Prime DG Set',
    ratingCapacity: '1000 kVA / 800 kW',
    ratedVoltage: '415 V',
    ratedCurrent: '1391 A',
    standardLifeSpanYears: 25,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz',
    coolingType: 'High Ambient Remote Radiator',
    overhaulInterval: '15,000 Running Hours',
    recommendedIRThreshold: '> 200 MΩ @ 1.0 kV DC',
    suggestedInspectionNotes: 'Check 16-cylinder V-bank valve lash, dual starter motors, lube oil centrifuge, and vibration damper.'
  },
  {
    id: 'dg-cummins-125kva',
    category: 'DG_SET',
    manufacturer: 'Cummins India Ltd',
    modelNumber: '6BTAA5.9-G1 (125 kVA)',
    modelName: 'Cummins 125 kVA Compact DG Set',
    ratingCapacity: '125 kVA / 100 kW',
    ratedVoltage: '415 V',
    ratedCurrent: '174 A',
    standardLifeSpanYears: 18,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz',
    coolingType: 'Radiator Cooled',
    overhaulInterval: '8,000 Running Hours',
    recommendedIRThreshold: '> 100 MΩ @ 1.0 kV DC'
  },
  {
    id: 'dg-kirloskar-500kva',
    category: 'DG_SET',
    manufacturer: 'Kirloskar Oil Engines (KOEL)',
    modelNumber: 'KOEL Green DV8G (500 kVA)',
    modelName: 'Kirloskar 500 kVA CPCB II DG Set',
    ratingCapacity: '500 kVA / 400 kW',
    ratedVoltage: '415 V',
    ratedCurrent: '695 A',
    standardLifeSpanYears: 20,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz',
    coolingType: 'Water Cooled',
    overhaulInterval: '10,000 Running Hours',
    recommendedIRThreshold: '> 100 MΩ @ 1.0 kV DC'
  },
  {
    id: 'dg-cat-500kva',
    category: 'DG_SET',
    manufacturer: 'Caterpillar (CAT)',
    modelNumber: 'CAT C15 ACERT (500 kVA)',
    modelName: 'Caterpillar 500 kVA Heavy Industrial DG Set',
    ratingCapacity: '500 kVA / 400 kW',
    ratedVoltage: '415 V',
    ratedCurrent: '695 A',
    standardLifeSpanYears: 25,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz',
    coolingType: 'Air-to-Air Aftercooled (ATAAC) Radiator',
    overhaulInterval: '15,000 Running Hours',
    recommendedIRThreshold: '> 200 MΩ @ 1.0 kV DC'
  },

  // ─── 2. RING MAIN UNITS (RMU) ────────────────────────────────────────────────
  {
    id: 'rmu-abb-safering-11kv-ccv',
    category: 'RMU',
    manufacturer: 'ABB Power Grids',
    modelNumber: 'SafeRing 11kV 630A CCV (2 OD + 1 CB)',
    modelName: 'ABB SafeRing 11kV Compact 3-Way RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '11 kV (Max 12 kV)',
    ratedCurrent: '630 A (Load Break Switch) / 630 A (Vacuum Circuit Breaker)',
    breakingCapacity: '21 kA / 3 sec (52.5 kA Peak)',
    insulationMedium: 'SF6 Gas (Sealed Stainless Steel Tank, 1.4 bar abs)',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    overhaulInterval: 'Maintenance-free sealed tank; 2,000 mechanical operations for VCB',
    recommendedIRThreshold: '> 1000 MΩ @ 2.5 kV DC (Phase-to-Earth & Pole-to-Pole)',
    suggestedInspectionNotes: 'Verify SF6 gas pressure gauge in green band (>1.3 bar), VPIS neon indicators working, earth switch interlocking, and motor charge time <15s.'
  },
  {
    id: 'rmu-abb-safering-11kv-cccv',
    category: 'RMU',
    manufacturer: 'ABB Power Grids',
    modelNumber: 'SafeRing 11kV 630A CCCV (3 OD + 1 CB)',
    modelName: 'ABB SafeRing 11kV Extensible 4-Way RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '11 kV',
    ratedCurrent: '630 A',
    breakingCapacity: '21 kA / 3 sec',
    insulationMedium: 'SF6 Gas (Hermetically Sealed IP67 Tank)',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    recommendedIRThreshold: '> 1000 MΩ @ 2.5 kV DC'
  },
  {
    id: 'rmu-abb-safeplus-22kv',
    category: 'RMU',
    manufacturer: 'ABB Power Grids',
    modelNumber: 'SafePlus 22kV 630A CCV',
    modelName: 'ABB SafePlus 22kV Distribution RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '22 kV (Max 24 kV)',
    ratedCurrent: '630 A',
    breakingCapacity: '20 kA / 3 sec',
    insulationMedium: 'SF6 Gas',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    recommendedIRThreshold: '> 2000 MΩ @ 5.0 kV DC'
  },
  {
    id: 'rmu-abb-safeplus-33kv',
    category: 'RMU',
    manufacturer: 'ABB Power Grids',
    modelNumber: 'SafePlus 33kV 630A (Max 36kV)',
    modelName: 'ABB SafePlus 33kV High Voltage RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '33 kV (Max 36 kV, 170 kV BIL)',
    ratedCurrent: '630 A',
    breakingCapacity: '25 kA / 3 sec',
    insulationMedium: 'SF6 Gas',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    recommendedIRThreshold: '> 5000 MΩ @ 5.0 kV DC'
  },
  {
    id: 'rmu-schneider-rm6-ne-idi',
    category: 'RMU',
    manufacturer: 'Schneider Electric',
    modelNumber: 'RM6 11kV 630A NE-IDI (2 Switch + 1 CB)',
    modelName: 'Schneider Electric RM6 11kV Compact RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '11 kV (Max 12 kV, 75 kVp BIL)',
    ratedCurrent: '630 A',
    breakingCapacity: '21 kA / 3 sec',
    insulationMedium: 'SF6 Gas (Sealed for Life Stainless Steel Tank)',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    recommendedIRThreshold: '> 1000 MΩ @ 2.5 kV DC',
    suggestedInspectionNotes: 'Inspect manometer temperature compensated dial, VIP400 / VIP410 self-powered protection relay, and capacitive voltage divider.'
  },
  {
    id: 'rmu-schneider-fbx',
    category: 'RMU',
    manufacturer: 'Schneider Electric',
    modelNumber: 'FBX-C 11kV 630A Extensible',
    modelName: 'Schneider FBX 11kV Modular RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '11 kV',
    ratedCurrent: '630 A',
    breakingCapacity: '25 kA / 3 sec',
    insulationMedium: 'SF6 Gas Tank with Vacuum Breaker',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz'
  },
  {
    id: 'rmu-siemens-8djh-11kv',
    category: 'RMU',
    manufacturer: 'Siemens AG',
    modelNumber: '8DJH 11kV 630A (RRT / RRE)',
    modelName: 'Siemens 8DJH 11kV Gas-Insulated RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '11 kV (Max 12 kV, 75 kV BIL)',
    ratedCurrent: '630 A',
    breakingCapacity: '20 kA / 3 sec (50 kA Peak)',
    insulationMedium: 'SF6 Gas Hermetically Welded Tank / Clean Air Option',
    standardLifeSpanYears: 35,
    phases: '3-Phase',
    frequency: '50 Hz',
    recommendedIRThreshold: '> 1000 MΩ @ 2.5 kV DC'
  },
  {
    id: 'rmu-lucy-sabre-vrn2a',
    category: 'RMU',
    manufacturer: 'Lucy Electric',
    modelNumber: 'Sabre VRN2a 11kV 630A',
    modelName: 'Lucy Electric Sabre 11kV Vacuum RMU',
    ratingCapacity: '630 A',
    ratedVoltage: '11 kV',
    ratedCurrent: '630 A',
    breakingCapacity: '21 kA / 3 sec',
    insulationMedium: 'Vacuum Interrupter in SF6 Enclosure',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz'
  },

  // ─── 3. DISTRIBUTION & POWER TRANSFORMERS ───────────────────────────────────
  {
    id: 'tx-kirloskar-1000kva-oil',
    category: 'TRANSFORMER',
    manufacturer: 'Kirloskar Electric Co.',
    modelNumber: '1000 kVA 11kV/433V (Dyn11, ONAN)',
    modelName: 'Kirloskar 1000 kVA Oil Immersed Distribution Transformer',
    ratingCapacity: '1000 kVA',
    ratedVoltage: '11 kV / 433 V',
    ratedCurrent: 'HV: 52.49 A / LV: 1333.37 A',
    insulationMedium: 'Mineral Transformer Oil Class 1 (IS 335) ~950 Liters',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    coolingType: 'ONAN (Oil Natural Air Natural)',
    overhaulInterval: 'Annual Oil BDV & DGA screening; 5-Year Overhaul',
    recommendedIRThreshold: 'HV-LV: > 1000 MΩ, HV-Earth: > 1000 MΩ, LV-Earth: > 100 MΩ @ 2.5kV DC',
    suggestedInspectionNotes: 'Verify Oil BDV > 50 kV, moisture < 15 ppm, silica gel blue color (>75%), Buchholz relay gas collection chamber empty, and no radiator fin leaks.'
  },
  {
    id: 'tx-kirloskar-500kva-oil',
    category: 'TRANSFORMER',
    manufacturer: 'Kirloskar Electric Co.',
    modelNumber: '500 kVA 11kV/433V (Dyn11, ONAN)',
    modelName: 'Kirloskar 500 kVA Oil Immersed Distribution Transformer',
    ratingCapacity: '500 kVA',
    ratedVoltage: '11 kV / 433 V',
    ratedCurrent: 'HV: 26.24 A / LV: 666.68 A',
    insulationMedium: 'Mineral Transformer Oil ~550 Liters',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    coolingType: 'ONAN',
    recommendedIRThreshold: '> 800 MΩ @ 2.5 kV DC'
  },
  {
    id: 'tx-abb-1500kva-oil',
    category: 'TRANSFORMER',
    manufacturer: 'ABB India / Hitachi Energy',
    modelNumber: '1500 kVA 11kV/433V (Dyn11, ONAN)',
    modelName: 'ABB 1500 kVA Industrial Transformer',
    ratingCapacity: '1500 kVA',
    ratedVoltage: '11 kV / 433 V',
    ratedCurrent: 'HV: 78.73 A / LV: 2000.06 A',
    insulationMedium: 'Mineral Transformer Oil ~1350 Liters',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    coolingType: 'ONAN',
    recommendedIRThreshold: '> 1500 MΩ @ 2.5 kV DC'
  },
  {
    id: 'tx-schneider-1000kva-dry',
    category: 'TRANSFORMER',
    manufacturer: 'Schneider Electric / Trihal',
    modelNumber: 'Trihal Cast Resin 1000 kVA 11kV/433V',
    modelName: 'Schneider Trihal 1000 kVA Dry Type Cast Resin Transformer (CRT)',
    ratingCapacity: '1000 kVA',
    ratedVoltage: '11 kV / 433 V',
    ratedCurrent: 'HV: 52.49 A / LV: 1333.37 A',
    insulationMedium: 'Epoxy Resin Cast (Class F / Class H 90°C rise)',
    standardLifeSpanYears: 25,
    phases: '3-Phase',
    frequency: '50 Hz',
    coolingType: 'AN/AF (Air Natural / Air Forced with cooling fans)',
    recommendedIRThreshold: 'HV-Earth: > 2000 MΩ, LV-Earth: > 500 MΩ @ 2.5kV DC',
    suggestedInspectionNotes: 'Fire safe (F1/C2/E2 class). Inspect PT100 temperature sensors in winding coils (Alarm 130°C, Trip 140°C), cooling fan controller, and surface dust accumulation.'
  },
  {
    id: 'tx-voltamp-2000kva-oil',
    category: 'TRANSFORMER',
    manufacturer: 'Voltamp Transformers Ltd',
    modelNumber: '2000 kVA 11kV/433V (Dyn11, ONAN/ONAF)',
    modelName: 'Voltamp 2000 kVA Substation Transformer',
    ratingCapacity: '2000 kVA',
    ratedVoltage: '11 kV / 433 V',
    ratedCurrent: 'HV: 104.97 A / LV: 2666.75 A',
    insulationMedium: 'Mineral Transformer Oil ~1750 Liters',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    coolingType: 'ONAN/ONAF',
    recommendedIRThreshold: '> 2000 MΩ @ 2.5 kV DC'
  },

  // ─── 4. HT/LT VCB PANELS & CIRCUIT BREAKERS ──────────────────────────────────
  {
    id: 'cb-abb-vd4-11kv',
    category: 'HT_PANEL',
    manufacturer: 'ABB Power Grids',
    modelNumber: 'VD4 11kV 1250A 25kA VCB',
    modelName: 'ABB VD4 11kV Vacuum Circuit Breaker',
    ratingCapacity: '1250 A',
    ratedVoltage: '11 kV (Max 12 kV, 75 kV BIL)',
    ratedCurrent: '1250 A',
    breakingCapacity: '25 kA / 3 sec (62.5 kA Peak)',
    insulationMedium: 'Vacuum Interrupter Bottle in Embedded Resin Pole',
    standardLifeSpanYears: 25,
    phases: '3-Phase',
    frequency: '50 Hz',
    overhaulInterval: '10,000 mechanical operations',
    recommendedIRThreshold: '> 2000 MΩ @ 2.5 kV DC',
    suggestedInspectionNotes: 'Measure contact resistance (< 40 µΩ), vacuum integrity test at 28 kV AC for 1 min, spring charge motor voltage, and auxiliary contacts.'
  },
  {
    id: 'cb-schneider-easypact-11kv',
    category: 'HT_PANEL',
    manufacturer: 'Schneider Electric',
    modelNumber: 'EasyPact EXE 11kV 630A 20kA',
    modelName: 'Schneider EasyPact EXE 11kV Vacuum Breaker',
    ratingCapacity: '630 A',
    ratedVoltage: '11 kV',
    ratedCurrent: '630 A',
    breakingCapacity: '20 kA / 3 sec',
    insulationMedium: 'Vacuum Interrupter',
    standardLifeSpanYears: 25,
    phases: '3-Phase',
    frequency: '50 Hz'
  },
  {
    id: 'cb-lt-wl-11kv',
    category: 'HT_PANEL',
    manufacturer: 'L&T Electrical & Automation',
    modelNumber: 'L&T WL 11kV 1250A 26.3kA VCB',
    modelName: 'L&T WL 11kV Indoor Vacuum Circuit Breaker',
    ratingCapacity: '1250 A',
    ratedVoltage: '11 kV',
    ratedCurrent: '1250 A',
    breakingCapacity: '26.3 kA / 3 sec',
    insulationMedium: 'Vacuum Interrupter',
    standardLifeSpanYears: 25,
    phases: '3-Phase',
    frequency: '50 Hz'
  },

  // ─── 5. LT KIOSKS & DISTRIBUTION PILLARS ────────────────────────────────────
  {
    id: 'kiosk-lt-4way-400a',
    category: 'LT_KIOSK',
    manufacturer: 'Standard Outdoor Kiosk',
    modelNumber: '4-Way 400A LT Feeder Pillar IP55',
    modelName: '400A 4-Way LT Distribution Kiosk Pillar',
    ratingCapacity: '400 A Busbar Rating',
    ratedVoltage: '415 V AC',
    ratedCurrent: '400 A Incomer / 4x 100A-160A Outgoing Feeders',
    breakingCapacity: '35 kA (with HRC Fuses / MCCB)',
    insulationMedium: 'Air Insulated with DMC/SMC Busbar Supports',
    standardLifeSpanYears: 20,
    phases: '3-Phase, 4-Wire (RYBN)',
    frequency: '50 Hz',
    recommendedIRThreshold: '> 50 MΩ @ 1.0 kV DC',
    suggestedInspectionNotes: 'Check busbar torque marks (45 Nm for M10), HRC fuse tight fitment, door rubber gasket weatherproofing (IP55), and earth busbar bonding.'
  },
  {
    id: 'kiosk-lt-6way-630a',
    category: 'LT_KIOSK',
    manufacturer: 'Standard Outdoor Kiosk',
    modelNumber: '6-Way 630A LT Feeder Pillar IP55',
    modelName: '630A 6-Way LT Distribution Kiosk Pillar',
    ratingCapacity: '630 A Busbar Rating',
    ratedVoltage: '415 V AC',
    ratedCurrent: '630 A Incomer / 6x 160A-250A Outgoing Feeders',
    breakingCapacity: '50 kA',
    insulationMedium: 'Air Insulated / FRP Barrier',
    standardLifeSpanYears: 20,
    phases: '3-Phase, 4-Wire',
    frequency: '50 Hz'
  },

  // ─── 6. SUBSTATION YARD INFRASTRUCTURE & HIRA COMPLIANCE PRESETS ───────────
  {
    id: 'yard-std-11kv',
    category: 'YARD_COMMON',
    manufacturer: 'CEA / IS 3043 / CBIP Standard',
    modelNumber: 'CEA Standard 11kV Substation Yard Preset',
    modelName: '11kV/433V Standard Substation Yard Infrastructure',
    ratingCapacity: '11 kV / 433 V Yard (Standard)',
    ratedVoltage: '11 kV',
    standardLifeSpanYears: 30,
    phases: '3-Phase',
    frequency: '50 Hz',
    suggestedInspectionNotes: 'CEA safety regulation compliant yard setup with gravel laying, GI chainlink fencing, danger boards, dual chemical earth pits and fire safety.',
    customSpecs: {
      yard_fencing_height: '2.4 Meters GI Chainlink with 3-strand Razor Barbed Wire',
      jelly_laying: 'Yes',
      caution_board: 'Yes',
      oil_filtration: 'Completed - Moisture < 15 ppm, Acidity 0.03 mg KOH/g',
      bdv_test: 'BDV 62 kV @ 2.5mm gap (Passed > 50 kV standard)',
      yard_cleanliness: 'Satisfactory / Clean',
      fire_extinguishers: 'CO2 4.5kg + DCP 9kg',
      sand_buckets: 'Yes',
      earthing_report: 'Yes',
      ceig_report: 'Yes',
      ceig_approval: 'Yes',
      breaker_test_report: 'Yes',
      calibration_report: 'Yes',
      second_source_status: 'Operational / Dual Incomer Interlocked',
      bescom_feasibility: 'Yes',
      ceig_drawing: 'Yes',
      last_service_report: 'Yes'
    }
  },
  {
    id: 'yard-industrial-33kv',
    category: 'YARD_COMMON',
    manufacturer: 'CEA High Voltage Industrial Standard',
    modelNumber: '33kV Heavy Industrial Switchyard Preset',
    modelName: '33kV/11kV Heavy Industrial Switchyard Infrastructure',
    ratingCapacity: '33 kV / 11 kV Substation Yard',
    ratedVoltage: '33 kV',
    standardLifeSpanYears: 35,
    phases: '3-Phase',
    frequency: '50 Hz',
    suggestedInspectionNotes: 'Heavy industrial outdoor yard with anti-climb fencing, 50L foam trolley, oil soak pit, and dual grid synchronization.',
    customSpecs: {
      yard_fencing_height: '2.8 Meters Galvanized Chainlink with anti-climb topper',
      jelly_laying: 'Yes',
      caution_board: 'Yes',
      oil_filtration: 'Class 1 Mineral Oil Filtration Done (Moisture < 10 ppm)',
      bdv_test: 'BDV 68 kV @ 2.5mm gap (CEA Compliant)',
      yard_cleanliness: 'Satisfactory / Clean',
      fire_extinguishers: 'CO2 9kg + Mechanical Foam 50L Trolley',
      sand_buckets: 'Yes',
      earthing_report: 'Yes',
      ceig_report: 'Yes',
      ceig_approval: 'Yes',
      breaker_test_report: 'Yes',
      calibration_report: 'Yes',
      second_source_status: 'Dual Grid Incomers with Bus Coupler Interlock',
      bescom_feasibility: 'Yes',
      ceig_drawing: 'Yes',
      last_service_report: 'Yes'
    }
  },
  {
    id: 'yard-commercial-campus',
    category: 'YARD_COMMON',
    manufacturer: 'Commercial Tech Park / Hospital Standard',
    modelNumber: 'Tech Park & Commercial HT Yard Preset',
    modelName: 'Commercial Campus / Tech Park HT Yard & CSS Area',
    ratingCapacity: '11 kV Compact CSS & DG Yard',
    ratedVoltage: '11 kV',
    standardLifeSpanYears: 25,
    phases: '3-Phase',
    frequency: '50 Hz',
    suggestedInspectionNotes: 'Urban commercial HT yard with aesthetic perimeter fencing, FM200 / CO2 fire safety, and 100% DG auto-transfer switch backup.',
    customSpecs: {
      yard_fencing_height: '2.4 Meters Security Fencing with Biometric Access Control',
      jelly_laying: 'Yes',
      caution_board: 'Yes',
      oil_filtration: 'Dry Type / Tested Mineral Oil in Sealed Tanks',
      bdv_test: 'BDV 60 kV @ 2.5mm',
      yard_cleanliness: 'Satisfactory / Clean',
      fire_extinguishers: 'CO2 4.5kg + Clean Agent FM200',
      sand_buckets: 'Yes',
      earthing_report: 'Yes',
      ceig_report: 'Yes',
      ceig_approval: 'Yes',
      breaker_test_report: 'Yes',
      calibration_report: 'Yes',
      second_source_status: 'Auto Transfer Switch (ATS) to 100% DG Backup',
      bescom_feasibility: 'Yes',
      ceig_drawing: 'Yes',
      last_service_report: 'Yes'
    }
  }
];

class HTEquipmentCatalogService {
  private customCatalogKey = 'paradigm_ht_custom_catalog';

  /**
   * Search equipment catalog by query and optional module/category
   */
  public searchCatalog(query: string = '', category?: string): EquipmentCatalogItem[] {
    const all = this.getAllModels();
    const q = (query || '').toLowerCase().trim();

    return all.filter((item) => {
      const matchCat = !category || category === 'ALL' || item.category === category || 
        (category === 'RMUMD' && item.category === 'RMU') ||
        (category === 'HT_Yard_Common' && item.category === 'YARD_COMMON') ||
        (category === 'HTYardCommon' && item.category === 'YARD_COMMON');
      if (!matchCat) return false;

      if (!q) return true;
      return (
        item.modelNumber.toLowerCase().includes(q) ||
        item.modelName.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.ratingCapacity.toLowerCase().includes(q) ||
        (item.ratedVoltage && item.ratedVoltage.toLowerCase().includes(q))
      );
    });
  }

  /**
   * Get model details by exact model number or ID
   */
  public getModelDetails(modelIdOrNumber: string): EquipmentCatalogItem | undefined {
    const all = this.getAllModels();
    const clean = modelIdOrNumber.toLowerCase().trim();
    return all.find(
      (m) => m.id.toLowerCase() === clean || 
             m.modelNumber.toLowerCase() === clean ||
             m.modelName.toLowerCase() === clean ||
             m.modelNumber.toLowerCase().includes(clean)
    );
  }

  /**
   * Get all models including custom user-added models
   */
  public getAllModels(): EquipmentCatalogItem[] {
    let customItems: EquipmentCatalogItem[] = [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.customCatalogKey);
        if (raw) {
          customItems = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.warn('Failed to load custom equipment catalog', e);
    }
    return [...HT_EQUIPMENT_CATALOG, ...customItems];
  }

  /**
   * Save a new custom model to catalog
   */
  public saveCustomModel(item: EquipmentCatalogItem): void {
    try {
      const custom = this.getCustomModels();
      const existingIdx = custom.findIndex((c) => c.id === item.id);
      if (existingIdx >= 0) {
        custom[existingIdx] = item;
      } else {
        custom.push(item);
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.customCatalogKey, JSON.stringify(custom));
      }
    } catch (e) {
      console.error('Failed to save custom equipment model', e);
    }
  }

  private getCustomModels(): EquipmentCatalogItem[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.customCatalogKey);
        if (raw) return JSON.parse(raw);
      }
    } catch (err) {
      console.debug('Failed to load custom equipment models', err);
    }
    return [];
  }
}

export const htEquipmentCatalogService = new HTEquipmentCatalogService();
