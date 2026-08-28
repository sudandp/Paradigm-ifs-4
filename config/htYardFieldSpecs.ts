import { ModuleSpec } from '../types/htYard';

export const HT_YARD_FIELD_SPECS: Record<string, ModuleSpec> = {
  RMU: {
    moduleType: 'RMU',
    title: 'RMU (Ring Main Unit)',
    description: 'Switchgear routing MV cables between transformer/kiosk feeders',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'RMUMD', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Capacity', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'capacity' },
          { key: 'model_no', label: '5. Model No.', type: 'text' },
          { key: 'no_of_ways', label: '6. No. of Ways', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'no_of_ways' }
        ]
      },
      {
        sectionKey: 'incoming_od1',
        title: '7. Incoming OD 1 Details',
        fields: [
          { key: 'cable_rating', label: 'Cable Rating', type: 'select', optionsCategory: 'Cable Details', optionsFieldKey: 'cable_rating_rmu' },
          { key: 'from_source', label: 'From Source', type: 'text' },
          { key: 'power_indicator', label: 'Power Line Indicator Details', type: 'cascading_select', optionsCategory: 'RMUMD', optionsFieldKey: 'power_indicator' },
          { key: 'fault_indicator', label: 'Line Fault / Earth Indicator Details', type: 'cascading_select', optionsCategory: 'RMUMD', optionsFieldKey: 'fault_indicator' },
          { key: 'mf_meter', label: 'Multi Function Meter', type: 'cascading_select', optionsCategory: 'RMUMD', optionsFieldKey: 'mf_meter' },
          { key: 'protection_relay', label: 'RMU Protection Relay', type: 'cascading_select', optionsCategory: 'RMUMD', optionsFieldKey: 'protection_relay' },
          { key: 'on_off_button', label: 'On/Off Push Button', type: 'boolean' },
          { key: 'emergency_button', label: 'Emergency Trip Button', type: 'boolean' },
          { key: 'sf6_status', label: 'SF-6 Status', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'sf6_status' },
          { key: 'selector_switch_1', label: 'Selector Switch 1 Details', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'selector_switch' },
          { key: 'selector_switch_2', label: 'Selector Switch 2 Details', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'selector_switch' },
          { key: 'line_charge_indicator', label: 'Line Charge Indicator', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'line_charge_indicator' }
        ]
      },
      {
        sectionKey: 'ht_control_components',
        title: 'HT Control Components',
        fields: [
          { key: 'mf_meter_1', label: '14. Multi Function Meter 1', type: 'text' },
          { key: 'mf_meter_2', label: '15. Multi Function Meter 2', type: 'text' },
          { key: 'indication_lamp', label: '16. Indication Lamp', type: 'text' },
          { key: 'dc_converter', label: '17. DC to DC Converter', type: 'text' },
          { key: 'ac_protector', label: '18. Input AC Protector', type: 'text' },
          { key: 'battery_charger', label: '19. Battery Charger', type: 'text' },
          { key: 'heater_mcb', label: '20. MCB for Heater in Secondary', type: 'text' },
          { key: 'control_mcb', label: '21. Control MCB', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'control_mcb' },
          { key: 'control_battery', label: '22. Control Battery', type: 'text' },
          { key: 'testing_connections', label: '23. Testing Connections', type: 'text' },
          { key: 'ct_chamber', label: '24. CT Chamber', type: 'text' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition',
        fields: [
          { key: 'foundation_cond', label: '25. Condition of Foundation', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'foundation_cond' },
          { key: 'cable_laying', label: '26. Laying of Cables', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'cable_laying' },
          { key: 'incoming_cable_fixing', label: '27. Incoming Cable Fixing & Copper Earthing', type: 'text' },
          { key: 'outgoing_cable_fixing', label: '28. Outgoing Cable Fixing', type: 'text' },
          { key: 'body_condition', label: '29. Body Condition', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'body_condition' },
          { key: 'earth_pit_location', label: '30. Location of Earthing Pits (m)', type: 'text' },
          { key: 'labelling', label: '31. Labelling', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'labelling' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'changeover_switch', label: '32. Functioning of Changeover Switch', type: 'boolean' },
          { key: 'operating_levers', label: '33. Availability of Operating Levers', type: 'boolean' },
          { key: 'door_condition', label: '34. Condition of Doors', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'door_condition' }
        ]
      }
    ]
  },

  Transformer: {
    moduleType: 'Transformer',
    title: 'Transformer Audit Report',
    description: 'Distribution Transformer inspection log',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'TRMaster Data', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Capacity (kVA)', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'capacity' },
          { key: 'coil_material', label: '5. Coil Winding Material', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'coil_material' }
        ]
      },
      {
        sectionKey: 'accessories',
        title: 'Equipment Accessories',
        fields: [
          { key: 'incoming_bushing_gos', label: '6. Condition of Incoming Bushings at GOS', type: 'text' },
          { key: 'outgoing_bushing_gos', label: '7. Condition of Outgoing Bushings at GOS', type: 'text' },
          { key: 'ht_bushing_cond', label: '8. Condition of HT Bushings', type: 'text' },
          { key: 'lt_bushing_cond', label: '9. Condition of LT Bushings', type: 'text' },
          { key: 'oil_level_indicator', label: '10. Oil Level Indicator', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'oil_level_indicator' },
          { key: 'oil_temp_indicator', label: '11. Oil Temperature Indicator', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'oil_temp_indicator' },
          { key: 'winding_temp_indicator', label: '12. Winding Temperature Indicator', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'winding_temp_indicator' },
          { key: 'prv', label: '13. Pressure Relief Valve (PRV)', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'prv' },
          { key: 'drain_valve', label: '14. Drain Valve', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'drain_valve' },
          { key: 'tap_changer', label: '15. Tap Changer (Automatic / Manual)', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'tap_changer' },
          { key: 'conservator_cond', label: '16. Condition of Oil Conservator', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'conservator_cond' },
          { key: 'explosion_vent', label: '17. Explosion Vent', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'explosion_vent' },
          { key: 'buchholz_relay', label: '18. Buchholz Relay', type: 'boolean' },
          { key: 'air_breather', label: '19. Air Breather (Silica Gel)', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'air_breather' },
          { key: 'body_earth_terminals', label: '20. Earthing Terminals at Transformer Body', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'body_earth_terminals' },
          { key: 'neutral_earth_terminals', label: '21. Earthing Terminals at Neutral', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'neutral_earth_terminals' },
          { key: 'lifting_lugs', label: '22. Lifting Lugs', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'lifting_lugs' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition',
        fields: [
          { key: 'foundation_cond', label: '23. Condition of Foundation', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'foundation_cond' },
          { key: 'cable_laying', label: '24. Laying of Cables', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'cable_laying' },
          { key: 'incoming_cable_fixing', label: '25. Incoming Cable Fixing & Copper Earthing', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'incoming_cable_fixing' },
          { key: 'outgoing_cable_fixing', label: '26. Outgoing Cable Fixing', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'outgoing_cable_fixing' },
          { key: 'gland_condition', label: '27. Cable Gland Condition', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'gland_condition' },
          { key: 'gland_earthing', label: '28. Cable Gland Earthing', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'gland_earthing' },
          { key: 'body_condition', label: '29. Body Condition', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'body_condition' },
          { key: 'earth_pit_distances', label: '30. Location of Earthing Pits (TR to NEP / BEP)', type: 'text' },
          { key: 'incoming_cable_details', label: '31. Incoming Cable Details (Rating & From)', type: 'select', optionsCategory: 'Cable Details', optionsFieldKey: 'cable_rating_transformer' },
          { key: 'outgoing_cable_details', label: '32. Outgoing Cable Details (Rating & To)', type: 'select', optionsCategory: 'Cable Details', optionsFieldKey: 'cable_rating_transformer' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'bescom_tc_no', label: '33. BESCOM TC No.', type: 'text' },
          { key: 'silica_gel_cond', label: '34. Silica Gel Condition', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'silica_gel' },
          { key: 'oil_level', label: '35. Oil Level', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'oil_level' },
          { key: 'oil_leakage', label: '36. Oil Leakage if Any', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'oil_leakage' },
          { key: 'heating_cables', label: '37. Heating Cables', type: 'text' },
          { key: 'humming_sound', label: '38. Humming Sound if Any', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'humming_sound' }
        ]
      }
    ]
  },

  LT_Kiosk: {
    moduleType: 'LT_Kiosk',
    title: 'LT Kiosk Audit Report',
    description: 'LT distribution kiosk including capacitor bank panel checks',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'LTKMD', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Capacity', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'capacity' }
        ]
      },
      {
        sectionKey: 'incomer_accessories',
        title: 'Equipment Accessories',
        fields: [
          { key: 'incomer_mccb', label: '5. Incomer MCCB/COS/ACB Details', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'incomer_mccb_make' },
          { key: 'single_phase_preventor', label: '6. Single Phase Preventor & Logic Circuit', type: 'boolean' },
          { 
            key: 'earth_leakage_relay', 
            label: '7. Earth Leakage Relay Make', 
            type: 'select', 
            optionsCategory: 'LTKMD', 
            optionsFieldKey: 'earth_leakage_relay',
            subFields: [
              { key: 'status', label: 'Status', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'status', parentFieldKey: 'earth_leakage_relay' },
              { key: 'time_in_sec', label: 'Time in Sec', type: 'text', optionsCategory: 'LTKMD', optionsFieldKey: 'time_in_sec', parentFieldKey: 'earth_leakage_relay' }
            ]
          },
          { key: 'voltmeter', label: '8. Volt Meter', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'voltmeter' },
          { key: 'ammeter', label: '9. Ammeter', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'ammeter' },
          { key: 'mf_meter', label: '10. Multi Function Meter', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'mf_meter' },
          { key: 'selector_switch_make', label: '11. Selector Switch Make', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'selector_switch_make' },
          { key: 'phase_lamps', label: '12. Phase Indicating Lamps', type: 'boolean' },
          { key: 'trip_lamps', label: '13. Trip Indicating Lamps', type: 'boolean' },
          { 
            key: 'bescom_master_meter', 
            label: '14. BESCOM Master Meter Details', 
            type: 'select', 
            optionsCategory: 'LTKMD', 
            optionsFieldKey: 'bescom_master_meter',
            subFields: [
              { key: 'bescom_seal', label: 'BESCOM Seal', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'bescom_seal', parentFieldKey: 'bescom_master_meter' },
              { key: 'ct_ratio', label: 'CT Ratio', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'ct_ratio', parentFieldKey: 'bescom_master_meter' },
              { key: 'ct_constant', label: 'CT Constant', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'ct_constant', parentFieldKey: 'bescom_master_meter' },
              { key: 'ct_va', label: 'CT VA', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'ct_va', parentFieldKey: 'bescom_master_meter' },
              { key: 'ct_cl', label: 'CT CL', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'ct_cl', parentFieldKey: 'bescom_master_meter' },
              { key: 'ct_classification', label: 'CT Classification', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'ct_classification', parentFieldKey: 'bescom_master_meter' }
            ]
          },
          { key: 'bus_coupler_details', label: '15. Bus Coupler Details', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'bus_coupler' }
        ]
      },
      {
        sectionKey: 'capacitor_banks',
        title: 'Capacitor Bank Details',
        fields: [
          { key: 'cap_incomer_mccb', label: '24. Incoming MCCB Details', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'incomer_mccb_make' },
          { key: 'pfc_controller', label: '26. PFC Controller Make', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'pfc_controller' },
          { key: 'cap_bank_sizes', label: 'Capacitor Bank Sizes', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'cap_bank_sizes' },
          { key: 'relay_timer_lvm', label: 'Relay / Timer / LVM', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'relay_timer_lvm' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition & Safety',
        fields: [
          { key: 'foundation_cond', label: '42. Condition of Foundation', type: 'text' },
          { key: 'cable_laying', label: '43. Laying of Cables', type: 'text' },
          { key: 'gland_condition', label: '44. Cable Gland Condition', type: 'text' },
          { key: 'gland_earthing', label: '45. Cable Gland Earthing', type: 'boolean' },
          { key: 'body_condition', label: '46. Body Condition', type: 'text' },
          { key: 'earth_pit_location', label: '47. Location of Earthing Pits (m)', type: 'text' },
          { key: 'cable_details', label: '50. Cable Details (Rating & Cores)', type: 'select', optionsCategory: 'Cable Details', optionsFieldKey: 'cable_rating_ltkiosk' },
          { key: 'rain_shade', label: '48. Provision of Rain Shade', type: 'boolean' },
          { key: 'rubber_mat', label: '49. Provision of Rubber Mat', type: 'boolean' }
        ]
      }
    ]
  },

  HT_Yard_Common: {
    moduleType: 'HT_Yard_Common',
    title: 'HT Yard Common Points & HIRA',
    description: 'Site-wide yard checks, documents, and HIRA assessment',
    repeatsPerSite: false,
    sections: [
      {
        sectionKey: 'yard_checks_stage_1',
        title: 'Stage 1: Yard Infrastructure & Environment',
        fields: [
          { key: 'yard_fencing_height', label: '1. Yard Fencing Height', type: 'text' },
          { key: 'jelly_laying', label: '2. 40 mm Jelly Laying', type: 'boolean' },
          { key: 'caution_board', label: '3. Caution Board Display', type: 'boolean' },
          { key: 'oil_filtration', label: '4. Oil Filtration Details', type: 'text' },
          { key: 'bdv_test', label: '5. BDV Test & Acidity of Oil', type: 'text' },
          { key: 'yard_cleanliness', label: '6. Yard Cleanliness', type: 'select', optionsCategory: 'HTYardCommon', optionsFieldKey: 'yard_cleanliness' }
        ]
      },
      {
        sectionKey: 'yard_checks_stage_2',
        title: 'Stage 2: Safety & Initial Reports',
        fields: [
          { key: 'fire_extinguishers', label: '7. Provision of Fire Extinguisher (Type 1, 2, 3)', type: 'select', optionsCategory: 'HTYardCommon', optionsFieldKey: 'fire_extinguishers' },
          { key: 'sand_buckets', label: '8. Provision of Sand Buckets & Condition', type: 'boolean' },
          { key: 'earthing_report', label: '9. Earthing Test Report Availability', type: 'boolean' },
          { key: 'ceig_report', label: '10. CEIG Inspection Report Availability', type: 'boolean' },
          { key: 'ceig_approval', label: '11. CEIG Approval Copy Availability', type: 'boolean' },
          { key: 'breaker_test_report', label: '12. Breaker Testing Report Availability', type: 'boolean' }
        ]
      },
      {
        sectionKey: 'yard_checks_stage_3',
        title: 'Stage 3: Compliance & Final Documents',
        fields: [
          { key: 'calibration_report', label: '13. Calibration Report Availability', type: 'boolean' },
          { key: 'second_source_status', label: '14. 2nd Source Working Status Report', type: 'text' },
          { key: 'bescom_feasibility', label: '15. BESCOM Feasibility Report Availability', type: 'boolean' },
          { key: 'ceig_drawing', label: '16. CEIG Approved Drawing Availability', type: 'boolean' },
          { key: 'last_service_report', label: '17. Last Service Report Availability', type: 'boolean' }
        ]
      }
    ]
  },

  VCB: {
    moduleType: 'VCB',
    title: 'VCB (Vacuum Circuit Breaker) Audit Report',
    description: 'Indoor / Outdoor Vacuum Circuit Breaker inspection checklist',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'VCB', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Rated Current / Capacity', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'capacity' },
          { key: 'model_no', label: '5. Model No.', type: 'text' },
          { key: 'breaking_capacity', label: '6. Rated Short Circuit Breaking (kA)', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'breaking_capacity' }
        ]
      },
      {
        sectionKey: 'vcb_control_components',
        title: 'VCB Control & Protection Components',
        fields: [
          { key: 'protection_relay', label: '7. Protection Relay Details', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'protection_relay' },
          { key: 'tc_supervision_relay', label: '8. Trip Circuit Supervision Relay', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'tc_supervision_relay' },
          { key: 'master_trip_relay', label: '9. Master Trip Relay', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'master_trip_relay' },
          { key: 'control_mcb', label: '10. Control MCBs', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'control_mcb' },
          { key: 'mf_meter', label: '11. Multi Function Meter', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'mf_meter' },
          { key: 'voltmeter', label: '12. Volt Meter', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'voltmeter' },
          { key: 'ammeter', label: '13. Ammeter', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'ammeter' },
          { key: 'power_indicator', label: '14. Power Line / Phase Indicating Lamps', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'power_indicator' },
          { key: 'vacuum_status', label: '15. Vacuum Interrupter / Bottle Condition', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'vacuum_status' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition & Safety',
        fields: [
          { key: 'foundation_cond', label: '16. Condition of Foundation', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'foundation_cond' },
          { key: 'cable_laying', label: '17. Laying of Cables', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'cable_laying' },
          { key: 'gland_condition', label: '18. Cable Gland & Earthing', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'gland_condition' },
          { key: 'body_condition', label: '19. Body Condition & Enclosure', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'body_condition' },
          { key: 'earth_pit_location', label: '20. Location of Earthing Pits (m)', type: 'text' },
          { key: 'labelling', label: '21. Labelling & Danger Notice', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'labelling' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'door_condition', label: '22. Condition of Doors & Safety Interlocks', type: 'select', optionsCategory: 'VCB', optionsFieldKey: 'door_condition' },
          { key: 'operating_levers', label: '23. Availability of Operating Handles / Levers', type: 'boolean' },
          { key: 'test_service_pos', label: '24. Test / Service Position Racking Mechanism', type: 'boolean' }
        ]
      }
    ]
  },

  Switchgear: {
    moduleType: 'Switchgear',
    title: 'Switchgear Audit Report',
    description: 'MV/HT Switchgear and Busbar panel inspection checklist',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'Switchgear', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Rated Busbar Current / Capacity', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'capacity' },
          { key: 'model_no', label: '5. Model / Panel Type', type: 'text' },
          { key: 'no_of_panels', label: '6. No. of Panels / Incomers', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'no_of_panels' }
        ]
      },
      {
        sectionKey: 'components_relays',
        title: 'Switchgear Components & Relays',
        fields: [
          { key: 'protection_relay', label: '7. Protection Relay Details', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'protection_relay' },
          { key: 'mf_meter', label: '8. Multi Function Meter', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'mf_meter' },
          { key: 'control_mcb', label: '9. Control MCBs', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'control_mcb' },
          { key: 'annunciator', label: '10. Annunciator Panel', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'annunciator' },
          { key: 'selector_switch', label: '11. Selector Switch Details', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'selector_switch' },
          { key: 'power_indicator', label: '12. Phase Indicating Lamps', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'power_indicator' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition & Safety',
        fields: [
          { key: 'foundation_cond', label: '13. Condition of Foundation', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'foundation_cond' },
          { key: 'cable_laying', label: '14. Laying of Cables', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'cable_laying' },
          { key: 'body_condition', label: '15. Body Condition & IP Enclosure', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'body_condition' },
          { key: 'body_earth_terminals', label: '16. Earthing Copper Bus Connections', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'body_earth_terminals' },
          { key: 'rubber_mat', label: '17. Provision of Insulated Rubber Mat', type: 'boolean' },
          { key: 'labelling', label: '18. Labelling & Mimic Bus', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'labelling' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'door_condition', label: '19. Condition of Doors & Interlocks', type: 'select', optionsCategory: 'Switchgear', optionsFieldKey: 'door_condition' },
          { key: 'operating_levers', label: '20. Availability of Operating Levers', type: 'boolean' }
        ]
      }
    ]
  },

  HT_Panel: {
    moduleType: 'HT_Panel',
    title: 'HT Panel Audit Report',
    description: 'High Tension incoming / distribution panel checklist',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'HT_Panel', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Rated Voltage / Capacity', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'capacity' },
          { key: 'breaker_type', label: '5. Breaker Mechanism (VCB / SF6 / ACB)', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'breaker_type' },
          { key: 'model_no', label: '6. Model No.', type: 'text' }
        ]
      },
      {
        sectionKey: 'protection_metering',
        title: 'Protection & Metering',
        fields: [
          { key: 'protection_relay', label: '7. Overcurrent & Earth Fault Relay', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'protection_relay' },
          { key: 'master_trip_relay', label: '8. Master Trip Relay', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'master_trip_relay' },
          { key: 'mf_meter', label: '9. Multi Function Meter', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'mf_meter' },
          { key: 'control_mcb', label: '10. Control MCBs', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'control_mcb' },
          { key: 'power_pack_battery_backup', label: '11. Power Pack / Battery Backup', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'power_pack_battery_backup' },
          { key: 'power_indicator', label: '12. Line Charge / Indication Lamps', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'power_indicator' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition & Grounding',
        fields: [
          { key: 'foundation_cond', label: '13. Foundation Plinth Condition', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'foundation_cond' },
          { key: 'cable_laying', label: '14. Laying of Cables', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'cable_laying' },
          { key: 'gland_earthing', label: '15. Cable Gland & Double Earthing', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'gland_earthing' },
          { key: 'body_condition', label: '16. Body Condition & Powder Coating', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'body_condition' },
          { key: 'body_earth_terminals', label: '17. Earthing Busbar Connection', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'body_earth_terminals' },
          { key: 'labelling', label: '18. Danger Notice & Labelling', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'labelling' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'door_condition', label: '19. Door Gaskets & Locks Condition', type: 'select', optionsCategory: 'HT_Panel', optionsFieldKey: 'door_condition' },
          { key: 'operating_levers', label: '20. Availability of Operating Levers', type: 'boolean' }
        ]
      }
    ]
  },

  Meter_Cubicle: {
    moduleType: 'Meter_Cubicle',
    title: 'HT Metering Cubicle Audit Report',
    description: 'Utility / HT revenue metering cubicle & CT/PT inspection checklist',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'Meter_Cubicle', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Voltage Class / Ratio', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'capacity' },
          { key: 'bescom_tc_no', label: '5. BESCOM / Utility TC No.', type: 'text' }
        ]
      },
      {
        sectionKey: 'metering_ct_pt_seals',
        title: 'Metering CT/PT & Seals',
        fields: [
          { key: 'bescom_master_meter', label: '6. Master Meter Make & Model', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'bescom_master_meter' },
          { key: 'bescom_seal', label: '7. Metering Seal Condition (Intact/Broken)', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'bescom_seal' },
          { key: 'ct_ratio', label: '8. CT Ratio', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'ct_ratio' },
          { key: 'ct_constant', label: '9. CT Constant', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'ct_constant' },
          { key: 'ct_cl', label: '10. Accuracy Class', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'ct_cl' },
          { key: 'ct_va', label: '11. CT Burden (VA)', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'ct_va' },
          { key: 'mf_meter', label: '12. Multi Function Check Meter', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'mf_meter' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition & Safety',
        fields: [
          { key: 'foundation_cond', label: '13. Condition of Foundation', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'foundation_cond' },
          { key: 'cable_laying', label: '14. Laying of Cables', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'cable_laying' },
          { key: 'body_condition', label: '15. Body Condition & Sealing Loop', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'body_condition' },
          { key: 'body_earth_terminals', label: '16. Dual Body Grounding Terminals', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'body_earth_terminals' },
          { key: 'labelling', label: '17. Labelling & Danger Caution Notice', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'labelling' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'door_condition', label: '18. Door Condition & Glass Viewing Port', type: 'select', optionsCategory: 'Meter_Cubicle', optionsFieldKey: 'door_condition' },
          { key: 'rain_shade', label: '19. Provision of Rain Canopy / Shade', type: 'boolean' }
        ]
      }
    ]
  },

  CSS: {
    moduleType: 'CSS',
    title: 'CSS (Compact Secondary Substation) Audit Report',
    description: 'Packaged Compact Substation (MV + Transformer + LV + APFC) inspection checklist',
    repeatsPerSite: true,
    sections: [
      {
        sectionKey: 'equipment_details',
        title: 'Equipment Details',
        fields: [
          { key: 'mfr_name', label: '1. Manufacturer Name', type: 'searchable_select', optionsCategory: 'CSS', isManufacturerField: true },
          { key: 'mfg_year', label: '2. Year of Manufacturing', type: 'date' },
          { key: 'serial_no', label: '3. Serial No.', type: 'text' },
          { key: 'capacity', label: '4. Transformer Rating (kVA)', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'capacity' },
          { key: 'model_no', label: '5. Package Model / Type', type: 'text' },
          { key: 'coil_material', label: '6. Transformer Winding Material', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'coil_material' }
        ]
      },
      {
        sectionKey: 'mv_transformer_section',
        title: 'MV & Transformer Section',
        fields: [
          { key: 'sf6_status', label: '7. MV RMU / Breaker Gas Status', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'sf6_status' },
          { key: 'protection_relay', label: '8. Protection Relay Details', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'protection_relay' },
          { key: 'oil_temp_indicator', label: '9. Oil Temperature Indicator', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'oil_temp_indicator' },
          { key: 'prv', label: '10. Pressure Relief Device (PRV)', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'prv' },
          { key: 'air_breather', label: '11. Silica Gel Breather Condition', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'air_breather' }
        ]
      },
      {
        sectionKey: 'lv_capacitor_section',
        title: 'LV & Capacitor Section',
        fields: [
          { key: 'incomer_mccb', label: '12. Incomer ACB / MCCB Rating & Make', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'incomer_mccb_make' },
          { key: 'cap_bank_sizes', label: '13. APFC / Capacitor Bank Sizes', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'cap_bank_sizes' },
          { key: 'mf_meter', label: '14. Multi Function Meter', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'mf_meter' },
          { key: 'voltmeter', label: '15. Volt Meter', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'voltmeter' },
          { key: 'ammeter', label: '16. Ammeter', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'ammeter' },
          { key: 'control_mcb', label: '17. Control MCBs', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'control_mcb' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Enclosure, Foundation & Safety',
        fields: [
          { key: 'foundation_cond', label: '18. Plinth Foundation & Oil Sump', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'foundation_cond' },
          { key: 'cable_laying', label: '19. Laying of MV / LV Cables', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'cable_laying' },
          { key: 'body_condition', label: '20. Kiosk Enclosure Paint & IP Seal', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'body_condition' },
          { key: 'body_earth_terminals', label: '21. Earthing Terminals & Ground Grid', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'body_earth_terminals' },
          { key: 'rubber_mat', label: '22. Insulated Rubber Mat in LV Room', type: 'boolean' },
          { key: 'labelling', label: '23. Danger Board & Signage', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'labelling' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'door_condition', label: '24. Condition of Louvers, Doors & Locks', type: 'select', optionsCategory: 'CSS', optionsFieldKey: 'door_condition' },
          { key: 'operating_levers', label: '25. Availability of Operating Levers', type: 'boolean' }
        ]
      }
    ]
  }
};
