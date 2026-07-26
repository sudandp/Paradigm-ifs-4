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
          { key: 'cable_rating', label: 'Cable Rating', type: 'select', optionsCategory: 'Cable Details' },
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
          { key: 'control_mcb', label: '21. Control MCB', type: 'text' },
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
          { key: 'prv', label: '13. Pressure Relief Valve (PRV)', type: 'boolean' },
          { key: 'drain_valve', label: '14. Drain Valve', type: 'text' },
          { key: 'tap_changer', label: '15. Tap Changer (Automatic / Manual)', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'tap_changer' },
          { key: 'conservator_cond', label: '16. Condition of Oil Conservator', type: 'text' },
          { key: 'explosion_vent', label: '17. Explosion Vent', type: 'boolean' },
          { key: 'buchholz_relay', label: '18. Buchholz Relay', type: 'boolean' },
          { key: 'air_breather', label: '19. Air Breather (Silica Gel)', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'silica_gel' },
          { key: 'body_earth_terminals', label: '20. Earthing Terminals at Transformer Body', type: 'boolean' },
          { key: 'neutral_earth_terminals', label: '21. Earthing Terminals at Neutral', type: 'boolean' },
          { key: 'lifting_lugs', label: '22. Lifting Lugs', type: 'boolean' }
        ]
      },
      {
        sectionKey: 'installation_condition',
        title: 'Installation Condition',
        fields: [
          { key: 'foundation_cond', label: '23. Condition of Foundation', type: 'text' },
          { key: 'cable_laying', label: '24. Laying of Cables', type: 'text' },
          { key: 'incoming_cable_fixing', label: '25. Incoming Cable Fixing & Copper Earthing', type: 'text' },
          { key: 'outgoing_cable_fixing', label: '26. Outgoing Cable Fixing', type: 'text' },
          { key: 'gland_condition', label: '27. Cable Gland Condition', type: 'text' },
          { key: 'gland_earthing', label: '28. Cable Gland Earthing', type: 'boolean' },
          { key: 'body_condition', label: '29. Body Condition', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'body_condition' },
          { key: 'earth_pit_distances', label: '30. Location of Earthing Pits (TR to NEP / BEP)', type: 'text' },
          { key: 'incoming_cable_details', label: '31. Incoming Cable Details (Rating & From)', type: 'select', optionsCategory: 'Cable Details' },
          { key: 'outgoing_cable_details', label: '32. Outgoing Cable Details (Rating & To)', type: 'select', optionsCategory: 'Cable Details' }
        ]
      },
      {
        sectionKey: 'operation_maintenance',
        title: 'Operation & Maintenance',
        fields: [
          { key: 'bescom_tc_no', label: '33. BESCOM TC No.', type: 'text' },
          { key: 'silica_gel_cond', label: '34. Silica Gel Condition', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'silica_gel' },
          { key: 'oil_level', label: '35. Oil Level', type: 'select', optionsCategory: 'TRMaster Data', optionsFieldKey: 'oil_level' },
          { key: 'oil_leakage', label: '36. Oil Leakage if Any', type: 'boolean' },
          { key: 'heating_cables', label: '37. Heating Cables', type: 'text' },
          { key: 'humming_sound', label: '38. Humming Sound if Any', type: 'boolean' }
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
          { key: 'incomer_mccb', label: '5. Incomer MCCB/COS/ACB Details', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'incomer_mccb' },
          { key: 'single_phase_preventor', label: '6. Single Phase Preventor & Logic Circuit', type: 'boolean' },
          { key: 'earth_leakage_relay', label: '7. Earth Leakage Relay Make', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'earth_leakage_relay' },
          { key: 'voltmeter', label: '8. Volt Meter', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'voltmeter' },
          { key: 'ammeter', label: '9. Ammeter', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'ammeter' },
          { key: 'mf_meter', label: '10. Multi Function Meter', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'mf_meter' },
          { key: 'selector_switch_make', label: '11. Selector Switch Make', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'selector_switch' },
          { key: 'phase_lamps', label: '12. Phase Indicating Lamps', type: 'boolean' },
          { key: 'trip_lamps', label: '13. Trip Indicating Lamps', type: 'boolean' },
          { key: 'bescom_master_meter', label: '14. BESCOM Master Meter Details', type: 'text' },
          { key: 'bus_coupler_details', label: '15. Bus Coupler Details', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'bus_coupler' }
        ]
      },
      {
        sectionKey: 'capacitor_banks',
        title: 'Capacitor Bank Details',
        fields: [
          { key: 'cap_incomer_mccb', label: '24. Incoming MCCB Details', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'cap_incomer_mccb' },
          { key: 'pfc_controller', label: '26. PFC Controller Make', type: 'cascading_select', optionsCategory: 'LTKMD', optionsFieldKey: 'pfc_controller' },
          { key: 'cap_bank_sizes', label: 'Capacitor Bank Sizes', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'cap_bank_sizes' }
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
          { key: 'yard_cleanliness', label: '6. Yard Cleanliness', type: 'select', optionsCategory: 'RMUMD', optionsFieldKey: 'body_condition' }
        ]
      },
      {
        sectionKey: 'yard_checks_stage_2',
        title: 'Stage 2: Safety & Initial Reports',
        fields: [
          { key: 'fire_extinguishers', label: '7. Provision of Fire Extinguisher (Type 1, 2, 3)', type: 'select', optionsCategory: 'LTKMD', optionsFieldKey: 'fire_extinguisher' },
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
  }
};
