/**
 * htPpmChecklists.ts
 * Master Planned Preventive Maintenance (PPM) Engineering Checklists.
 * 
 * Standardized across 5 critical engineering frequencies:
 * 1. DAILY (🌅 Operational Vigilance & Visual)
 * 2. WEEKLY (📅 Functional & Consumables Check)
 * 3. MONTHLY (🗓️ Electrical Diagnostic & IR Megger Testing)
 * 4. QUARTERLY (📊 Thermography, Contact Resistance & Mechanical Integrity)
 * 5. YEARLY (🏆 Annual Overhaul, BDV, DGA & Safety Recertification)
 */

export type PPMFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface PPMChecklistItem {
  id: string;
  itemNumber: number;
  taskTitle: string;
  description: string;
  acceptanceCriteria: string;
  inputType: 'BOOLEAN' | 'NUMERIC' | 'TEXT' | 'PHOTO';
  unit?: string;
  minTolerance?: number;
  maxTolerance?: number;
  isMandatory: boolean;
}

export interface PPMCategoryChecklist {
  category: 'RMU' | 'DG_SET' | 'TRANSFORMER' | 'HT_PANEL' | 'LT_KIOSK';
  frequency: PPMFrequency;
  estimatedDurationMinutes: number;
  requiredPPE: string[];
  items: PPMChecklistItem[];
}

export const HT_PPM_CHECKLISTS: PPMCategoryChecklist[] = [
  // ─── 1. RMU (RING MAIN UNIT) CHECKLISTS ────────────────────────────────────
  {
    category: 'RMU',
    frequency: 'DAILY',
    estimatedDurationMinutes: 15,
    requiredPPE: ['Safety Helmet', 'Safety Shoes', 'Safety Glasses'],
    items: [
      {
        id: 'rmu-d-1',
        itemNumber: 1,
        taskTitle: 'SF6 Gas Pressure Verification',
        description: 'Inspect SF6 gas manometer gauge dial on the front panel.',
        acceptanceCriteria: 'Pointer must be securely inside the GREEN nominal band (> 1.35 bar abs at 20°C).',
        inputType: 'BOOLEAN',
        isMandatory: true
      },
      {
        id: 'rmu-d-2',
        itemNumber: 2,
        taskTitle: 'VPIS Voltage Presence Indicators',
        description: 'Observe neon LED blinking indicators on incoming/outgoing feeder bushings.',
        acceptanceCriteria: 'All 3 phases (R, Y, B) blinking actively indicating live busbar status.',
        inputType: 'BOOLEAN',
        isMandatory: true
      },
      {
        id: 'rmu-d-3',
        itemNumber: 3,
        taskTitle: 'Enclosure Cleanliness & Ingress Check',
        description: 'Verify IP54 outdoor kiosk door lock, rubber beading, and ventilation louvers.',
        acceptanceCriteria: 'No water ingress, vermin entry, or excessive dust accumulation.',
        inputType: 'BOOLEAN',
        isMandatory: false
      }
    ]
  },
  {
    category: 'RMU',
    frequency: 'WEEKLY',
    estimatedDurationMinutes: 30,
    requiredPPE: ['Safety Helmet', 'Safety Shoes', 'HT Gloves (11kV Class 2)'],
    items: [
      {
        id: 'rmu-w-1',
        itemNumber: 1,
        taskTitle: 'Auxiliary Control Battery & Charger Voltage',
        description: 'Measure 24V / 110V DC battery bank output voltage supplying the motor charge circuit.',
        acceptanceCriteria: 'Float voltage between 26.8V - 27.6V DC (for 24V system).',
        inputType: 'NUMERIC',
        unit: 'V DC',
        minTolerance: 24.0,
        maxTolerance: 28.5,
        isMandatory: true
      },
      {
        id: 'rmu-w-2',
        itemNumber: 2,
        taskTitle: 'Earthing Switch Interlock Test',
        description: 'Verify mechanical interlock prevents closing Earth Switch while LBS is ON.',
        acceptanceCriteria: 'Interlock perfectly blocks key insertion when main contacts are closed.',
        inputType: 'BOOLEAN',
        isMandatory: true
      }
    ]
  },
  {
    category: 'RMU',
    frequency: 'MONTHLY',
    estimatedDurationMinutes: 45,
    requiredPPE: ['HT Safety Kit', 'Insulated 5kV Megger', 'Safety Shoes'],
    items: [
      {
        id: 'rmu-m-1',
        itemNumber: 1,
        taskTitle: 'Insulation Resistance (IR) Test (HV to Earth)',
        description: 'Measure insulation resistance using 2.5 kV / 5.0 kV DC calibrated Megger with line grounded.',
        acceptanceCriteria: 'Must be > 1000 MΩ (nominal > 2000 MΩ).',
        inputType: 'NUMERIC',
        unit: 'MΩ',
        minTolerance: 1000,
        isMandatory: true
      },
      {
        id: 'rmu-m-2',
        itemNumber: 2,
        taskTitle: 'Substation Earth Pit Resistance',
        description: 'Measure combined earth pit resistance using 3-point fall-of-potential earth tester.',
        acceptanceCriteria: 'Value must be < 1.0 Ω as per CEA & IS 3043 standard.',
        inputType: 'NUMERIC',
        unit: 'Ω',
        maxTolerance: 1.0,
        isMandatory: true
      },
      {
        id: 'rmu-m-3',
        itemNumber: 3,
        taskTitle: 'VIP400 / Protection Relay Status',
        description: 'Check self-powered protection relay flags and test trip coil health.',
        acceptanceCriteria: 'No fault flags active, test trip LED pulses correctly.',
        inputType: 'BOOLEAN',
        isMandatory: true
      }
    ]
  },
  {
    category: 'RMU',
    frequency: 'QUARTERLY',
    estimatedDurationMinutes: 60,
    requiredPPE: ['Arc Flash Suit', 'Thermal Camera (FLIR)', 'Safety Helmet'],
    items: [
      {
        id: 'rmu-q-1',
        itemNumber: 1,
        taskTitle: 'Thermography / Thermal Imaging Scan',
        description: 'Scan all HT cable terminations, bushing joints, and busbar links under peak load.',
        acceptanceCriteria: 'Temperature difference between phases ΔT < 5.0°C; maximum joint temp < 65°C.',
        inputType: 'NUMERIC',
        unit: '°C Rise',
        maxTolerance: 10.0,
        isMandatory: true
      },
      {
        id: 'rmu-q-2',
        itemNumber: 2,
        taskTitle: 'Motorized Spring Charge Mechanism Time',
        description: 'Measure duration taken by spring charging motor from discharged to fully charged.',
        acceptanceCriteria: 'Motor charge time < 15 seconds at rated DC voltage.',
        inputType: 'NUMERIC',
        unit: 'Seconds',
        maxTolerance: 15.0,
        isMandatory: true
      }
    ]
  },
  {
    category: 'RMU',
    frequency: 'YEARLY',
    estimatedDurationMinutes: 120,
    requiredPPE: ['Full HT Shutdown Kit', 'Arc Flash Face Shield', 'Calibrated Breaker Timer'],
    items: [
      {
        id: 'rmu-y-1',
        itemNumber: 1,
        taskTitle: 'Contact Resistance Micro-Ohm Test (CRM)',
        description: 'Inject 100A DC through main vacuum circuit breaker contacts and measure voltage drop.',
        acceptanceCriteria: 'Main contact resistance must be < 45 µΩ.',
        inputType: 'NUMERIC',
        unit: 'µΩ',
        maxTolerance: 45.0,
        isMandatory: true
      },
      {
        id: 'rmu-y-2',
        itemNumber: 2,
        taskTitle: 'High Voltage AC Withstand / Vacuum Integrity',
        description: 'Apply 28 kV AC for 1 minute across open vacuum interrupter contacts.',
        acceptanceCriteria: 'No breakdown or flashover across interrupter gap.',
        inputType: 'BOOLEAN',
        isMandatory: true
      }
    ]
  },

  // ─── 2. DIESEL GENERATOR (DG) SET CHECKLISTS ────────────────────────────────
  {
    category: 'DG_SET',
    frequency: 'DAILY',
    estimatedDurationMinutes: 15,
    requiredPPE: ['Safety Shoes', 'Ear Plugs', 'Safety Glasses'],
    items: [
      {
        id: 'dg-d-1',
        itemNumber: 1,
        taskTitle: 'Fuel Level in Day Tank',
        description: 'Verify High Speed Diesel (HSD) level in daily service fuel tank.',
        acceptanceCriteria: 'Fuel level must be > 75% capacity for emergency readiness.',
        inputType: 'NUMERIC',
        unit: '%',
        minTolerance: 50.0,
        isMandatory: true
      },
      {
        id: 'dg-d-2',
        itemNumber: 2,
        taskTitle: 'Lube Oil Dipstick & Coolant Level',
        description: 'Check 15W40 engine oil level on dipstick and radiator coolant expansion bottle.',
        acceptanceCriteria: 'Oil level between MIN and MAX crosshatch; coolant level visible in sight glass.',
        inputType: 'BOOLEAN',
        isMandatory: true
      },
      {
        id: 'dg-d-3',
        itemNumber: 3,
        taskTitle: 'Battery Terminal & Float Charger Voltage',
        description: 'Measure 24V DC battery voltage on AMF controller display.',
        acceptanceCriteria: 'Between 25.5V - 27.5V DC float charge.',
        inputType: 'NUMERIC',
        unit: 'V DC',
        minTolerance: 24.0,
        isMandatory: true
      }
    ]
  },
  {
    category: 'DG_SET',
    frequency: 'MONTHLY',
    estimatedDurationMinutes: 60,
    requiredPPE: ['Safety Shoes', 'Ear Defenders', 'Hydrometer'],
    items: [
      {
        id: 'dg-m-1',
        itemNumber: 1,
        taskTitle: 'Battery Electrolyte Specific Gravity Test',
        description: 'Measure specific gravity of each cell using temperature-compensated hydrometer.',
        acceptanceCriteria: 'Specific gravity between 1.240 - 1.280 at 27°C across all 12 cells.',
        inputType: 'NUMERIC',
        unit: 'Sp. Gravity',
        minTolerance: 1.24,
        maxTolerance: 1.29,
        isMandatory: true
      },
      {
        id: 'dg-m-2',
        itemNumber: 2,
        taskTitle: 'No-Load & Full-Load Test Run',
        description: 'Run DG Set for 15 mins on auto-mode; verify frequency (50.0 Hz ± 0.5) & voltage (415V).',
        acceptanceCriteria: 'Smooth start < 10 sec, no abnormal exhaust smoke, oil pressure > 3.5 bar.',
        inputType: 'BOOLEAN',
        isMandatory: true
      }
    ]
  },

  // ─── 3. POWER & DISTRIBUTION TRANSFORMER CHECKLISTS ─────────────────────────
  {
    category: 'TRANSFORMER',
    frequency: 'DAILY',
    estimatedDurationMinutes: 15,
    requiredPPE: ['Safety Helmet', 'Safety Shoes'],
    items: [
      {
        id: 'tx-d-1',
        itemNumber: 1,
        taskTitle: 'Conservator Oil Level & Magnetic Gauge (MOG)',
        description: 'Inspect oil level in main conservator tank on dial indicator.',
        acceptanceCriteria: 'Oil level matches 30°C / ambient mark on the MOG dial.',
        inputType: 'BOOLEAN',
        isMandatory: true
      },
      {
        id: 'tx-d-2',
        itemNumber: 2,
        taskTitle: 'Silica Gel Breather Color Check',
        description: 'Inspect silica gel crystals through transparent breather cylinder.',
        acceptanceCriteria: 'Color must be deep BLUE (> 75% volume). Oil cup seal level intact.',
        inputType: 'BOOLEAN',
        isMandatory: true
      },
      {
        id: 'tx-d-3',
        itemNumber: 3,
        taskTitle: 'Winding & Oil Temperature (WTI / OTI)',
        description: 'Record OTI and WTI dial temperatures on the Marshalling Box.',
        acceptanceCriteria: 'Oil Temp < 70°C, Winding Temp < 80°C under normal load.',
        inputType: 'NUMERIC',
        unit: '°C',
        maxTolerance: 85.0,
        isMandatory: true
      }
    ]
  },
  {
    category: 'TRANSFORMER',
    frequency: 'YEARLY',
    estimatedDurationMinutes: 180,
    requiredPPE: ['HT Oil Sampling Kit', 'Calibrated BDV Oil Test Cell', '5kV Megger'],
    items: [
      {
        id: 'tx-y-1',
        itemNumber: 1,
        taskTitle: 'Transformer Oil Breakdown Voltage (BDV Test)',
        description: 'Sample oil from bottom drain valve; test dielectric breakdown voltage as per IS 6792.',
        acceptanceCriteria: 'Oil BDV must be > 50 kV (minimum threshold 40 kV).',
        inputType: 'NUMERIC',
        unit: 'kV',
        minTolerance: 45.0,
        isMandatory: true
      },
      {
        id: 'tx-y-2',
        itemNumber: 2,
        taskTitle: 'Dissolved Gas Analysis (DGA) Screening',
        description: 'Gas chromatography test for combustible fault gases (H2, CH4, C2H2, C2H4, CO).',
        acceptanceCriteria: 'Acetylene (C2H2) < 1 ppm, Total Combustible Gases < 500 ppm.',
        inputType: 'BOOLEAN',
        isMandatory: true
      }
    ]
  }
];

export function getChecklistForCategory(category: string, frequency: PPMFrequency): PPMCategoryChecklist | undefined {
  const cat = category === 'RMUMD' ? 'RMU' : category;
  return HT_PPM_CHECKLISTS.find(c => c.category === cat && c.frequency === frequency);
}
