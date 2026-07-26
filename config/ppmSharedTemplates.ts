import { PPMCheckPointTemplate } from '../types/ppm';

export const PPM_GENERAL_POINTS: PPMCheckPointTemplate[] = [
  {
    id: 'gen-1-history-card',
    label: 'History card',
    frequency: 'QUARTERLY',
    criteria: [
      {
        id: 'c-history-card-avail',
        label: 'Check the availability of history card of all equipments',
        inputType: 'YES_NO'
      }
    ]
  },
  {
    id: 'gen-2-fire-extinguisher',
    label: 'Fire Extinguisher status',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-fe-qty', label: 'Check the adequate quantity is available', inputType: 'YES_NO' },
      { id: 'c-fe-type', label: 'Check for appropriate type of FE', inputType: 'YES_NO' },
      { id: 'c-fe-expiry', label: 'Check the expiry date', inputType: 'DATE' },
      { id: 'c-fe-inspection', label: 'Check the last inspection date by the vendor', inputType: 'DATE' }
    ]
  },
  {
    id: 'gen-3-sand-bucket',
    label: 'Sand bucket condition',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-sb-flow', label: 'Check the flowability of sand', inputType: 'YES_NO' },
      { id: 'c-sb-maint', label: 'Check the maintainability of sand bucket', inputType: 'YES_NO' }
    ]
  },
  {
    id: 'gen-4-incident-report',
    label: 'Incident Report',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-inc-record', label: 'Check the breakdown data and record', inputType: 'TEXT' }
    ]
  },
  {
    id: 'gen-5-daily-checklist',
    label: 'Maintaining of daily checklist',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-chk-verify', label: 'Verify the checklist for proper data', inputType: 'YES_NO' }
    ]
  },
  {
    id: 'gen-6-trackbot',
    label: 'Trackbot update status',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-tb-use', label: 'Effective use of trackbot', inputType: 'YES_NO' }
    ]
  },
  {
    id: 'gen-7-calibration',
    label: 'Calibration status',
    frequency: 'YEARLY',
    criteria: [
      { id: 'c-cal-date', label: 'Check for calibration done or not and mention the carried out date or due date', inputType: 'DATE' }
    ]
  },
  {
    id: 'gen-8-ceig',
    label: 'CEIG Inspection done on',
    frequency: 'YEARLY',
    criteria: [
      { id: 'c-ceig-date', label: 'Check the last inspection date and mention', inputType: 'DATE' },
      { id: 'c-ceig-report', label: 'Check the availability of the report', inputType: 'YES_NO' }
    ]
  }
];

export const PPM_HIRA_ELECTRICAL_PANEL: PPMCheckPointTemplate[] = [
  {
    id: 'hira-ep-1-cables',
    label: 'Cables & Components',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-heat', label: 'Check for over heating', inputType: 'YES_NO' }]
  },
  {
    id: 'hira-ep-2-components',
    label: 'Panel Board components',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-install', label: 'Improper Component Installation', inputType: 'YES_NO' }]
  },
  {
    id: 'hira-ep-3-plumbing',
    label: 'Over head Plumbing',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-leak', label: 'Any leakage on the panel', inputType: 'YES_NO' }]
  },
  {
    id: 'hira-ep-4-ppe',
    label: 'PPE\'s',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-ppe', label: 'Check for availability and condition', inputType: 'YES_NO' }]
  },
  {
    id: 'hira-ep-5-smoke',
    label: 'Smoke detectors',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-smoke', label: 'Provision in Panel rooms', inputType: 'YES_NO' }]
  },
  {
    id: 'hira-ep-6-hooter',
    label: 'Hooter for emergency',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-hooter', label: 'Provision of near call point', inputType: 'YES_NO' }]
  },
  {
    id: 'hira-ep-7-housekeeping',
    label: 'House keeping',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-hk', label: 'Check for debris & old spares in panel room', inputType: 'YES_NO' }]
  },
  {
    id: 'hira-ep-8-open-cables',
    label: 'Open End cables / improper insulation of cables',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-hira-ep-oc', label: 'Inspect for open or improperly insulated cables', inputType: 'YES_NO' }]
  }
];

// Shared pump sub-equipment checklist template
export const PPM_REUSABLE_PUMP_CHECKLIST: PPMCheckPointTemplate[] = [
  {
    id: 'pump-tb',
    label: 'Terminal block condition',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-pump-tb', label: 'Check terminal block fixing and tightness', inputType: 'YES_NO' }]
  },
  {
    id: 'pump-current',
    label: 'Current measurement',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-pump-curr', label: 'Measure operating current', inputType: 'NUMBER', unit: 'Amps' }]
  },
  {
    id: 'pump-noise',
    label: 'Abnormal noise & vibration',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-pump-noise', label: 'Check for abnormal noise or vibration during run', inputType: 'YES_NO' }]
  },
  {
    id: 'pump-protection',
    label: 'Protection settings & earth continuity',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-pump-prot', label: 'Verify protection settings and earth bonding', inputType: 'YES_NO' }
    ]
  },
  {
    id: 'pump-fan',
    label: 'Pump fan & cover condition',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-pump-fan', label: 'Check fan cover fixing and fan blade cleanliness', inputType: 'YES_NO' }]
  },
  {
    id: 'pump-heating',
    label: 'Motor heating',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-pump-heat', label: 'Check for excessive motor body temperature', inputType: 'YES_NO' }]
  },
  {
    id: 'pump-nrv',
    label: 'NRV (Non-Return Valve) functioning',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-pump-nrv', label: 'Check NRV function and prevent backflow', inputType: 'YES_NO' }]
  }
];

// Shared panel sub-equipment checklist template
export const PPM_REUSABLE_PANEL_CHECKLIST: PPMCheckPointTemplate[] = [
  {
    id: 'panel-fixing',
    label: 'Proper fixing of components & cabling',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-panel-mount', label: 'Check mounting of components', inputType: 'YES_NO' },
      { id: 'c-panel-dress', label: 'Check cable dressing', inputType: 'YES_NO' }
    ]
  },
  {
    id: 'panel-ppm-date',
    label: 'PPM carried out date',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-panel-ppm-date', label: 'PPM calendar date recorded', inputType: 'DATE' }]
  },
  {
    id: 'panel-earthing',
    label: 'Earthing connections',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-panel-earth', label: 'Check earthing connections', inputType: 'YES_NO' }]
  },
  {
    id: 'panel-elr',
    label: 'ELR working status',
    frequency: 'QUARTERLY',
    criteria: [
      { id: 'c-panel-elr-set', label: 'Relay settings', inputType: 'TEXT' },
      { id: 'c-panel-elr-trip', label: 'Test ELR trip operation', inputType: 'YES_NO' }
    ]
  },
  {
    id: 'panel-inverter',
    label: 'Condition of inverter in panel (if applicable)',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-panel-inv', label: 'Check inverter status and output', inputType: 'YES_NO' }]
  }
];

// Shared HIRA for RO & STP Plants (10 points)
export const PPM_HIRA_PUMP_PANEL: PPMCheckPointTemplate[] = [
  { id: 'hira-pp-1', label: 'Over Heating of cables', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-1', label: 'Check for cable overheating', inputType: 'YES_NO' }] },
  { id: 'hira-pp-2', label: 'Improper Component Installation', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-2', label: 'Inspect component installation', inputType: 'YES_NO' }] },
  { id: 'hira-pp-3', label: 'Overhead Plumbing line leakages', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-3', label: 'Check overhead plumbing leakages', inputType: 'YES_NO' }] },
  { id: 'hira-pp-4', label: 'PPE\'s availability & condition', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-4', label: 'Check PPE availability', inputType: 'YES_NO' }] },
  { id: 'hira-pp-5', label: 'Cable gland missing in Pumps', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-5', label: 'Check cable glands on pumps', inputType: 'YES_NO' }] },
  { id: 'hira-pp-6', label: 'Grounding of Pumps and Motors', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-6', label: 'Check grounding continuity', inputType: 'YES_NO' }] },
  { id: 'hira-pp-7', label: 'Pump Fan cover fixing', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-7', label: 'Check fan cover fixing', inputType: 'YES_NO' }] },
  { id: 'hira-pp-8', label: 'Hanging cables', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-8', label: 'Check for loose/hanging cables', inputType: 'YES_NO' }] },
  { id: 'hira-pp-9', label: 'Open End cables / improper insulation', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-9', label: 'Inspect open end / damaged insulation', inputType: 'YES_NO' }] },
  { id: 'hira-pp-10', label: 'Vibration in pumps / panel mounting', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-pp-10', label: 'Check excessive vibration', inputType: 'YES_NO' }] }
];

// HIRA for Swimming Pool & Water Body (9 points)
export const PPM_HIRA_SWIMMING_POOL: PPMCheckPointTemplate[] = PPM_HIRA_PUMP_PANEL.filter(p => p.id !== 'hira-pp-4');

// HIRA for Booster Pumps (8 points)
export const PPM_HIRA_BOOSTER_PUMPS: PPMCheckPointTemplate[] = PPM_HIRA_PUMP_PANEL.filter(p => !['hira-pp-3', 'hira-pp-4'].includes(p.id));

// Shared Bore Well sub-equipment checklist template
export const PPM_REUSABLE_BOREWELL_CHECKLIST: PPMCheckPointTemplate[] = [
  {
    id: 'bw-run',
    label: 'Bore Well Working Condition',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-bw-run', label: 'Check smooth running operation of bore well pump', inputType: 'YES_NO' }]
  },
  {
    id: 'bw-current',
    label: 'Current Drawn Measurement',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-bw-curr', label: 'Measure motor operating current', inputType: 'NUMBER', unit: 'Amps' }]
  },
  {
    id: 'bw-flow',
    label: 'Flow Meter Reading',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-bw-flow', label: 'Record bore well discharge flow meter reading', inputType: 'NUMBER', unit: 'KL' }]
  },
  {
    id: 'bw-ppm-date',
    label: 'PPM Carried Out Date',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-bw-ppm-date', label: 'Check PPM calendar date', inputType: 'DATE' }]
  },
  {
    id: 'bw-cgwa',
    label: 'CGWA Registration & NOC Status',
    frequency: 'YEARLY',
    criteria: [{ id: 'c-bw-cgwa', label: 'Check CGWA registration validity & NOC compliance', inputType: 'YES_NO' }]
  }
];

// Shared AMF Panel sub-equipment checklist template (Generator)
export const PPM_REUSABLE_AMF_PANEL_CHECKLIST: PPMCheckPointTemplate[] = [
  {
    id: 'amf-fixing',
    label: 'Proper fixing & cable dressing',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-amf-fixing', label: 'Check mounting of components & cable dressing', inputType: 'YES_NO' }]
  },
  {
    id: 'amf-elr',
    label: 'ELR working status',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-amf-elr', label: 'Test ELR tripping & relay setting', inputType: 'YES_NO' }]
  },
  {
    id: 'amf-changeover',
    label: 'Auto / Manual change-over condition',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-amf-changeover', label: 'Test automatic and manual changeover logic', inputType: 'YES_NO' }]
  },
  {
    id: 'amf-earth',
    label: 'Earthing connections',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-amf-earth', label: 'Check panel earthing continuity', inputType: 'YES_NO' }]
  },
  {
    id: 'amf-mat',
    label: 'Rubber Mat condition',
    frequency: 'QUARTERLY',
    criteria: [{ id: 'c-amf-mat', label: 'Check insulating mat in front of AMF panel', inputType: 'YES_NO' }]
  },
  {
    id: 'amf-service',
    label: 'Last service details',
    frequency: 'HALF_YEARLY',
    criteria: [{ id: 'c-amf-service', label: 'Record last AMF panel servicing date', inputType: 'DATE' }]
  }
];

// Generator HIRA (18 points)
export const PPM_HIRA_GENERATOR: PPMCheckPointTemplate[] = [
  { id: 'hira-dg-1', label: 'Entry for DG Yard', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-1', label: 'Check authorized entry warning & access restriction', inputType: 'YES_NO' }] },
  { id: 'hira-dg-2', label: 'PPE\'s availability & condition', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-2', label: 'Check ear muffs, gloves & safety gear', inputType: 'YES_NO' }] },
  { id: 'hira-dg-3', label: 'Safety Guidelines display', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-3', label: 'Check SOP & safety signages display', inputType: 'YES_NO' }] },
  { id: 'hira-dg-4', label: 'Cable Entry / Exit points', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-4', label: 'Inspect cable trench & gland sealing', inputType: 'YES_NO' }] },
  { id: 'hira-dg-5', label: 'Water logging in DG yard', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-5', label: 'Ensure no water accumulation in yard', inputType: 'YES_NO' }] },
  { id: 'hira-dg-6', label: 'Dry leaves & grass clearance', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-6', label: 'Check yard cleanliness & dry vegetation clearance', inputType: 'YES_NO' }] },
  { id: 'hira-dg-7', label: 'Fencing maintenance', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-7', label: 'Check fencing gate lock & integrity', inputType: 'YES_NO' }] },
  { id: 'hira-dg-8', label: 'Fencing Earthing', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-8', label: 'Check fencing earthing bonding', inputType: 'YES_NO' }] },
  { id: 'hira-dg-9', label: 'Rain Shades condition', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-9', label: 'Inspect rain canopy / shades', inputType: 'YES_NO' }] },
  { id: 'hira-dg-10', label: 'Rubber Mats condition', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-10', label: 'Check rubber mats near panels', inputType: 'YES_NO' }] },
  { id: 'hira-dg-11', label: 'Lighting & emergency lights', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-11', label: 'Check illumination level in DG room', inputType: 'YES_NO' }] },
  { id: 'hira-dg-12', label: 'Fuel Spillage prevention', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-12', label: 'Inspect diesel tank bund & spill tray', inputType: 'YES_NO' }] },
  { id: 'hira-dg-13', label: 'Oil Spillage prevention', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-13', label: 'Check engine oil tray for leakages', inputType: 'YES_NO' }] },
  { id: 'hira-dg-14', label: 'Fuel Storage area maintenance', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-14', label: 'Verify fuel storage safety standards', inputType: 'YES_NO' }] },
  { id: 'hira-dg-15', label: 'DG room ventilation', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-15', label: 'Check exhaust fans & acoustic louvers', inputType: 'YES_NO' }] },
  { id: 'hira-dg-16', label: 'Flue gas leakage inspection', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-16', label: 'Check exhaust silencer & manifold piping', inputType: 'YES_NO' }] },
  { id: 'hira-dg-17', label: 'Storage of hazardous waste', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-17', label: 'Inspect used oil drums & old filters area', inputType: 'YES_NO' }] },
  { id: 'hira-dg-18', label: 'Open End cables / improper insulation', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-dg-18', label: 'Check for exposed electrical cables', inputType: 'YES_NO' }] }
];

// HT Yard HIRA (12 points)
export const PPM_HIRA_HT_YARD: PPMCheckPointTemplate[] = [
  { id: 'hira-ht-1', label: 'Entry for HT Yard', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-1', label: 'Check danger signboards & locked gates', inputType: 'YES_NO' }] },
  { id: 'hira-ht-2', label: 'PPE\'s availability & condition', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-2', label: 'Check HT gloves, discharge rod & boots', inputType: 'YES_NO' }] },
  { id: 'hira-ht-3', label: 'Safety Guidelines display', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-3', label: 'Check single line diagram & SOP display', inputType: 'YES_NO' }] },
  { id: 'hira-ht-4', label: 'Cable Entry / Exit points', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-4', label: 'Check trench sealing against vermin', inputType: 'YES_NO' }] },
  { id: 'hira-ht-5', label: 'Water logging in HT yard', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-5', label: 'Inspect yard drainage & water log', inputType: 'YES_NO' }] },
  { id: 'hira-ht-6', label: 'Dry leaves & vegetation clearance', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-6', label: 'Check gravel area & weed clearance', inputType: 'YES_NO' }] },
  { id: 'hira-ht-7', label: 'Fencing maintenance', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-7', label: 'Inspect chainlink fencing integrity', inputType: 'YES_NO' }] },
  { id: 'hira-ht-8', label: 'Fencing Earthing', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-8', label: 'Verify fencing earth bonding', inputType: 'YES_NO' }] },
  { id: 'hira-ht-9', label: 'Rain Shades condition', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-9', label: 'Check transformer & RMU rain canopy', inputType: 'YES_NO' }] },
  { id: 'hira-ht-10', label: 'Rubber Mats condition', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-10', label: 'Check 11kV/33kV rated insulating mats', inputType: 'YES_NO' }] },
  { id: 'hira-ht-11', label: 'Emergency Lighting', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-11', label: 'Check yard illumination & emergency light', inputType: 'YES_NO' }] },
  { id: 'hira-ht-12', label: 'Open End cables / improper insulation', frequency: 'QUARTERLY', criteria: [{ id: 'c-hira-ht-12', label: 'Check HT/LT cables & terminations', inputType: 'YES_NO' }] }
];


