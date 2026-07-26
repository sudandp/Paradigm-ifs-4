import { PPMCategoryTemplate } from '../types/ppm';
import { 
  PPM_GENERAL_POINTS, 
  PPM_HIRA_ELECTRICAL_PANEL,
  PPM_REUSABLE_PUMP_CHECKLIST,
  PPM_REUSABLE_PANEL_CHECKLIST,
  PPM_HIRA_PUMP_PANEL,
  PPM_HIRA_SWIMMING_POOL,
  PPM_HIRA_BOOSTER_PUMPS,
  PPM_REUSABLE_BOREWELL_CHECKLIST,
  PPM_REUSABLE_AMF_PANEL_CHECKLIST,
  PPM_HIRA_GENERATOR,
  PPM_HIRA_HT_YARD
} from './ppmSharedTemplates';

export const PPM_ELECTRICAL_PANEL: PPMCategoryTemplate = {
  id: 'ELECTRICAL_PANEL',
  name: 'Electrical Panel',
  sections: [
    {
      id: 'sec-electrical-panels',
      title: 'Electrical Panels',
      checkPoints: [
        {
          id: 'ep-1-fixing',
          sequenceNumber: 1,
          label: 'Proper fixing of components & cabling',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ep-fixing-mount', label: 'Check the mounting of components', inputType: 'YES_NO' },
            { id: 'c-ep-fixing-dress', label: 'Check for proper dressing of cables', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'ep-2-ppm-date',
          sequenceNumber: 2,
          label: 'PPM carried out date',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ep-ppm-date', label: 'Check the PPM calendar and record the carried out date', inputType: 'DATE' }
          ]
        },
        {
          id: 'ep-3-bescom-seal',
          sequenceNumber: 3,
          label: 'BESCOM seal condition',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ep-bescom-seal', label: 'Check the seal', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'ep-4-earthing',
          sequenceNumber: 4,
          label: 'Earthing connections',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ep-earthing', label: 'Check the earthing connections', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'ep-5-rubber-mat',
          sequenceNumber: 5,
          label: 'Rubber mat condition',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ep-rm', label: 'Check the condition of rubber mat', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'ep-6-elr',
          sequenceNumber: 6,
          label: 'ELR working status',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ep-elr-setting', label: 'Mention the Relay settings', inputType: 'TEXT' },
            { id: 'c-ep-elr-conn', label: 'Check whether it is connected or not', inputType: 'YES_NO' },
            { id: 'c-ep-elr-trip', label: 'Test the ELR for tripping', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'ep-7-capacitor',
          sequenceNumber: 7,
          label: 'Capacitor bank working condition',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ep-cap-work', label: 'Check the working of capacitor bank and is connected to load', inputType: 'YES_NO' },
            { id: 'c-ep-cap-pf', label: 'Record the PF', inputType: 'NUMBER' }
          ]
        }
      ]
    },
    {
      id: 'sec-general-points',
      title: 'General Points',
      checkPoints: [
        // Re-use standard shared items
        ...PPM_GENERAL_POINTS.filter(p => p.id === 'gen-1-history-card'),
        {
          id: 'ep-gen-9-cleanliness',
          sequenceNumber: 9,
          label: 'Panel Room cleanliness',
          frequency: 'QUARTERLY',
          criteria: [{ id: 'c-ep-gen-clean', label: 'Check for overall cleaning and record', inputType: 'YES_NO' }]
        },
        {
          id: 'ep-gen-10-ventilation',
          sequenceNumber: 10,
          label: 'Ventilation',
          frequency: 'QUARTERLY',
          criteria: [{ id: 'c-ep-gen-vent', label: 'Check the working of exhaust fan', inputType: 'YES_NO' }]
        },
        {
          id: 'ep-gen-11-sld',
          sequenceNumber: 11,
          label: 'Single line diagram',
          frequency: 'QUARTERLY',
          criteria: [{ id: 'c-ep-gen-sld', label: 'Check the fixing of SLD', inputType: 'YES_NO' }]
        },
        ...PPM_GENERAL_POINTS.filter(p => 
          ['gen-2-fire-extinguisher', 'gen-3-sand-bucket', 'gen-4-incident-report', 
           'gen-5-daily-checklist', 'gen-6-trackbot', 'gen-7-calibration', 'gen-8-ceig'].includes(p.id)
        )
      ]
    },
    {
      id: 'sec-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_ELECTRICAL_PANEL.map((p, idx) => ({ ...p, sequenceNumber: 19 + idx }))
    }
  ]
};

export const PPM_BOOSTER_PUMPS: PPMCategoryTemplate = {
  id: 'BOOSTER_PUMPS',
  name: 'Booster Pumps',
  sections: [
    {
      id: 'sec-booster-pumps',
      title: 'Booster Pumps',
      description: 'Checklist for Booster Pump unit',
      repeatable: true,
      subEquipmentType: {
        id: 'booster-pump-unit',
        name: 'Booster Pump',
        defaultCheckPoints: [
          {
            id: 'bp-1-tb',
            label: 'Terminal block condition',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-tb', label: 'Check terminal block fixing and tightness', inputType: 'YES_NO' }]
          },
          {
            id: 'bp-2-run',
            label: 'Working condition',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-run', label: 'Check smooth running operation', inputType: 'YES_NO' }]
          },
          {
            id: 'bp-3-pg',
            label: 'Pressure gauge reading',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-pg', label: 'Record pressure gauge reading', inputType: 'NUMBER', unit: 'bar' }]
          },
          {
            id: 'bp-4-ps',
            label: 'Pressure switch setting',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-ps', label: 'Check pressure switch cut-in / cut-out setting', inputType: 'TEXT' }]
          },
          {
            id: 'bp-5-curr',
            label: 'Current measurement',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-curr', label: 'Measure operating current', inputType: 'NUMBER', unit: 'Amps' }]
          },
          {
            id: 'bp-6-noise',
            label: 'Abnormal noise',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-noise', label: 'Check for abnormal noise or vibration', inputType: 'YES_NO' }]
          },
          {
            id: 'bp-7-fan',
            label: 'Pump fan & cover',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-fan', label: 'Check fan cover fixing and fan condition', inputType: 'YES_NO' }]
          },
          {
            id: 'bp-8-heat',
            label: 'Motor heating',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bp-heat', label: 'Check for abnormal motor heating', inputType: 'YES_NO' }]
          }
        ]
      },
      checkPoints: []
    },
    {
      id: 'sec-booster-panel',
      title: 'Booster Pump Panel',
      description: 'Control Panel inspection for Booster Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'booster-panel-unit',
        name: 'Booster Panel',
        defaultCheckPoints: [
          {
            id: 'bpp-1-cond',
            label: 'Condition of panel',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bpp-cond', label: 'Overall panel physical condition', inputType: 'YES_NO' }]
          },
          {
            id: 'bpp-2-mount',
            label: 'Mounting of components',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bpp-mount', label: 'Check mounting and component tightness', inputType: 'YES_NO' }]
          },
          {
            id: 'bpp-3-dress',
            label: 'Cable dressing',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bpp-dress', label: 'Check neatness of cable dressing', inputType: 'YES_NO' }]
          },
          {
            id: 'bpp-4-ctrl',
            label: 'Control panel condition',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bpp-ctrl', label: 'Check internal wiring & control logic', inputType: 'YES_NO' }]
          },
          {
            id: 'bpp-5-ppm',
            label: 'PPM calendar date',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bpp-ppm', label: 'PPM date recorded', inputType: 'DATE' }]
          },
          {
            id: 'bpp-6-earth',
            label: 'Earthing connections',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bpp-earth', label: 'Check earthing continuity', inputType: 'YES_NO' }]
          },
          {
            id: 'bpp-7-clean',
            label: 'Cleanliness',
            frequency: 'QUARTERLY',
            criteria: [{ id: 'c-bpp-clean', label: 'Check internal & external cleanliness', inputType: 'YES_NO' }]
          }
        ]
      },
      checkPoints: []
    },
    {
      id: 'sec-booster-pressure-tank',
      title: 'Pressure Tank',
      checkPoints: [
        {
          id: 'pt-1-air',
          label: 'Sufficient air in pressure tank',
          frequency: 'QUARTERLY',
          criteria: [{ id: 'c-pt-air', label: 'Check pre-charge air pressure', inputType: 'YES_NO' }]
        },
        {
          id: 'pt-2-valves',
          label: 'Working condition of valves',
          frequency: 'QUARTERLY',
          criteria: [{ id: 'c-pt-valves', label: 'Check isolation & drain valves operation', inputType: 'YES_NO' }]
        }
      ]
    },
    {
      id: 'sec-booster-general',
      title: 'General Points',
      checkPoints: [
        ...PPM_GENERAL_POINTS.filter(p => p.id === 'gen-1-history-card')
      ]
    },
    {
      id: 'sec-booster-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_BOOSTER_PUMPS
    }
  ]
};

export const PPM_SWIMMING_POOL: PPMCategoryTemplate = {
  id: 'SP',
  name: 'Swimming Pool & Water Body',
  sections: [
    {
      id: 'sec-sp-pumps',
      title: 'Swimming Pool Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'sp-pump-unit',
        name: 'Swimming Pool Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-wb-pumps',
      title: 'Water Body Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'wb-pump-unit',
        name: 'Water Body Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-sp-general',
      title: 'General Points',
      checkPoints: [
        ...PPM_GENERAL_POINTS.filter(p => ['gen-1-history-card', 'gen-2-fire-extinguisher', 'gen-3-sand-bucket'].includes(p.id))
      ]
    },
    {
      id: 'sec-sp-panel',
      title: 'Pump Panel',
      repeatable: true,
      subEquipmentType: {
        id: 'sp-panel-unit',
        name: 'Pump Panel',
        defaultCheckPoints: PPM_REUSABLE_PANEL_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-sp-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_SWIMMING_POOL
    }
  ]
};

export const PPM_RO_PLANT: PPMCategoryTemplate = {
  id: 'RO',
  name: 'RO Plant',
  sections: [
    {
      id: 'sec-ro-main',
      title: 'RO Plant Audit Report',
      checkPoints: [
        {
          id: 'ro-1-visual',
          label: 'Visual Inspection & Tubing',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ro-tubing', label: 'Check tubing, gaskets, fittings & solenoids', inputType: 'YES_NO' },
            { id: 'c-ro-clean', label: 'Cleanliness of RO skid & area', inputType: 'YES_NO' },
            { id: 'c-ro-prefilters', label: 'Pre-filters changed & condition', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'ro-2-sensors',
          label: 'Sensors & Transmitters Calibration/Readings',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ro-cond-sens', label: 'Conductivity Sensor reading', inputType: 'NUMBER', unit: 'μS/cm' },
            { id: 'c-ro-orp-sens', label: 'ORP Sensor reading', inputType: 'NUMBER', unit: 'mV' },
            { id: 'c-ro-ph-sens', label: 'pH Sensor reading', inputType: 'NUMBER', unit: 'pH' },
            { id: 'c-ro-flow-sens', label: 'Flow Sensors reading', inputType: 'NUMBER', unit: 'LPH' },
            { id: 'c-ro-press-trans', label: 'Pressure Transmitter reading', inputType: 'NUMBER', unit: 'bar' },
            { id: 'c-ro-temp-trans', label: 'Temperature Transmitter reading', inputType: 'NUMBER', unit: '°C' }
          ]
        },
        {
          id: 'ro-3-membrane',
          label: 'RO Membrane & Performance',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ro-mem-cond', label: 'Membrane physical & operating condition', inputType: 'YES_NO' },
            { id: 'c-ro-rejection', label: 'Percentage % Salt Rejection', inputType: 'NUMBER', unit: '%' },
            { id: 'c-ro-raw-ppm', label: 'Raw Water PPM', inputType: 'NUMBER', unit: 'PPM' },
            { id: 'c-ro-treated-ppm', label: 'Treated Water PPM', inputType: 'NUMBER', unit: 'PPM' }
          ]
        },
        {
          id: 'ro-4-hns',
          label: 'HNS Line & Accessories',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ro-hns-pg', label: 'Condition of pressure gauges in HNS line', inputType: 'YES_NO' },
            { id: 'c-ro-hns-ps', label: 'Functioning of Pressure Switch', inputType: 'YES_NO' },
            { id: 'c-ro-hns-acc', label: 'Accumulator condition & pressure', inputType: 'YES_NO' },
            { id: 'c-ro-hns-auto', label: 'Auto working of HNS pumps', inputType: 'YES_NO' },
            { id: 'c-ro-chem-stock', label: 'Check stock of treatment chemicals', inputType: 'YES_NO' }
          ]
        }
      ]
    },
    {
      id: 'sec-ro-oht-pumps',
      title: 'Condition of OHT Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'ro-oht-pump',
        name: 'OHT Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-ro-hns-pumps',
      title: 'Condition of HNS Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'ro-hns-pump',
        name: 'HNS Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-ro-panels',
      title: 'Pump Panel & HNS Panel',
      repeatable: true,
      subEquipmentType: {
        id: 'ro-panel',
        name: 'RO Pump/HNS Panel',
        defaultCheckPoints: PPM_REUSABLE_PANEL_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-ro-general',
      title: 'General Points',
      checkPoints: [
        ...PPM_GENERAL_POINTS
      ]
    },
    {
      id: 'sec-ro-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_PUMP_PANEL
    }
  ]
};

export const PPM_STP: PPMCategoryTemplate = {
  id: 'STP',
  name: 'Sewage Treatment Plant',
  sections: [
    {
      id: 'sec-stp-main',
      title: 'STP Audit Report',
      checkPoints: [
        {
          id: 'stp-1-screen',
          label: 'Bar Screen Chamber',
          frequency: 'QUARTERLY',
          criteria: [{ id: 'c-stp-screen', label: 'Condition & cleaning of Bar Screen chamber', inputType: 'YES_NO' }]
        },
        {
          id: 'stp-2-blowers',
          label: 'Blowers & Aeration System',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-stp-blowers', label: 'Condition of Air Blowers', inputType: 'YES_NO' },
            { id: 'c-stp-raw-diff', label: 'Diffusers in Raw water tank', inputType: 'YES_NO' },
            { id: 'c-stp-aera-diff', label: 'Condition of Diffusers in Aeration tank & service data', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'stp-3-clarifier',
          label: 'Clarifier & Filtration',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-stp-clarifier', label: 'Condition of Primary Clarifier Tank', inputType: 'YES_NO' },
            { id: 'c-stp-psf', label: 'Condition of PSF (Pressure Sand Filter)', inputType: 'YES_NO' },
            { id: 'c-stp-pcf', label: 'Condition of PCF (Pressure Carbon Filter)', inputType: 'YES_NO' },
            { id: 'c-stp-backwash', label: 'Number of backwash performed per day', inputType: 'NUMBER' }
          ]
        },
        {
          id: 'stp-4-dosing-uv',
          label: 'Dosing & Disinfection Units',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-stp-dosing', label: 'Working condition of Chlorine dosing Pump', inputType: 'YES_NO' },
            { id: 'c-stp-uv', label: 'Condition & intensity of UV Unit', inputType: 'YES_NO' },
            { id: 'c-stp-press-cent', label: 'Working condition of Filter Press / Centrifuge', inputType: 'YES_NO' },
            { id: 'c-stp-treated-flow', label: 'Treated water flow meter reading', inputType: 'NUMBER', unit: 'KLD' }
          ]
        }
      ]
    },
    {
      id: 'sec-stp-raw-pumps',
      title: 'Raw Sewage Transfer Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'stp-raw-pump',
        name: 'Raw Sewage Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-stp-ff-pumps',
      title: 'Filter Feed Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'stp-ff-pump',
        name: 'Filter Feed Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-stp-sludge-pumps',
      title: 'Sludge Recirculation Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'stp-sludge-pump',
        name: 'Sludge Recirculation Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-stp-screw-pump',
      title: 'Screw Pump',
      repeatable: true,
      subEquipmentType: {
        id: 'stp-screw-pump',
        name: 'Screw Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-stp-garden-pumps',
      title: 'Garden Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'stp-garden-pump',
        name: 'Garden Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-stp-tanks',
      title: 'Tank Cleaning Details',
      checkPoints: [
        {
          id: 'stp-tank-raw',
          label: 'Raw Sewage Tank Cleaning',
          frequency: 'HALF_YEARLY',
          criteria: [{ id: 'c-stp-tk-raw', label: 'Last cleaning date & status', inputType: 'DATE' }]
        },
        {
          id: 'stp-tank-aera',
          label: 'Aeration Tank Cleaning',
          frequency: 'HALF_YEARLY',
          criteria: [{ id: 'c-stp-tk-aera', label: 'Last cleaning date & status', inputType: 'DATE' }]
        },
        {
          id: 'stp-tank-clar',
          label: 'Clarifier Tank Cleaning',
          frequency: 'HALF_YEARLY',
          criteria: [{ id: 'c-stp-tk-clar', label: 'Last cleaning date & status', inputType: 'DATE' }]
        },
        {
          id: 'stp-tank-ff',
          label: 'Filter Feed Tank Cleaning',
          frequency: 'HALF_YEARLY',
          criteria: [{ id: 'c-stp-tk-ff', label: 'Last cleaning date & status', inputType: 'DATE' }]
        },
        {
          id: 'stp-tank-final',
          label: 'Final Treated Water Tank Cleaning',
          frequency: 'HALF_YEARLY',
          criteria: [{ id: 'c-stp-tk-final', label: 'Last cleaning date & status', inputType: 'DATE' }]
        }
      ]
    },
    {
      id: 'sec-stp-panels',
      title: 'Pump Panel & HNS Panel',
      repeatable: true,
      subEquipmentType: {
        id: 'stp-panel',
        name: 'STP Control Panel',
        defaultCheckPoints: PPM_REUSABLE_PANEL_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-stp-general',
      title: 'General Points',
      checkPoints: [
        ...PPM_GENERAL_POINTS
      ]
    },
    {
      id: 'sec-stp-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_PUMP_PANEL
    }
  ]
};

export const PPM_WTP: PPMCategoryTemplate = {
  id: 'WTP',
  name: 'Water Treatment Plant',
  sections: [
    {
      id: 'sec-wtp-borewells',
      title: 'Bore Wells Inspection',
      repeatable: true,
      subEquipmentType: {
        id: 'wtp-borewell',
        name: 'Bore Well',
        defaultCheckPoints: PPM_REUSABLE_BOREWELL_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-wtp-main',
      title: 'Water Treatment Plant Audit Report',
      checkPoints: [
        {
          id: 'wtp-tanker',
          label: 'Tanker Water Procurement & Readings',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-wtp-tanker-qty', label: 'No. of Tanker water procured / month', inputType: 'NUMBER' },
            { id: 'c-wtp-tanker-flow', label: 'Flow meter reading of Tanker water', inputType: 'NUMBER', unit: 'KL' },
            { id: 'c-wtp-tanker-ppm', label: 'Tanker water PPM reading', inputType: 'NUMBER', unit: 'PPM' }
          ]
        },
        {
          id: 'wtp-raw-tank',
          label: 'Raw Water Tank Condition',
          frequency: 'QUARTERLY',
          criteria: [{ id: 'c-wtp-raw-tk', label: 'Condition & cleanliness of Raw water tank', inputType: 'YES_NO' }]
        },
        {
          id: 'wtp-filters',
          label: 'Filteration & Treatment Media (PSF / PCF / Softener)',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-wtp-strainers', label: 'Condition of strainers', inputType: 'YES_NO' },
            { id: 'c-wtp-psf', label: 'Condition of PSF (Pressure Sand Filter)', inputType: 'YES_NO' },
            { id: 'c-wtp-pcf', label: 'Condition of PCF (Pressure Carbon Filter)', inputType: 'YES_NO' },
            { id: 'c-wtp-softener', label: 'Condition of Softener unit', inputType: 'YES_NO' },
            { id: 'c-wtp-press-gauge', label: 'Condition of pressure gauges', inputType: 'YES_NO' },
            { id: 'c-wtp-brine', label: 'Condition of Brine tank & salt level', inputType: 'YES_NO' },
            { id: 'c-wtp-stirrer', label: 'Condition of stirrer / agitator', inputType: 'YES_NO' },
            { id: 'c-wtp-backwash-cnt', label: 'No. of backwash per day', inputType: 'NUMBER' },
            { id: 'c-wtp-salt-regen', label: 'Salt regeneration status & schedule', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'wtp-dosing-treated',
          label: 'Dosing & Treated Water Monitoring',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-wtp-chlor-pump', label: 'Working condition of Chlorine dosing Pump', inputType: 'YES_NO' },
            { id: 'c-wtp-backwash-flow', label: 'Provision of flow meter at backwash line & readings', inputType: 'YES_NO' },
            { id: 'c-wtp-treated-flow', label: 'Treated water flow meter reading', inputType: 'NUMBER', unit: 'KLD' },
            { id: 'c-wtp-treated-ppm', label: 'Treated water PPM reading', inputType: 'NUMBER', unit: 'PPM' },
            { id: 'c-wtp-salt-cons', label: 'Monthly consumption of Salt', inputType: 'NUMBER', unit: 'kg' },
            { id: 'c-wtp-chlor-cons', label: 'Monthly consumption of Chlorine', inputType: 'NUMBER', unit: 'liters' }
          ]
        },
        {
          id: 'wtp-hns-acc',
          label: 'HNS Line & Accessories',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-wtp-hns-pg', label: 'Condition of pressure gauges in HNS line', inputType: 'YES_NO' },
            { id: 'c-wtp-hns-ps', label: 'Functioning of Pressure switch', inputType: 'YES_NO' },
            { id: 'c-wtp-hns-acc', label: 'Accumulator condition & pressure', inputType: 'YES_NO' },
            { id: 'c-wtp-hns-auto', label: 'Auto working of HNS pumps', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'wtp-costing',
          label: 'Water Treatment Cost & Efficiency',
          frequency: 'MONTHLY',
          criteria: [
            { id: 'c-wtp-fresh-intake', label: 'Average fresh water intake per month', inputType: 'NUMBER', unit: 'KL' },
            { id: 'c-wtp-treated-qty', label: 'Average treated water quantity per month', inputType: 'NUMBER', unit: 'KL' },
            { id: 'c-wtp-chem-cost', label: 'Chemical cost per month', inputType: 'NUMBER', unit: '₹' },
            { id: 'c-wtp-energy-cons', label: 'Energy consumption per KL', inputType: 'NUMBER', unit: 'kWh/KL' },
            { id: 'c-wtp-treatment-cost', label: 'Overall treatment cost per KL', inputType: 'NUMBER', unit: '₹/KL' }
          ]
        }
      ]
    },
    {
      id: 'sec-wtp-ff-pumps',
      title: 'Condition of Filter Feed Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'wtp-ff-pump',
        name: 'Filter Feed Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-wtp-oht-pumps',
      title: 'Condition of OHT Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'wtp-oht-pump',
        name: 'OHT Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-wtp-hns-pumps',
      title: 'Condition of HNS Pumps',
      repeatable: true,
      subEquipmentType: {
        id: 'wtp-hns-pump',
        name: 'HNS Pump',
        defaultCheckPoints: PPM_REUSABLE_PUMP_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-wtp-panels',
      title: 'Pump Panel & HNS Panel',
      repeatable: true,
      subEquipmentType: {
        id: 'wtp-panel',
        name: 'WTP Control Panel',
        defaultCheckPoints: PPM_REUSABLE_PANEL_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-wtp-general',
      title: 'General Points',
      checkPoints: [
        ...PPM_GENERAL_POINTS
      ]
    },
    {
      id: 'sec-wtp-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_PUMP_PANEL
    }
  ]
};

export const PPM_GENERATOR: PPMCategoryTemplate = {
  id: 'GENERATOR',
  name: 'Generator (DG Set)',
  sections: [
    {
      id: 'sec-dg-main',
      title: 'DG Set Mechanical & Electrical Audit',
      checkPoints: [
        {
          id: 'dg-1-mechanical',
          label: 'Mechanical & Engine Condition',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-dg-belt', label: 'Belt condition & tension check', inputType: 'YES_NO' },
            { id: 'c-dg-clean', label: 'DG set & acoustics cleanliness', inputType: 'YES_NO' },
            { id: 'c-dg-oil-lvl', label: 'Engine oil level & condition', inputType: 'YES_NO' },
            { id: 'c-dg-oil-leak', label: 'Engine oil / fuel leakage check', inputType: 'YES_NO' },
            { id: 'c-dg-filters', label: 'Air, fuel & lube oil filter condition', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'dg-2-service-checks',
          label: 'Periodic Maintenance & Service Records',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-dg-acheck', label: 'A-Check carried out details & record', inputType: 'TEXT' },
            { id: 'c-dg-bcheck-date', label: 'Last B-check date', inputType: 'DATE' },
            { id: 'c-dg-bcheck-hrs', label: 'Engine run hours at last B-check', inputType: 'NUMBER', unit: 'Hours' },
            { id: 'c-dg-ccheck-date', label: 'Last C-check date', inputType: 'DATE' },
            { id: 'c-dg-ccheck-hrs', label: 'Engine run hours at last C-check', inputType: 'NUMBER', unit: 'Hours' },
            { id: 'c-dg-logsheet', label: 'DG log sheet availability & daily entries', inputType: 'YES_NO' }
          ]
        },
        {
          id: 'dg-3-compliance',
          label: 'Statutory Compliance & AMC',
          frequency: 'YEARLY',
          criteria: [
            { id: 'c-dg-gform', label: 'G-form submission & pollution board status', inputType: 'YES_NO' },
            { id: 'c-dg-amc-last', label: 'Last AMC vendor visit date', inputType: 'DATE' },
            { id: 'c-dg-amc-due', label: 'AMC renewal due date', inputType: 'DATE' },
            { id: 'c-dg-emission', label: 'Emission test done date & certificate', inputType: 'DATE' },
            { id: 'c-dg-decibel', label: 'Decibel noise level reading', inputType: 'NUMBER', unit: 'dBA' },
            { id: 'c-dg-waste-disp', label: 'Hazardous waste disposal record (used oil/filters)', inputType: 'YES_NO' }
          ]
        }
      ]
    },
    {
      id: 'sec-dg-general',
      title: 'General Points',
      checkPoints: [
        ...PPM_GENERAL_POINTS
      ]
    },
    {
      id: 'sec-dg-amf-panel',
      title: 'AMF Panel',
      repeatable: true,
      subEquipmentType: {
        id: 'amf-panel',
        name: 'AMF Panel',
        defaultCheckPoints: PPM_REUSABLE_AMF_PANEL_CHECKLIST
      },
      checkPoints: []
    },
    {
      id: 'sec-dg-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_GENERATOR
    }
  ]
};

export const PPM_HT_YARD: PPMCategoryTemplate = {
  id: 'HT_YARD',
  name: 'HT Yard',
  sections: [
    {
      id: 'sec-ht-rmu',
      title: 'RMU (Ring Main Unit)',
      checkPoints: [
        {
          id: 'ht-rmu-1',
          label: 'RMU Inspection & Protection',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ht-rmu-clean', label: 'RMU enclosure cleanliness', inputType: 'YES_NO' },
            { id: 'c-ht-rmu-sf6', label: 'SF6 gas pressure indicator condition', inputType: 'YES_NO' },
            { id: 'c-ht-rmu-pli', label: 'Power line indicators working', inputType: 'YES_NO' },
            { id: 'c-ht-rmu-relay', label: 'RMU Protection Relay healthiness', inputType: 'YES_NO' },
            { id: 'c-ht-rmu-source', label: 'Power source incoming source check', inputType: 'TEXT' },
            { id: 'c-ht-rmu-breaker-service', label: 'Last service details of Breakers', inputType: 'DATE' },
            { id: 'c-ht-rmu-earth', label: 'RMU body earthing connections', inputType: 'YES_NO' }
          ]
        }
      ]
    },
    {
      id: 'sec-ht-transformer',
      title: 'Transformers',
      checkPoints: [
        {
          id: 'ht-trans-1',
          label: 'Transformer Inspection & Oil Filtration',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ht-trans-tap', label: 'Tap changer position & incoming voltage check', inputType: 'TEXT' },
            { id: 'c-ht-trans-breather', label: 'Silica Gel Breather condition & size adequacy', inputType: 'YES_NO' },
            { id: 'c-ht-trans-humming', label: 'Humming sound or abnormal noise check', inputType: 'YES_NO' },
            { id: 'c-ht-trans-clean', label: 'Transformer body cleanliness & oil leakage', inputType: 'YES_NO' },
            { id: 'c-ht-trans-earth', label: 'Body and neutral earthing connections', inputType: 'YES_NO' },
            { id: 'c-ht-trans-oil-filt', label: 'Last oil filtration details & BDV test date', inputType: 'DATE' },
            { id: 'c-ht-trans-oil-report', label: 'Oil BDV & acidity test report availability', inputType: 'YES_NO' }
          ]
        }
      ]
    },
    {
      id: 'sec-ht-kiosk',
      title: 'LT Kiosk',
      checkPoints: [
        {
          id: 'ht-kiosk-1',
          label: 'LT Kiosk Panel Inspection',
          frequency: 'QUARTERLY',
          criteria: [
            { id: 'c-ht-kiosk-cable', label: 'Cable condition & dressing', inputType: 'YES_NO' },
            { id: 'c-ht-kiosk-clean', label: 'LT Kiosk internal cleanliness', inputType: 'YES_NO' },
            { id: 'c-ht-kiosk-service', label: 'Last servicing date recorded', inputType: 'DATE' },
            { id: 'c-ht-kiosk-elr', label: 'Condition of ELR & tripping function', inputType: 'YES_NO' },
            { id: 'c-ht-kiosk-earth', label: 'Earthing connections', inputType: 'YES_NO' }
          ]
        }
      ]
    },
    {
      id: 'sec-ht-general',
      title: 'General Points & Earth Pit Register',
      checkPoints: [
        ...PPM_GENERAL_POINTS
      ]
    },
    {
      id: 'sec-ht-hira',
      title: 'Hazard Identification & Risk Assessment',
      checkPoints: PPM_HIRA_HT_YARD
    }
  ]
};

// Exporting a dictionary mapping Category -> Template
export const PPM_FIELD_SPECS: Record<string, PPMCategoryTemplate> = {
  'ELECTRICAL_PANEL': PPM_ELECTRICAL_PANEL,
  'BOOSTER_PUMPS': PPM_BOOSTER_PUMPS,
  'SP': PPM_SWIMMING_POOL,
  'RO': PPM_RO_PLANT,
  'STP': PPM_STP,
  'WTP': PPM_WTP,
  'GENERATOR': PPM_GENERATOR,
  'HT_YARD': PPM_HT_YARD
};


