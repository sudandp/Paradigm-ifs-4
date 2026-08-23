import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Edit2, Trash2, Box, RefreshCw, RotateCcw, Plus, Eye, X, Layers, List, Check, Tag, ChevronDown, Maximize2, Minimize2, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, FileText, BookOpen, Lock, Settings2, Calendar, QrCode } from 'lucide-react';
import { HTMasterOption, HTMasterCategory, HTFieldTarget, CustomFieldSpec, HTFieldType } from '../../types/htYard';
import { htYardMasterDataService } from '../../services/htYardMasterDataService';
import { htYardFieldSpecService, CATEGORY_TO_MODULE_MAP } from '../../services/htYardFieldSpecService';
import { HT_YARD_FIELD_SPECS } from '../../config/htYardFieldSpecs';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const INITIAL_FIELD_TARGETS_MAP: Record<HTMasterCategory, HTFieldTarget[]> = {
  'RMUMD': [
    // 1. Equipment Details
    { key: 'mfr_name', label: 'Manufacturer Name', section: 'Equipment Details' },
    { key: 'capacity', label: 'Current Rating / Capacity', section: 'Equipment Details' },
    { key: 'no_of_ways', label: 'No. of Ways', section: 'Equipment Details' },
    { key: 'no_of_sections', label: 'No. of Sections', section: 'Equipment Details' },

    // 2. 7. Incoming OD 1 Details
    { key: 'cable_rating_rmu', label: 'RMU Cable Rating', section: '7. Incoming OD 1 Details' },
    { key: 'power_indicator', label: 'Power Line Indicators Details', section: '7. Incoming OD 1 Details' },
    { key: 'fault_indicator', label: 'Line Fault Indicator Details', section: '7. Incoming OD 1 Details' },
    { key: 'mf_meter', label: 'Multi Function Meter', section: '7. Incoming OD 1 Details' },
    { key: 'protection_relay', label: 'RMU Protection Relay Details', section: '7. Incoming OD 1 Details' },
    { key: 'sf6_status', label: 'SF-6 Status', section: '7. Incoming OD 1 Details' },
    { key: 'selector_switch', label: 'Selector Switch 1 & 2 Details', section: '7. Incoming OD 1 Details' },
    { key: 'line_charge_indicator', label: 'Line Charge Indicator', section: '7. Incoming OD 1 Details' },

    // 3. HT Control Components
    { key: 'control_mcb', label: "Control MCB's", section: 'HT Control Components' },
    { key: 'voltmeter', label: 'Volt Meter', section: 'HT Control Components' },
    { key: 'master_trip_relay', label: 'Master Trip Relay', section: 'HT Control Components' },
    { key: 'tc_supervision_relay', label: 'Trip Circuit Supervision Relay', section: 'HT Control Components' },
    { key: 'annunciator', label: 'Annunciator', section: 'HT Control Components' },
    { key: 'tr_protection_relay', label: 'Transformer Protection Relay', section: 'HT Control Components' },
    { key: 'selector_switch_relay', label: 'Selector Switch Relay', section: 'HT Control Components' },
    { key: 'power_pack_battery_backup', label: 'Power Pack With Battery Backup', section: 'HT Control Components' },
    { key: 'nonc_contactor', label: 'NO/NC Contactor', section: 'HT Control Components' },
    { key: 'relay_1', label: 'Relay 1', section: 'HT Control Components' },
    { key: 'acb_breaker_make', label: 'ACB Breaker Make', section: 'HT Control Components' },
    { key: 'vcb_breaker_make', label: 'VCB Breaker Make', section: 'HT Control Components' },

    // 4. Installation Condition
    { key: 'foundation_cond', label: 'Condition of Foundation', section: 'Installation Condition' },
    { key: 'cable_laying', label: 'Laying of Cables', section: 'Installation Condition' },
    { key: 'body_condition', label: 'Body Condition', section: 'Installation Condition' },
    { key: 'labelling', label: 'Labelling', section: 'Installation Condition' },

    // 5. Operation & Maintenance
    { key: 'door_condition', label: 'Condition of Doors', section: 'Operation & Maintenance' },

    // 6. Feeder & Section Blocks
    { key: 'outgoing', label: 'Outgoing', section: 'Feeder & Section Blocks' },
    { key: 'ic_og', label: 'I/C/OG', section: 'Feeder & Section Blocks' }
  ],
  'TRMaster Data': [
    // 1. Equipment Details
    { key: 'mfr_name', label: 'Manufacturer Name', section: 'Equipment Details' },
    { key: 'capacity', label: 'Capacity', section: 'Equipment Details' },
    { key: 'coil_material', label: 'Coil Winding Material', section: 'Equipment Details' },

    // 2. Equipment Accessories
    { key: 'oil_level_indicator', label: 'Oil Level Indicator', section: 'Equipment Accessories' },
    { key: 'oil_temp_indicator', label: 'Oil Temperature Indicator', section: 'Equipment Accessories' },
    { key: 'winding_temp_indicator', label: 'Winding Temperature Indicator', section: 'Equipment Accessories' },
    { key: 'prv', label: 'Pressure Relief Valve', section: 'Equipment Accessories' },
    { key: 'drain_valve', label: 'Drain Valve', section: 'Equipment Accessories' },
    { key: 'tap_changer', label: 'Tap Changer', section: 'Equipment Accessories' },
    { key: 'tap_position', label: 'Tap Position', section: 'Equipment Accessories' },
    { key: 'conservator_cond', label: 'Condition of Oil Conservator', section: 'Equipment Accessories' },
    { key: 'explosion_vent', label: 'Explosion Vent', section: 'Equipment Accessories' },
    { key: 'air_breather', label: 'Air Breather Silica Gel', section: 'Equipment Accessories' },
    { key: 'body_earth_terminals', label: 'Earthing Terminals Body', section: 'Equipment Accessories' },
    { key: 'neutral_earth_terminals', label: 'Earthing Terminals Neutral', section: 'Equipment Accessories' },
    { key: 'lifting_lugs', label: 'Lifting Lugs', section: 'Equipment Accessories' },

    // 3. Installation Condition
    { key: 'foundation_cond', label: 'Condition of Foundation', section: 'Installation Condition' },
    { key: 'cable_laying', label: 'Laying of Cables', section: 'Installation Condition' },
    { key: 'incoming_cable_fixing', label: 'Incoming Cable Fixing', section: 'Installation Condition' },
    { key: 'outgoing_cable_fixing', label: 'Outgoing Cable Fixing', section: 'Installation Condition' },
    { key: 'gland_condition', label: 'Cable Gland Condition', section: 'Installation Condition' },
    { key: 'gland_earthing', label: 'Cable Gland Earthing', section: 'Installation Condition' },
    { key: 'body_condition', label: 'Body Condition', section: 'Installation Condition' },

    // 4. Operation & Maintenance
    { key: 'silica_gel', label: 'Silica Gel Condition', section: 'Operation & Maintenance' },
    { key: 'oil_level', label: 'Oil Level', section: 'Operation & Maintenance' },
    { key: 'oil_leakage', label: 'Oil Leakage', section: 'Operation & Maintenance' },
    { key: 'humming_sound', label: 'Humming Sound', section: 'Operation & Maintenance' }
  ],
  'LTKMD': [
    // 1. Equipment Details
    { key: 'mfr_name', label: 'Manufacturer Name', section: 'Equipment Details' },
    { key: 'capacity', label: 'Capacity', section: 'Equipment Details' },

    // 2. Equipment Accessories
    { key: 'incomer_mccb_make', label: 'Incomer MCCB Make', section: 'Equipment Accessories' },
    { key: 'earth_leakage_relay', label: 'Earth Leakage Relay Make', section: 'Equipment Accessories' },
    { key: 'voltmeter', label: 'Volt Meter', section: 'Equipment Accessories' },
    { key: 'ammeter', label: 'Ammeter', section: 'Equipment Accessories' },
    { key: 'mf_meter', label: 'Multi Function Meter', section: 'Equipment Accessories' },
    { key: 'selector_switch_make', label: 'Selector Switch Make', section: 'Equipment Accessories' },
    { key: 'bescom_master_meter', label: 'BESCOM Master Meter Details', section: 'Equipment Accessories' },
    { key: 'bus_coupler', label: 'Bus Coupler Details', section: 'Equipment Accessories' },
    { key: 'bescom_seal', label: 'BESCOM Seal', section: 'Equipment Accessories' },
    { key: 'ct_ratio', label: 'CT Ratio', section: 'Equipment Accessories' },
    { key: 'ct_constant', label: 'CT Constant', section: 'Equipment Accessories' },
    { key: 'ct_va', label: 'CT VA', section: 'Equipment Accessories' },
    { key: 'ct_cl', label: 'CT CL', section: 'Equipment Accessories' },
    { key: 'ct_classification', label: 'CT Classification', section: 'Equipment Accessories' },

    // 3. Capacitor Bank Details
    { key: 'pfc_controller', label: 'PFC Controller Make', section: 'Capacitor Bank Details' },
    { key: 'cap_bank_sizes', label: 'Capacitor Bank Sizes', section: 'Capacitor Bank Details' },
    { key: 'relay_timer_lvm', label: 'Relay / Timer / LVM', section: 'Capacitor Bank Details' },
    { key: 'outgoing_mccb_make', label: 'Outgoing MCCB Make', section: 'Capacitor Bank Details' },
    { key: 'outgoing_capacity', label: 'Outgoing Capacity', section: 'Capacitor Bank Details' },

    // 4. Installation Condition & Safety
    { key: 'cable_details', label: 'Cable Details (Rating & Cores)', section: 'Installation Condition & Safety' }
  ],
  'Cable Details': [
    { key: 'cable_rating_rmu', label: 'RMU Cable Rating', section: 'RMU Cable Details' },
    { key: 'cable_rating_transformer', label: 'Transformer Cable Details', section: 'Transformer Cable Details' },
    { key: 'cable_rating_ltkiosk', label: 'LT Kiosk Cable Details', section: 'LT Kiosk Cable Details' }
  ],
  'HTYardCommon': [
    { key: 'yard_cleanliness', label: 'Yard Cleanliness', section: 'Stage 1: Yard Infrastructure & Environment' },
    { key: 'fire_extinguishers', label: 'Fire Extinguishers', section: 'Stage 2: Safety & Initial Reports' }
  ]
};

export const HTMasterDataAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HTMasterCategory>('RMUMD');
  const [options, setOptions] = useState<HTMasterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('All');
  const [fieldTargetsMap, setFieldTargetsMap] = useState<Record<string, HTFieldTarget[]>>(() => {
    try {
      const saved = localStorage.getItem('ht_custom_field_targets');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: Record<string, HTFieldTarget[]> = { ...INITIAL_FIELD_TARGETS_MAP };
        Object.keys(parsed).forEach((cat) => {
          const defaultList = merged[cat] || [];
          const customList: HTFieldTarget[] = parsed[cat] || [];
          const defaultKeyMap = new Map(defaultList.map(t => [t.key, t]));

          const mergedList: HTFieldTarget[] = defaultList.map(d => {
            const override = customList.find(c => c.key === d.key);
            return override ? { ...d, label: override.label || d.label, section: override.section || d.section } : d;
          });

          customList.forEach(c => {
            if (!defaultKeyMap.has(c.key)) {
              mergedList.push(c);
            }
          });
          merged[cat] = mergedList;
        });
        return merged;
      }
    } catch (err) {
      console.debug('Failed to parse ht_custom_field_targets', err);
    }
    return INITIAL_FIELD_TARGETS_MAP;
  });

  // Accordion state
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [quickAddInputs, setQuickAddInputs] = useState<Record<string, string>>({});

  const { user: currentUser, loginWithPasscode } = useAuthStore();

  // Delete Password Modal state
  const [deletePasswordModal, setDeletePasswordModal] = useState<{
    isOpen: boolean;
    type: 'CATEGORY' | 'OPTION' | 'FIELD';
    targetName: string;
    targetId?: string;
    passwordInput: string;
    isVerifying: boolean;
  }>({
    isOpen: false,
    type: 'OPTION',
    targetName: '',
    passwordInput: '',
    isVerifying: false
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddTargetModal, setShowAddTargetModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showTemplateInfoModal, setShowTemplateInfoModal] = useState(false);
  const [isCustomKey, setIsCustomKey] = useState(false);

  const [editingOption, setEditingOption] = useState<Partial<HTMasterOption>>({
    category: 'RMUMD',
    fieldKey: 'mfr_name',
    optionValue: '',
    manufacturer: ''
  });

  // Dynamic Field Customization & Type Conversion State
  const [customFieldSpecs, setCustomFieldSpecs] = useState<CustomFieldSpec[]>([]);
  const [showConfigureFieldModal, setShowConfigureFieldModal] = useState(false);
  const [configuringField, setConfiguringField] = useState<{
    category: HTMasterCategory;
    moduleType: string;
    sectionKey: string;
    sectionTitle: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: HTFieldType;
    unit?: string;
    placeholder?: string;
    isCustom?: boolean;
    initialChoice?: string;
  } | null>(null);

  // Custom Target Field & Category states
  const [newTargetLabel, setNewTargetLabel] = useState('');
  const [newTargetKey, setNewTargetKey] = useState('');
  const [newTargetSection, setNewTargetSection] = useState('');
  const [newTargetType, setNewTargetType] = useState<HTFieldType>('select');
  const [newTargetChoices, setNewTargetChoices] = useState('');
  const [newTargetUnit, setNewTargetUnit] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Viewing Choices Modal State
  const [viewingTargetKey, setViewingTargetKey] = useState<string | null>(null);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [listModalSearch, setListModalSearch] = useState('');

  // Inline Edit State inside Modal
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditingValue, setInlineEditingValue] = useState('');

  // Bulk Upload & Cell Validation States
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showBulkPreviewModal, setShowBulkPreviewModal] = useState(false);
  const [bulkParsedRows, setBulkParsedRows] = useState<Array<{
    id: string;
    rowIndex: number;
    category: string;
    fieldKey: string;
    fieldLabel: string;
    optionValue: string;
    manufacturer?: string;
    status: 'valid' | 'duplicate' | 'error';
    errorMessage?: string;
    isSelected: boolean;
  }>>([]);
  const [bulkFilterStatus, setBulkFilterStatus] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');
  const [isImportingBulk, setIsImportingBulk] = useState(false);

  // Download Pre-Formatted Multi-Sheet Bulk Upload Template (.XLSX)
  const downloadBulkTemplate = async () => {
    try {
      const [ExcelJSModule, { saveAs }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
      ]);
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Paradigm Office Admin Studio';
      workbook.created = new Date();

      // ---------------------------------------------------------
      // SHEET 1: Upload Data (Main Data Entry Sheet)
      // ---------------------------------------------------------
      const uploadSheet = workbook.addWorksheet('Upload Data', {
        views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
      });

      uploadSheet.columns = [
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Target Field Name', key: 'targetFieldName', width: 35 },
        { header: 'Dropdown Choice Value', key: 'optionValue', width: 35 },
        { header: 'Manufacturer Scope (Optional)', key: 'manufacturer', width: 30 }
      ];

      // Header Styling for Sheet 1
      const headerRow = uploadSheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0F5132' } // Dark Emerald Green
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
      headerRow.height = 28;

      // Upload Data sheet is left clean for user data entry (Instructions & Reference are in Sheet 2)

      // ---------------------------------------------------------
      // SHEET 2: Instructions & Reference (Pre-filled Guide Sheet)
      // ---------------------------------------------------------
      const refSheet = workbook.addWorksheet('Instructions & Reference', {
        views: [{ showGridLines: true }]
      });

      refSheet.columns = [
        { width: 25 },
        { width: 38 },
        { width: 50 },
        { width: 25 }
      ];

      // Banner Title
      refSheet.mergeCells('A1:D1');
      const titleCell = refSheet.getCell('A1');
      titleCell.value = 'HT MASTER DATA BULK UPLOAD INSTRUCTIONS & REFERENCE GUIDE';
      titleCell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 13 };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      refSheet.getRow(1).height = 34;

      // Section 1 Header
      refSheet.mergeCells('A3:D3');
      const sec1Cell = refSheet.getCell('A3');
      sec1Cell.value = '1. HOW TO FILL THE UPLOAD DATA SHEET (COLUMN GUIDANCE)';
      sec1Cell.font = { bold: true, color: { argb: '0F5132' }, size: 11 };
      sec1Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
      refSheet.getRow(3).height = 24;

      const instructions = [
        ['Column Name', 'Required?', 'Description & Rules', 'Example Values'],
        ['Category', 'YES', 'Equipment category name. Must match one of the valid categories below.', 'RMUMD, TRMaster Data, LTKMD'],
        ['Target Field Name', 'YES', 'Exact form field title for this dropdown choice. Must match valid target fields below.', 'Manufacturer Name, Capacity'],
        ['Dropdown Choice Value', 'YES', 'The actual dropdown choice option value to be added.', 'ABB, Siemens, 1000 KVA'],
        ['Manufacturer Scope', 'NO (Optional)', 'Leave blank for global choices, or type manufacturer name for vendor-specific choices.', 'ABB, Schneider, (or leave blank)']
      ];

      instructions.forEach((inst, idx) => {
        const row = refSheet.addRow(inst);
        if (idx === 0) {
          row.font = { bold: true, color: { argb: 'FFFFFF' } };
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
        }
      });

      // Section 2 Header: Pre-filled Reference List
      refSheet.addRow([]);
      refSheet.mergeCells('A10:D10');
      const sec2Cell = refSheet.getCell('A10');
      sec2Cell.value = '2. PRE-FILLED REFERENCE LIST OF VALID CATEGORIES & TARGET FIELDS';
      sec2Cell.font = { bold: true, color: { argb: '0F5132' }, size: 11 };
      sec2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
      refSheet.getRow(10).height = 24;

      const refHeader = refSheet.addRow(['Equipment Category', 'Target Field Name', 'Description', 'Current Choice Count']);
      refHeader.font = { bold: true, color: { argb: 'FFFFFF' } };
      refHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };

      // Pre-fill All Available Target Fields from System Map
      categories.forEach((cat) => {
        const targets = fieldTargetsMap[cat] || INITIAL_FIELD_TARGETS_MAP[cat] || [];
        targets.forEach((t) => {
          const count = options.filter(o => o.category === cat && o.fieldKey === t.key).length;
          refSheet.addRow([cat, t.label, t.section ? `Section: ${t.section}` : `Form dropdown field for ${cat}`, `${count} existing choices`]);
        });
      });

      // Export & Trigger Browser Save
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'HT Master Data Template.xlsx');
      toast.success('Downloaded Multi-Sheet Excel Template (.XLSX) with Instructions!');
    } catch (err) {
      console.error('Error generating Excel template:', err);
      toast.error('Failed to generate Excel template');
    }
  };

  // Multi-Format File Parser (XLSX & CSV) & Cell Validation Engine
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedRows = [];

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const ExcelJSModule = await import('exceljs');
        const ExcelJS = ExcelJSModule.default || ExcelJSModule;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.getWorksheet('Upload Data') || workbook.worksheets[0];

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          const category = String(row.getCell(1).value || activeTab).trim();
          const rawFieldLabel = String(row.getCell(2).value || 'Manufacturer Name').trim();
          const optionValue = String(row.getCell(3).value || '').trim();
          const manufacturer = row.getCell(4).value ? String(row.getCell(4).value).trim() : undefined;

          if (!category && !rawFieldLabel && !optionValue) return;

          let fieldKey = rawFieldLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          const matchedTarget = (fieldTargetsMap[category as HTMasterCategory] || []).find(
            t => t.label.toLowerCase() === rawFieldLabel.toLowerCase() || t.key.toLowerCase() === rawFieldLabel.toLowerCase()
          );
          if (matchedTarget) {
            fieldKey = matchedTarget.key;
          }

          let status: 'valid' | 'duplicate' | 'error' = 'valid';
          let errorMessage: string | undefined = undefined;

          const sampleValues = ['ABB India Ltd', 'Siemens Limited', '1000 KVA', 'L&T Switchgear', '3C x 300 Sq.mm XLPE'];
          const isSampleRow = sampleValues.some(s => s.toLowerCase() === optionValue.toLowerCase());

          if (!optionValue) {
            status = 'error';
            errorMessage = 'Dropdown choice value cannot be blank';
          } else {
            const isDup = options.some(
              o => o.category === category && o.fieldKey === fieldKey && o.optionValue.toLowerCase() === optionValue.toLowerCase()
            );
            if (isDup) {
              status = 'duplicate';
              errorMessage = 'Choice already exists in DB';
            }
          }

          let isSelected = status !== 'error';
          if (isSampleRow) {
            isSelected = false; // Uncheck sample rows by default
            if (status === 'valid') {
              status = 'duplicate';
              errorMessage = 'Template Sample Row (Skipped by default)';
            }
          }

          parsedRows.push({
            id: `bulk-row-${rowNumber}-${Date.now()}`,
            rowIndex: rowNumber,
            category,
            fieldKey,
            fieldLabel: matchedTarget ? matchedTarget.label : rawFieldLabel,
            optionValue,
            manufacturer,
            status,
            errorMessage,
            isSelected
          });
        });
      } else {
        const text = await file.text();
        const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
        for (let i = 1; i < lines.length; i++) {
          const rawLine = lines[i];
          const matches = rawLine.match(/(?:^|,)(?:"([^"]*)"|([^,]*))/g);
          if (!matches) continue;

          const cols = matches.map(m => {
            let val = m.replace(/^,/, '').trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/""/g, '"');
            }
            return val;
          });

          const category = cols[0] || activeTab;
          const rawFieldLabel = cols[1] || 'Manufacturer Name';
          const optionValue = cols[2] || '';
          const manufacturer = cols[3] || undefined;

          let fieldKey = rawFieldLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          const matchedTarget = (fieldTargetsMap[category as HTMasterCategory] || []).find(
            t => t.label.toLowerCase() === rawFieldLabel.toLowerCase() || t.key.toLowerCase() === rawFieldLabel.toLowerCase()
          );
          if (matchedTarget) {
            fieldKey = matchedTarget.key;
          }

          let status: 'valid' | 'duplicate' | 'error' = 'valid';
          let errorMessage: string | undefined = undefined;

          const sampleValues = ['ABB India Ltd', 'Siemens Limited', '1000 KVA', 'L&T Switchgear', '3C x 300 Sq.mm XLPE'];
          const isSampleRow = sampleValues.some(s => s.toLowerCase() === optionValue.trim().toLowerCase());

          if (!optionValue.trim()) {
            status = 'error';
            errorMessage = 'Dropdown choice value cannot be blank';
          } else {
            const isDup = options.some(
              o => o.category === category && o.fieldKey === fieldKey && o.optionValue.toLowerCase() === optionValue.trim().toLowerCase()
            );
            if (isDup) {
              status = 'duplicate';
              errorMessage = 'Choice already exists in DB';
            }
          }

          let isSelected = status !== 'error';
          if (isSampleRow) {
            isSelected = false; // Uncheck sample rows by default
            if (status === 'valid') {
              status = 'duplicate';
              errorMessage = 'Template Sample Row (Skipped by default)';
            }
          }

          parsedRows.push({
            id: `bulk-row-${i}-${Date.now()}`,
            rowIndex: i + 1,
            category: category.trim(),
            fieldKey,
            fieldLabel: matchedTarget ? matchedTarget.label : rawFieldLabel.trim(),
            optionValue: optionValue.trim(),
            manufacturer: manufacturer ? manufacturer.trim() : undefined,
            status,
            errorMessage,
            isSelected
          });
        }
      }

      if (parsedRows.length === 0) {
        toast.error('No valid rows parsed from file');
        return;
      }

      setBulkParsedRows(parsedRows);
      setShowBulkUploadModal(false);
      setShowBulkPreviewModal(true);
      toast.success(`Parsed ${parsedRows.length} rows. Please review before importing.`);
    } catch (err) {
      console.error('Error reading upload file:', err);
      toast.error('Error reading upload file');
    }
  };

  // Execute Approved Batch Import
  const handleApproveBulkImport = async () => {
    const selectedRows = bulkParsedRows.filter(r => r.isSelected && r.status !== 'error');
    if (selectedRows.length === 0) {
      toast.error('No valid rows selected for import');
      return;
    }

    setIsImportingBulk(true);
    let count = 0;
    try {
      for (const row of selectedRows) {
        await htYardMasterDataService.saveMasterOption({
          category: row.category as HTMasterCategory,
          fieldKey: row.fieldKey,
          optionValue: row.optionValue,
          manufacturer: row.manufacturer,
          isActive: true
        });
        count++;
      }
      toast.success(`Successfully imported ${count} master options!`);
      setShowBulkPreviewModal(false);
      setBulkParsedRows([]);
      const updatedData = await htYardMasterDataService.getMasterOptions(activeTab);
      setOptions(updatedData);
    } catch (err) {
      toast.error('Failed during bulk import execution');
    } finally {
      setIsImportingBulk(false);
    }
  };

  // Dynamic Categories State
  const defaultCategories: HTMasterCategory[] = ['RMUMD', 'TRMaster Data', 'LTKMD', 'Cable Details', 'HTYardCommon'];
  const [categories, setCategories] = useState<HTMasterCategory[]>(() => {
    try {
      const saved = localStorage.getItem('ht_custom_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.from(new Set([...defaultCategories, ...parsed]));
      }
    } catch (err) {
      console.debug('Failed to parse ht_custom_categories', err);
    }
    return defaultCategories;
  });

  useEffect(() => {
    setSearchQuery('');
    setSelectedSection('All');
    setSelectedFieldKey('All');
    loadOptions();
    loadCustomSpecs();

    const handleSpecUpdate = () => {
      loadCustomSpecs();
      loadOptions();
    };
    window.addEventListener('ht_field_specs_updated', handleSpecUpdate);
    return () => window.removeEventListener('ht_field_specs_updated', handleSpecUpdate);
  }, [activeTab]);

  const loadCustomSpecs = async () => {
    try {
      const specs = await htYardFieldSpecService.getCustomFieldSpecs(activeTab);
      setCustomFieldSpecs(specs);
    } catch (e) {
      console.warn('Failed to load custom field specs', e);
    }
  };

  const loadOptions = async () => {
    setLoading(true);
    try {
      const data = await htYardMasterDataService.getMasterOptions(activeTab);
      setOptions(data);

      if (data && data.length > 0) {
        setFieldTargetsMap(prev => {
          const currentList = prev[activeTab] || [];
          const existingKeys = new Set(currentList.map(t => t.key));
          const newTargets: HTFieldTarget[] = [];

          data.forEach(opt => {
            if (opt.fieldKey && opt.fieldKey !== 'generic' && !existingKeys.has(opt.fieldKey)) {
              existingKeys.add(opt.fieldKey);
              const formattedLabel = opt.fieldKey
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              newTargets.push({ key: opt.fieldKey, label: formattedLabel, section: opt.section });
            }
          });

          if (newTargets.length > 0) {
            const updated = {
              ...prev,
              [activeTab]: [...currentList, ...newTargets]
            };
            try {
              localStorage.setItem('ht_custom_field_targets', JSON.stringify(updated));
            } catch (err) {
              console.debug('Failed to save ht_custom_field_targets', err);
            }
            return updated;
          }
          return prev;
        });
      }
    } catch (error) {
      toast.error('Failed to load master options');
    } finally {
      setLoading(false);
    }
  };

  const logMasterDataActivity = (actionType: 'CREATE' | 'EDIT' | 'DELETE', target: string, details: string) => {
    try {
      const newLog = {
        id: `log-md-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ', ' + new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
        userName: currentUser?.name || 'Sudhan M',
        userRole: currentUser?.role || 'Admin',
        actionType,
        target,
        details,
        moduleType: 'MASTER_DATA',
        siteName: 'HT Master Data'
      };
      const raw = localStorage.getItem('paradigm_master_data_audit_logs');
      const existing = raw ? JSON.parse(raw) : [];
      localStorage.setItem('paradigm_master_data_audit_logs', JSON.stringify([newLog, ...existing]));
    } catch (e) {
      console.warn('[HTMasterDataAdmin] Failed to save log entry:', e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOption.optionValue?.trim()) {
      toast.error('Option value is required');
      return;
    }

    try {
      await htYardMasterDataService.saveMasterOption({
        ...editingOption,
        category: activeTab
      });
      logMasterDataActivity('CREATE', editingOption.optionValue.trim(), `Added choice "${editingOption.optionValue.trim()}" for field "${editingOption.fieldKey}" in category "${activeTab}"`);
      toast.success('Option saved successfully');
      setShowAddModal(false);
      loadOptions();
    } catch (error) {
      toast.error('Failed to save option');
    }
  };

  const handleQuickAddChoice = async (fieldKey: string) => {
    if (!quickAddValue.trim()) return;
    try {
      await htYardMasterDataService.saveMasterOption({
        category: activeTab,
        fieldKey: fieldKey,
        optionValue: quickAddValue.trim()
      });
      logMasterDataActivity('CREATE', quickAddValue.trim(), `Added choice "${quickAddValue.trim()}" for field "${fieldKey}" in category "${activeTab}"`);
      toast.success(`Added "${quickAddValue.trim()}"`);
      setQuickAddValue('');
      loadOptions();
    } catch (error) {
      toast.error('Failed to add option choice');
    }
  };

  const handleInlineSave = async (item: HTMasterOption) => {
    if (!inlineEditingValue.trim()) return;
    try {
      await htYardMasterDataService.saveMasterOption({
        ...item,
        optionValue: inlineEditingValue.trim()
      });
      logMasterDataActivity('EDIT', inlineEditingValue.trim(), `Updated choice value from "${item.optionValue}" to "${inlineEditingValue.trim()}" in category "${activeTab}"`);
      toast.success('Choice updated');
      setInlineEditingId(null);
      loadOptions();
    } catch (error) {
      toast.error('Failed to update choice');
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }
    const catName = newCategoryName.trim();
    if (categories.includes(catName)) {
      toast.error('Category already exists');
      return;
    }
    const updated = [...categories, catName];
    setCategories(updated);
    try {
      const customOnly = updated.filter(c => !defaultCategories.includes(c));
      localStorage.setItem('ht_custom_categories', JSON.stringify(customOnly));
    } catch (err) {
      console.debug('Failed to save ht_custom_categories', err);
    }

    logMasterDataActivity('CREATE', catName, `Created new Master Data Category "${catName}"`);
    setActiveTab(catName);
    toast.success(`Category "${catName}" created!`);
    setShowAddCategoryModal(false);
    setNewCategoryName('');

    // Automatically prompt to add the first target field for this category
    setShowAddTargetModal(true);
  };

  const promptDeleteCategory = (catName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletePasswordModal({
      isOpen: true,
      type: 'CATEGORY',
      targetName: catName,
      passwordInput: '',
      isVerifying: false
    });
  };

  const promptDeleteOption = (id: string, optionValue: string) => {
    setDeletePasswordModal({
      isOpen: true,
      type: 'OPTION',
      targetName: optionValue,
      targetId: id,
      passwordInput: '',
      isVerifying: false
    });
  };

  const promptDeleteField = (fieldKey: string, fieldLabel: string, sectionTitle?: string) => {
    setDeletePasswordModal({
      isOpen: true,
      type: 'FIELD',
      targetName: fieldLabel,
      targetId: fieldKey,
      passwordInput: '',
      isVerifying: false
    });
  };

  const handleCreateNewTargetField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetLabel.trim() || !newTargetKey.trim()) {
      toast.error('Both field name and technical key are required');
      return;
    }

    const cleanKey = newTargetKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const label = newTargetLabel.trim();
    const sectionTitle = newTargetSection.trim() || 'Equipment Details';
    const sectionKey = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const moduleType = CATEGORY_TO_MODULE_MAP[activeTab] || 'RMU';

    try {
      // 1. Save Field Spec to htYardFieldSpecService
      const newSpec: CustomFieldSpec = {
        category: activeTab,
        moduleType: moduleType,
        sectionKey: sectionKey,
        sectionTitle: sectionTitle,
        fieldKey: cleanKey,
        fieldLabel: label,
        fieldType: newTargetType,
        unit: newTargetUnit.trim() || undefined,
        optionsCategory: activeTab,
        optionsFieldKey: cleanKey,
        isCustom: true,
        isActive: true
      };

      await htYardFieldSpecService.saveFieldSpec(newSpec);

      // 2. If dropdown and initial choices provided, save them
      if (newTargetChoices.trim() && (newTargetType === 'select' || newTargetType === 'searchable_select')) {
        const choices = newTargetChoices.split(',').map(c => c.trim()).filter(Boolean);
        for (const choice of choices) {
          await htYardMasterDataService.saveMasterOption({
            category: activeTab,
            fieldKey: cleanKey,
            optionValue: choice,
            isActive: true
          });
        }
      }

      setFieldTargetsMap(prev => {
        const currentList = prev[activeTab] || [];
        const exists = currentList.some(t => t.key === cleanKey);
        const updatedList = exists
          ? currentList.map(t => t.key === cleanKey ? { key: cleanKey, label, section: sectionTitle } : t)
          : [...currentList, { key: cleanKey, label, section: sectionTitle }];

        const updated = {
          ...prev,
          [activeTab]: updatedList
        };
        try {
          localStorage.setItem('ht_custom_field_targets', JSON.stringify(updated));
        } catch (err) {
          console.debug('Failed to save ht_custom_field_targets', err);
        }
        return updated;
      });

      logMasterDataActivity('CREATE', label, `Created new target field "${label}" (${cleanKey}) [Type: ${newTargetType}] in section "${sectionTitle}" for category "${activeTab}"`);
      toast.success(`Target field "${label}" [${newTargetType}] created!`);
      setShowAddTargetModal(false);
      setNewTargetLabel('');
      setNewTargetKey('');
      setNewTargetSection('');
      setNewTargetChoices('');
      setNewTargetUnit('');
      setNewTargetType('select');

      await loadCustomSpecs();
      await loadOptions();
    } catch (err) {
      toast.error('Failed to create field');
    }
  };

  const handleSaveFieldConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringField) return;

    try {
      const sectionTitle = configuringField.sectionTitle || 'Equipment Details';
      const sectionKey = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const updatedSpec: CustomFieldSpec = {
        category: configuringField.category,
        moduleType: configuringField.moduleType || CATEGORY_TO_MODULE_MAP[configuringField.category] || 'RMU',
        sectionKey: sectionKey,
        sectionTitle: sectionTitle,
        fieldKey: configuringField.fieldKey,
        fieldLabel: configuringField.fieldLabel,
        fieldType: configuringField.fieldType,
        unit: configuringField.unit || undefined,
        placeholder: configuringField.placeholder || undefined,
        optionsCategory: configuringField.category,
        optionsFieldKey: configuringField.fieldKey,
        isCustom: true,
        isActive: true
      };

      await htYardFieldSpecService.saveFieldSpec(updatedSpec);

      // Also update fieldTargetsMap for responsive label and section change
      setFieldTargetsMap(prev => {
        const currentList = prev[configuringField.category] || [];
        const exists = currentList.some(t => t.key === configuringField.fieldKey);
        const updatedList = exists
          ? currentList.map(t => t.key === configuringField.fieldKey ? { ...t, label: configuringField.fieldLabel, section: sectionTitle } : t)
          : [...currentList, { key: configuringField.fieldKey, label: configuringField.fieldLabel, section: sectionTitle }];
        const updated = {
          ...prev,
          [configuringField.category]: updatedList
        };
        try {
          localStorage.setItem('ht_custom_field_targets', JSON.stringify(updated));
        } catch (err) {
          console.debug('Failed to save ht_custom_field_targets', err);
        }
        return updated;
      });

      // If initial choice added during dropdown conversion
      if (configuringField.initialChoice?.trim() && (configuringField.fieldType === 'select' || configuringField.fieldType === 'searchable_select')) {
        const choices = configuringField.initialChoice.split(',').map(c => c.trim()).filter(Boolean);
        for (const choice of choices) {
          await htYardMasterDataService.saveMasterOption({
            category: configuringField.category,
            fieldKey: configuringField.fieldKey,
            optionValue: choice,
            isActive: true
          });
        }
      }

      logMasterDataActivity('EDIT', configuringField.fieldLabel, `Updated Field "${configuringField.fieldLabel}" [Type: ${configuringField.fieldType}, Section: ${sectionTitle}] for category "${configuringField.category}"`);
      toast.success(`Updated field "${configuringField.fieldLabel}"!`);
      setShowConfigureFieldModal(false);
      setConfiguringField(null);

      await loadCustomSpecs();
      await loadOptions();
    } catch (err) {
      toast.error('Failed to save field configuration');
    }
  };

  const handleDelete = (id: string) => {
    const opt = options.find(o => o.id === id);
    promptDeleteOption(id, opt?.optionValue || 'Option');
  };

  const handleConfirmPasswordDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePasswordModal.passwordInput.trim()) {
      toast.error('Password is required');
      return;
    }

    setDeletePasswordModal(prev => ({ ...prev, isVerifying: true }));
    try {
      const email = currentUser?.email;
      const inputPass = deletePasswordModal.passwordInput.trim();
      let verified = false;

      // Strategy 1: Check Database User Passcode (matches user's active passcode/PIN in database)
      if (currentUser?.id) {
        try {
          const dbPasscode = await api.getUserPasscode(currentUser.id);
          if (dbPasscode && dbPasscode === inputPass) {
            verified = true;
          }
        } catch {
          // ignore error and proceed
        }
      }

      // Strategy 2: Check current user in-memory profile passcode
      if (!verified && currentUser?.passcode && currentUser.passcode === inputPass) {
        verified = true;
      }

      // Strategy 3: Try loginWithPasscode (handles 4-digit 'PAR_xxxx' and normal passwords)
      if (!verified && email && loginWithPasscode) {
        try {
          const res = await loginWithPasscode(email, inputPass, true);
          if (!res.error) {
            verified = true;
          }
        } catch {
          // ignore
        }
      }

      // Strategy 4: Direct Supabase auth sign-in with raw password
      if (!verified && email) {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: inputPass
          });
          if (!error) {
            verified = true;
          }
        } catch {
          // ignore
        }
      }

      // Strategy 5: If 4-digit numeric passcode, try 'PAR_' prefix with Supabase auth
      if (!verified && email && /^\d{4}$/.test(inputPass)) {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: `PAR_${inputPass}`
          });
          if (!error) {
            verified = true;
          }
        } catch {
          // ignore
        }
      }

      if (!verified) {
        toast.error('Incorrect password! Verification failed.');
        setDeletePasswordModal(prev => ({ ...prev, isVerifying: false }));
        return;
      }

      // Password matched! Execute actual deletion
      if (deletePasswordModal.type === 'CATEGORY') {
        const catName = deletePasswordModal.targetName;
        const categoryOptions = await htYardMasterDataService.getMasterOptions(catName);
        for (const opt of categoryOptions) {
          await htYardMasterDataService.deleteMasterOption(opt.id, catName);
        }
        const updated = categories.filter(c => c !== catName);
        setCategories(updated);
        const customOnly = updated.filter(c => !defaultCategories.includes(c));
        try {
          localStorage.setItem('ht_custom_categories', JSON.stringify(customOnly));
        } catch (err) {
          console.debug('Failed to save ht_custom_categories', err);
        }
        if (activeTab === catName) {
          setActiveTab(updated[0] || 'RMUMD');
        }
        logMasterDataActivity('DELETE', catName, `Deleted Master Data Category "${catName}" and all associated options`);
        toast.success(`Category "${catName}" deleted successfully!`);
      } else if (deletePasswordModal.type === 'FIELD' && deletePasswordModal.targetId) {
        const fieldKey = deletePasswordModal.targetId;
        const fieldLabel = deletePasswordModal.targetName;
        const sectionTitle = groupedFields.find(g => g.fieldKey === fieldKey)?.section || 'Equipment Details';
        const sectionKey = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // 1. Delete from Field Spec service
        await htYardFieldSpecService.deleteFieldSpec(activeTab, fieldKey, sectionKey);

        // 2. Delete all options belonging to this field in this category
        const fieldOptions = options.filter(o => o.fieldKey === fieldKey);
        for (const opt of fieldOptions) {
          await htYardMasterDataService.deleteMasterOption(opt.id, activeTab);
        }

        // 3. Remove from fieldTargetsMap and localStorage
        setFieldTargetsMap(prev => {
          const currentList = prev[activeTab] || [];
          const updatedList = currentList.filter(t => t.key !== fieldKey);
          const updated = {
            ...prev,
            [activeTab]: updatedList
          };
          try {
            localStorage.setItem('ht_custom_field_targets', JSON.stringify(updated));
          } catch (err) {
            console.debug('Failed to save ht_custom_field_targets', err);
          }
          return updated;
        });

        logMasterDataActivity('DELETE', fieldLabel, `Deleted field "${fieldLabel}" (${fieldKey}) and all associated choices from category "${activeTab}"`);
        toast.success(`Field "${fieldLabel}" deleted successfully!`);
        await loadCustomSpecs();
        await loadOptions();
      } else if (deletePasswordModal.type === 'OPTION' && deletePasswordModal.targetId) {
        await htYardMasterDataService.deleteMasterOption(deletePasswordModal.targetId, activeTab);
        logMasterDataActivity('DELETE', deletePasswordModal.targetName, `Deleted choice option "${deletePasswordModal.targetName}" from category "${activeTab}"`);
        toast.success(`Option "${deletePasswordModal.targetName}" deleted successfully!`);
        loadOptions();
      }

      setDeletePasswordModal({
        isOpen: false,
        type: 'OPTION',
        targetName: '',
        passwordInput: '',
        isVerifying: false
      });
    } catch (err) {
      toast.error('Failed to verify password and delete item');
      setDeletePasswordModal(prev => ({ ...prev, isVerifying: false }));
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm(`Restore default seed options for category ${activeTab}? Custom local additions will be refreshed.`)) return;
    try {
      await htYardMasterDataService.resetToInitialSeed(activeTab);
      toast.success('Default options restored');
      loadOptions();
    } catch (error) {
      toast.error('Failed to restore defaults');
    }
  };

  const availableFieldTargets = fieldTargetsMap[activeTab] || [];

  // Group options by field target key with full baseline + custom field spec merge
  const groupedFields = useMemo(() => {
    const map = new Map<string, { 
      fieldKey: string; 
      label: string; 
      section?: string; 
      category: HTMasterCategory; 
      fieldType: HTFieldType;
      unit?: string;
      placeholder?: string;
      isCustom?: boolean;
      items: HTMasterOption[] 
    }>();

    // 1. Module Spec baseline fields from HT_YARD_FIELD_SPECS for this category
    const moduleType = CATEGORY_TO_MODULE_MAP[activeTab] || 'RMU';
    const baseModule = HT_YARD_FIELD_SPECS[moduleType];
    if (baseModule) {
      baseModule.sections.forEach(sec => {
        sec.fields.forEach(f => {
          map.set(f.key, {
            fieldKey: f.key,
            label: f.label.replace(/^\d+\.\s*/, ''), // clean leading number for admin title
            section: sec.title,
            category: activeTab,
            fieldType: f.type || 'text',
            unit: f.unit,
            placeholder: f.placeholder,
            isCustom: false,
            items: []
          });
        });
      });
    }

    // 2. Pre-populate with all known field targets for activeTab
    availableFieldTargets.forEach(t => {
      if (!map.has(t.key)) {
        map.set(t.key, {
          fieldKey: t.key,
          label: t.label,
          section: t.section,
          category: activeTab,
          fieldType: 'select',
          isCustom: true,
          items: []
        });
      } else if (t.section) {
        const existing = map.get(t.key)!;
        existing.section = t.section;
      }
    });

    // 3. Apply custom field specs overrides
    customFieldSpecs.forEach(cs => {
      if (cs.isActive === false) {
        map.delete(cs.fieldKey);
        return;
      }
      map.set(cs.fieldKey, {
        fieldKey: cs.fieldKey,
        label: cs.fieldLabel,
        section: cs.sectionTitle,
        category: activeTab,
        fieldType: cs.fieldType || 'select',
        unit: cs.unit,
        placeholder: cs.placeholder,
        isCustom: cs.isCustom ?? true,
        items: []
      });
    });

    // 4. Add actual option choices to the field items
    options.forEach(opt => {
      const key = opt.fieldKey || 'generic';
      if (!map.has(key)) {
        const friendly = availableFieldTargets.find(t => t.key === key);
        map.set(key, {
          fieldKey: key,
          label: friendly ? friendly.label : key,
          section: friendly?.section || opt.section,
          category: activeTab,
          fieldType: 'select',
          isCustom: true,
          items: []
        });
      }
      map.get(key)!.items.push(opt);
    });

    return Array.from(map.values()).filter(g => {
      const matchesSearch = searchQuery === '' || 
        g.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        g.fieldKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.section && g.section.toLowerCase().includes(searchQuery.toLowerCase())) ||
        g.fieldType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.items.some(i => i.optionValue.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFieldKey = selectedFieldKey === 'All' || g.fieldKey === selectedFieldKey;
      const matchesSection = selectedSection === 'All' || g.section === selectedSection;
      return matchesSearch && matchesFieldKey && matchesSection;
    });
  }, [options, activeTab, searchQuery, selectedFieldKey, selectedSection, fieldTargetsMap, customFieldSpecs]);

  // Available unique sections in activeTab derived from groupedFields
  const availableSections = useMemo(() => {
    const sectionsSet = new Set<string>();
    groupedFields.forEach(t => {
      if (t.section) sectionsSet.add(t.section);
    });
    return Array.from(sectionsSet);
  }, [groupedFields]);

  // Active viewing target group for List Modal
  const activeViewingGroup = useMemo(() => {
    if (!viewingTargetKey) return null;
    return groupedFields.find(g => g.fieldKey === viewingTargetKey) || null;
  }, [viewingTargetKey, groupedFields]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-6 lg:p-10 font-sans">
      
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  HT Master Data Management
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure form field targets, equipment categories, and dropdown choices across HT Yard audits.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${viewMode === 'grouped' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Layers className="w-3.5 h-3.5" /> Grouped Cards
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${viewMode === 'flat' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <List className="w-3.5 h-3.5" /> All Items ({options.length})
              </button>
            </div>

            <button 
              onClick={handleResetDefaults}
              title="Restore default master options for active category"
              className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Reset
            </button>

            <button
              onClick={() => setShowTemplateInfoModal(true)}
              title="Open Template Guide & Pre-filled System Data Reference"
              className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Template Guide
            </button>

            <button
              onClick={() => setShowBulkUploadModal(true)}
              title="Bulk upload choices from Excel/CSV file with pre-import verification"
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Bulk Upload
            </button>

            <Link
              to="/operations/ppm-calendar"
              title="Open Planned Preventive Maintenance Calendar & Checklists"
              className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> PPM Calendar
            </Link>

            <Link
              to="/operations/asset-qr-center"
              title="Open Asset QR Code Tagging, Stickers & Digital Twin Center"
              className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Asset QR Tags
            </Link>

            <button
              onClick={() => setShowAddTargetModal(true)}
              className="px-3.5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-2xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              title="Create a new target field key for this category"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" /> + Field
            </button>

            <button
              onClick={() => {
                const defaultKey = availableFieldTargets[0]?.key || 'mfr_name';
                setEditingOption({ category: activeTab, fieldKey: defaultKey, optionValue: '', manufacturer: '' });
                setIsCustomKey(false);
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> + Option Choice
            </button>
          </div>
        </div>

        {/* Category Navigation Bar (Scalable for 500+ Categories) */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
              Select Category ({categories.length}):
            </span>

            {/* Searchable Dropdown Selector for 500+ Categories */}
            <div className="relative min-w-[220px]">
              <select
                value={activeTab}
                onChange={(e) => {
                  if (e.target.value === '__add_new_category__') {
                    setShowAddCategoryModal(true);
                  } else {
                    setActiveTab(e.target.value as HTMasterCategory);
                  }
                }}
                className="w-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs rounded-2xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer shadow-2xs"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">
                    📂 {c}
                  </option>
                ))}
                <option value="__add_new_category__" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-extrabold">
                  + Create New Category...
                </option>
              </select>
            </div>

            <button
              onClick={() => setShowAddCategoryModal(true)}
              className="px-3.5 py-2 rounded-2xl text-xs font-bold border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> + New Category
            </button>

            <button
              onClick={(e) => promptDeleteCategory(activeTab, e)}
              className="px-3 py-2 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              title={`Delete Category "${activeTab}"`}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Category
            </button>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {categories.length} Categories • {groupedFields.length} Fields • {options.length} Choices
            </span>
          </div>
        </div>
      </div>

      {/* Section Filter Pills */}
      {availableSections.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-thin">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Section:
          </span>
          <button
            onClick={() => {
              setSelectedSection('All');
              setSelectedFieldKey('All');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              selectedSection === 'All'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            All Sections
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${selectedSection === 'All' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {availableFieldTargets.length}
            </span>
          </button>
          {availableSections.map((sec) => {
            const count = availableFieldTargets.filter(t => t.section === sec).length;
            const isSelected = selectedSection === sec;
            return (
              <button
                key={sec}
                onClick={() => {
                  setSelectedSection(sec);
                  setSelectedFieldKey('All');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                📑 {sec}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={selectedFieldKey}
              onChange={(e) => setSelectedFieldKey(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="All">Filter by Target Field: All ({availableFieldTargets.length})</option>
              {availableSections.map(sec => (
                <optgroup key={sec} label={`📁 ${sec}`}>
                  {availableFieldTargets
                    .filter(t => t.section === sec)
                    .map(t => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                </optgroup>
              ))}
              {availableFieldTargets.filter(t => !t.section).length > 0 && (
                <optgroup label="📁 Other Fields">
                  {availableFieldTargets
                    .filter(t => !t.section)
                    .map(t => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          {viewMode === 'grouped' && (
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 rounded-2xl">
              <button
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  groupedFields.forEach(g => { all[g.fieldKey] = true; });
                  setExpandedKeys(all);
                }}
                className="px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                title="Expand all fields to see choices"
              >
                <Maximize2 className="w-3.5 h-3.5 text-emerald-600" /> Expand All
              </button>
              <button
                onClick={() => setExpandedKeys({})}
                className="px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                title="Collapse all fields"
              >
                <Minimize2 className="w-3.5 h-3.5 text-slate-400" /> Collapse All
              </button>
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search choices or fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'grouped' ? (
        /* Accordion / Expandable Fields Layout */
        <div className="space-y-3.5">
          {loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" /> Loading dropdown options for {activeTab}...
            </div>
          ) : groupedFields.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              No fields or choices found for {activeTab}{selectedSection !== 'All' ? ` in section "${selectedSection}"` : ''}.
            </div>
          ) : (
            groupedFields.map((group) => {
              const isExpanded = !!expandedKeys[group.fieldKey];
              const sampleCount = 4;
              const samples = group.items.slice(0, sampleCount);
              const remainingCount = group.items.length - sampleCount;

              return (
                <div
                  key={group.fieldKey}
                  className={`bg-white dark:bg-slate-900 border rounded-3xl transition-all shadow-2xs overflow-hidden ${
                    isExpanded
                      ? 'border-emerald-500/60 dark:border-emerald-500/50 ring-2 ring-emerald-500/10'
                      : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Accordion Header Card */}
                  <div
                    onClick={() => setExpandedKeys(prev => ({ ...prev, [group.fieldKey]: !prev[group.fieldKey] }))}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isExpanded
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60'
                      }`}>
                        <Box className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                            {group.label}
                          </h3>
                          <code className="text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            #{group.fieldKey}
                          </code>
                          {group.section && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                              📑 {group.section}
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400 border border-pink-200/60 dark:border-pink-800/40">
                            {group.category}
                          </span>
                          {/* Dynamic Control Type Badge */}
                          {group.fieldType === 'select' || group.fieldType === 'searchable_select' || group.fieldType === 'cascading_select' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              📋 Dropdown ({group.items.length} choices)
                            </span>
                          ) : group.fieldType === 'gps_location' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              📍 GPS Geo-Tagging (Auto-Fetch)
                            </span>
                          ) : group.fieldType === 'lifespan_calculator' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              ⏳ Life Span & Health Analyzer
                            </span>
                          ) : group.fieldType === 'model_catalog_autofill' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              🤖 Smart Catalog Auto-Fill
                            </span>
                          ) : group.fieldType === 'digital_signature' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              ✍️ Digital Signoff
                            </span>
                          ) : group.fieldType === 'date' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              📅 Date Picker
                            </span>
                          ) : group.fieldType === 'number' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              🔢 Number {group.unit ? `(${group.unit})` : ''}
                            </span>
                          ) : group.fieldType === 'photo' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                              📷 Photo Field
                            </span>
                          ) : group.fieldType === 'textarea' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                              📝 Multiline Remarks
                            </span>
                          ) : group.fieldType === 'boolean' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                              🔘 Toggle / Boolean
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              🔤 Text Input
                            </span>
                          )}
                        </div>

                        {/* Collapsed Preview Chips */}
                        {!isExpanded && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {(group.fieldType === 'select' || group.fieldType === 'searchable_select') ? (
                              group.items.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">No dropdown choices configured yet</span>
                              ) : (
                                <>
                                  {samples.map(item => (
                                    <span key={item.id} className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 truncate max-w-[150px]">
                                      {item.optionValue}
                                    </span>
                                  ))}
                                  {remainingCount > 0 && (
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                                      +{remainingCount} more...
                                    </span>
                                  )}
                                </>
                              )
                            ) : (
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Configured as {group.fieldType} field on Site Audit form • Click Settings to convert
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* Edit Field Settings Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const sectionTitle = group.section || 'Equipment Details';
                          const sectionKey = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
                          const moduleType = CATEGORY_TO_MODULE_MAP[activeTab] || 'RMU';
                          setConfiguringField({
                            category: activeTab,
                            moduleType: moduleType,
                            sectionKey: sectionKey,
                            sectionTitle: sectionTitle,
                            fieldKey: group.fieldKey,
                            fieldLabel: group.label,
                            fieldType: group.fieldType,
                            unit: group.unit || '',
                            placeholder: group.placeholder || '',
                            isCustom: group.isCustom,
                            initialChoice: ''
                          });
                          setShowConfigureFieldModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200/80 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Edit Field Label, Section, Control Type, or Units"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="hidden sm:inline">Edit Field</span>
                      </button>

                      {/* Delete Field Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          promptDeleteField(group.fieldKey, group.label, group.section);
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200/80 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900/60 transition-colors cursor-pointer"
                        title={`Delete Field "${group.label}" & all choices`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {(group.fieldType === 'select' || group.fieldType === 'searchable_select') && (
                        <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border transition-colors ${
                          isExpanded
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                        }`}>
                          {group.items.length} choices
                        </span>
                      )}

                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isExpanded
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rotate-180'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                      }`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Choices / Control Panel */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40">
                      {group.fieldType === 'select' || group.fieldType === 'searchable_select' ? (
                        <>
                          {/* Quick Add Bar */}
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const val = (quickAddInputs[group.fieldKey] || '').trim();
                              if (!val) return;
                              try {
                                await htYardMasterDataService.saveMasterOption({
                                  category: activeTab,
                                  fieldKey: group.fieldKey,
                                  optionValue: val,
                                  isActive: true
                                });
                                toast.success(`Added "${val}" to ${group.label}!`);
                                setQuickAddInputs(prev => ({ ...prev, [group.fieldKey]: '' }));
                                // Reload choices
                                const data = await htYardMasterDataService.getMasterOptions(activeTab);
                                setOptions(data);
                              } catch (err: any) {
                                toast.error('Failed to add option');
                              }
                            }}
                            className="mt-4 flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
                          >
                            <input
                              type="text"
                              placeholder={`Type new choice for ${group.label} and hit Enter...`}
                              value={quickAddInputs[group.fieldKey] || ''}
                              onChange={(e) => setQuickAddInputs(prev => ({ ...prev, [group.fieldKey]: e.target.value }))}
                              className="flex-1 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none placeholder-slate-400"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Choice
                            </button>
                          </form>

                          {/* Full List of Choices Grid */}
                          <div className="mt-4">
                            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 flex items-center justify-between">
                              <span>Available Choices ({group.items.length}):</span>
                              <button
                                onClick={() => {
                                  setViewingTargetKey(group.fieldKey);
                                  setListModalSearch('');
                                }}
                                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> View List Modal
                              </button>
                            </div>

                            {group.items.length === 0 ? (
                              <div className="p-6 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                No choices configured yet for this dropdown. Type above to add one!
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {group.items.map((opt) => (
                              <div
                                key={opt.id}
                                className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors group/item"
                              >
                                {inlineEditingId === opt.id ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={inlineEditingValue}
                                    onChange={(e) => setInlineEditingValue(e.target.value)}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter') {
                                        if (!inlineEditingValue.trim()) return;
                                        await htYardMasterDataService.saveMasterOption({ ...opt, optionValue: inlineEditingValue.trim() });
                                        toast.success('Updated choice!');
                                        setInlineEditingId(null);
                                        const data = await htYardMasterDataService.getMasterOptions(activeTab);
                                        setOptions(data);
                                      } else if (e.key === 'Escape') {
                                        setInlineEditingId(null);
                                      }
                                    }}
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-900 dark:text-white rounded-lg border border-emerald-500 focus:outline-none"
                                  />
                                ) : (
                                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                                    {opt.optionValue}
                                  </span>
                                )}

                                <div className="flex items-center gap-1 shrink-0">
                                  {inlineEditingId === opt.id ? (
                                    <button
                                      onClick={async () => {
                                        if (!inlineEditingValue.trim()) return;
                                        await htYardMasterDataService.saveMasterOption({ ...opt, optionValue: inlineEditingValue.trim() });
                                        toast.success('Updated choice!');
                                        setInlineEditingId(null);
                                        const data = await htYardMasterDataService.getMasterOptions(activeTab);
                                        setOptions(data);
                                      }}
                                      className="p-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                                    >
                                      Save
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setInlineEditingId(opt.id);
                                          setInlineEditingValue(opt.optionValue);
                                        }}
                                        className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                                        title="Quick Edit"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => promptDeleteOption(opt.id, opt.optionValue)}
                                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                        title="Delete Option"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Settings2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                              Control Type: {group.fieldType}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              This field is configured as a <strong className="text-emerald-600 dark:text-emerald-400">{group.fieldType}</strong> input on the RMU/Site Audit form. You can convert it into a Dropdown with selectable choices, or adjust label, units, and placeholder.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const sectionTitle = group.section || 'Equipment Details';
                            const sectionKey = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
                            const moduleType = CATEGORY_TO_MODULE_MAP[activeTab] || 'RMU';
                            setConfiguringField({
                              category: activeTab,
                              moduleType: moduleType,
                              sectionKey: sectionKey,
                              sectionTitle: sectionTitle,
                              fieldKey: group.fieldKey,
                              fieldLabel: group.label,
                              fieldType: 'select', // pre-select dropdown conversion
                              unit: group.unit || '',
                              placeholder: group.placeholder || '',
                              isCustom: group.isCustom,
                              initialChoice: ''
                            });
                            setShowConfigureFieldModal(true);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Convert to Dropdown
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Flat List View Grouped by Section Headers */
        <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">Option Value / Choice</th>
                <th className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300">Category</th>
                <th className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300">Status</th>
                <th className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300">Updated History</th>
                <th className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {groupedFields
                .filter(g => g.items.length > 0)
                .map((group) => (
                  <React.Fragment key={group.fieldKey}>
                    {/* Section Header Row for Target Field */}
                    <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-y border-slate-200 dark:border-slate-800">
                      <td colSpan={5} className="px-6 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white text-xs flex-wrap">
                            <Box className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{group.label}</span>
                            <code className="text-[10px] text-slate-400 font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                              #{group.fieldKey}
                            </code>
                            {group.section && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                                📑 {group.section}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const sectionTitle = group.section || 'Equipment Details';
                                const sectionKey = sectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
                                const moduleType = CATEGORY_TO_MODULE_MAP[activeTab] || 'RMU';
                                setConfiguringField({
                                  category: activeTab,
                                  moduleType: moduleType,
                                  sectionKey: sectionKey,
                                  sectionTitle: sectionTitle,
                                  fieldKey: group.fieldKey,
                                  fieldLabel: group.label,
                                  fieldType: group.fieldType,
                                  unit: group.unit || '',
                                  placeholder: group.placeholder || '',
                                  isCustom: group.isCustom,
                                  initialChoice: ''
                                });
                                setShowConfigureFieldModal(true);
                              }}
                              className="px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Edit Field Settings"
                            >
                              <Edit2 className="w-3 h-3 text-emerald-600" /> Edit Field
                            </button>
                            <button
                              onClick={() => promptDeleteField(group.fieldKey, group.label, group.section)}
                              className="p-1 rounded-xl text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-rose-200 transition-colors cursor-pointer"
                              title={`Delete Field "${group.label}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                              {group.items.length} choices
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Choice Item Rows */}
                    {group.items.map((opt) => (
                      <tr key={opt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-6 py-3.5 pl-10">
                          <div className="font-semibold text-slate-900 dark:text-white">{opt.optionValue}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400">
                            {opt.category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Active
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {opt.updatedAt ? new Date(opt.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '29 Jul 2026'}
                            </span>
                            <span className="text-[11px] text-slate-400">by {opt.updatedBy || 'System Admin'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingOption(opt);
                                setIsCustomKey(false);
                                setShowAddModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Option"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(opt.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete Option"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW / EDIT / MANAGE CHOICES MODAL */}
      {activeViewingGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Box className="w-5 h-5 text-emerald-600" />
                  {activeViewingGroup.label}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  Category: {activeViewingGroup.category} • fieldKey: {activeViewingGroup.fieldKey} • ({activeViewingGroup.items.length} choices)
                </p>
              </div>
              <button
                onClick={() => setViewingTargetKey(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Add Bar */}
            <div className="flex gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <input
                type="text"
                placeholder={`Type new choice for ${activeViewingGroup.fieldKey}...`}
                value={quickAddValue}
                onChange={(e) => setQuickAddValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddChoice(activeViewingGroup.fieldKey);
                  }
                }}
                className="flex-1 px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                onClick={() => handleQuickAddChoice(activeViewingGroup.fieldKey)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add Choice
              </button>
            </div>

            {/* Modal Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter choices list..."
                value={listModalSearch}
                onChange={(e) => setListModalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* List Body with Inline Edit & Delete */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[50vh]">
              {activeViewingGroup.items
                .filter(i => i.optionValue.toLowerCase().includes(listModalSearch.toLowerCase()))
                .map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    {inlineEditingId === item.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                        <input
                          type="text"
                          value={inlineEditingValue}
                          onChange={(e) => setInlineEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInlineSave(item);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold border border-emerald-500 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleInlineSave(item)}
                          className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={() => setInlineEditingId(null)}
                          className="px-2.5 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.optionValue}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setInlineEditingId(item.id);
                              setInlineEditingValue(item.optionValue);
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            title="Edit choice value"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => promptDeleteOption(item.id, item.optionValue)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Remove choice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingTargetKey(null)}
                className="px-5 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Add New Master Category
              </h2>
              <button onClick={() => setShowAddCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DG Set Master Data, VCB Panel, UPS System"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TARGET FIELD MODAL */}
      {showAddTargetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                Add New Field to {activeTab}
              </h2>
              <button onClick={() => setShowAddTargetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTargetField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Field Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RMU Operating Status, Serial No, Commissioning Date"
                  value={newTargetLabel}
                  onChange={(e) => {
                    setNewTargetLabel(e.target.value);
                    if (!newTargetKey) {
                      setNewTargetKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Audit Stage / Section (Where on Audit Form?)
                </label>
                <input
                  type="text"
                  list="target-section-suggestions"
                  placeholder="e.g. Equipment Details, Incoming OD 1 Details"
                  value={newTargetSection}
                  onChange={(e) => setNewTargetSection(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <datalist id="target-section-suggestions">
                  {availableSections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Technical Field Key (snake_case) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. rmu_status, serial_no, test_date"
                  value={newTargetKey}
                  onChange={(e) => setNewTargetKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Control Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Control / Input Type *
                </label>
                <select
                  value={newTargetType}
                  onChange={(e) => setNewTargetType(e.target.value as HTFieldType)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  <optgroup label="🌟 Smart Automated Controls (10-Year Future-Proof)">
                    <option value="gps_location">📍 GPS Location (1-Tap Auto-Fetch Live Coordinates & Address)</option>
                    <option value="lifespan_calculator">⏳ Equipment Life Span & Health Analyzer (Calculates Age & RUL)</option>
                    <option value="model_catalog_autofill">🤖 Smart Catalog Auto-Fill (OEM Model Specifications Database)</option>
                    <option value="digital_signature">✍️ Digital Signature (Auditor & Client Signoff)</option>
                  </optgroup>
                  <optgroup label="📋 Standard Form Controls">
                    <option value="select">📋 Dropdown Choices (Select from options)</option>
                    <option value="searchable_select">🔍 Searchable Select (Typeahead filter)</option>
                    <option value="text">🔤 Standard Text Input</option>
                    <option value="date">📅 Date Picker (Calendar dd-mm-yyyy)</option>
                    <option value="number">🔢 Numeric Input (with engineering units)</option>
                    <option value="photo">📷 Photo Field (Camera capture & watermark)</option>
                    <option value="textarea">📝 Multiline Remarks / Observations</option>
                    <option value="boolean">🔘 Toggle / Boolean (Yes / No / Compliant)</option>
                  </optgroup>
                </select>
              </div>

              {/* If Dropdown chosen, initial choices input */}
              {(newTargetType === 'select' || newTargetType === 'searchable_select') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Dropdown Choices (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Working, Not Working, Under Maintenance, Standby"
                    value={newTargetChoices}
                    onChange={(e) => setNewTargetChoices(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Separate multiple choices with commas. You can also add more choices anytime from the cards below.
                  </p>
                </div>
              )}

              {/* If Numeric chosen, engineering unit */}
              {newTargetType === 'number' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Engineering Unit (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A, kVA, kV, mm, °C, bar"
                    value={newTargetUnit}
                    onChange={(e) => setNewTargetUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTargetModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIGURE CONTROL TYPE & FIELD SETTINGS MODAL */}
      {showConfigureFieldModal && configuringField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-600" />
                Configure Field: {configuringField.fieldLabel}
              </h2>
              <button onClick={() => { setShowConfigureFieldModal(false); setConfiguringField(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFieldConfiguration} className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Technical Key</span>
                  <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{configuringField.fieldKey}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Category</span>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{configuringField.category}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Field Display Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manufacturer Name, Breaker Make..."
                  value={configuringField.fieldLabel}
                  onChange={(e) => setConfiguringField({ ...configuringField, fieldLabel: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-semibold"
                />
              </div>

              {/* Target Section Selection / Edit */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Section / Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Equipment Details, HT Control Components..."
                  value={configuringField.sectionTitle || ''}
                  onChange={(e) => setConfiguringField({ ...configuringField, sectionTitle: e.target.value })}
                  list="field-sections-datalist"
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <datalist id="field-sections-datalist">
                  {availableSections.map(sec => (
                    <option key={sec} value={sec} />
                  ))}
                </datalist>
                <p className="text-[11px] text-slate-400 mt-1">
                  Select an existing section or type a new section name to organize this field.
                </p>
              </div>

              {/* Change Control Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Control / Input Type on Site Audit Form *
                </label>
                <select
                  value={configuringField.fieldType}
                  onChange={(e) => setConfiguringField({ ...configuringField, fieldType: e.target.value as HTFieldType })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  <optgroup label="🌟 Smart Automated Controls">
                    <option value="gps_location">📍 GPS Location (1-Tap Auto-Fetch Live Coordinates & Address)</option>
                    <option value="lifespan_calculator">⏳ Equipment Life Span & Health Analyzer (Calculates Age & RUL)</option>
                    <option value="model_catalog_autofill">🤖 Smart Catalog Auto-Fill (OEM Model Specifications Database)</option>
                    <option value="digital_signature">✍️ Digital Signature (Auditor & Client Signoff)</option>
                  </optgroup>
                  <optgroup label="📋 Standard Controls">
                    <option value="select">📋 Dropdown Choices (Select from options)</option>
                    <option value="searchable_select">🔍 Searchable Select (Typeahead filter)</option>
                    <option value="text">🔤 Standard Text Box</option>
                    <option value="date">📅 Date Picker (Calendar dd-mm-yyyy)</option>
                    <option value="number">🔢 Numeric Input</option>
                    <option value="photo">📷 Photo Field</option>
                    <option value="textarea">📝 Multiline Remarks</option>
                    <option value="boolean">🔘 Toggle / Boolean (Yes / No / Compliant)</option>
                  </optgroup>
                </select>

                {/* Dynamic Smart Help text based on selected type */}
                {configuringField.fieldType === 'gps_location' && (
                  <div className="mt-2 p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200/60 dark:border-rose-800/40 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      1-Tap GPS Geo-Tagging Active
                    </p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">
                      Engineers on the audit form will see a prominent <strong>"📍 Fetch Exact GPS Location"</strong> button. Clicking it automatically captures device GPS coordinates, precision accuracy, and reverse-geocoded physical address with OpenStreetMap/Google Maps integration.
                    </p>
                  </div>
                )}

                {configuringField.fieldType === 'lifespan_calculator' && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Asset Life Span & Health Analyzer Active
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Derives asset age from Manufacturing / Commissioning Year, computes <strong>Remaining Useful Life (RUL)</strong> against standard lifespan (25/30 yrs), and displays a visual Degradation Health Index with maintenance advisories.
                    </p>
                  </div>
                )}

                {configuringField.fieldType === 'model_catalog_autofill' && (
                  <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 text-xs text-indigo-800 dark:text-indigo-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      OEM Catalog 1-Click Auto-Fill Active
                    </p>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                      Provides pre-calibrated engineering specs for <strong>Cummins, ABB, Schneider, Siemens, Kirloskar, CAT</strong>, etc. Selecting a model automatically populates Voltage, Capacity, Breaking Capacity, Insulation Medium, and Lifespan in one click!
                    </p>
                  </div>
                )}
              </div>

              {/* If converting to Dropdown, option to add choices */}
              {(configuringField.fieldType === 'select' || configuringField.fieldType === 'searchable_select') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Add New Option Choices (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ABB-SN-001, ABB-SN-002, Siemens-SN-100"
                    value={configuringField.initialChoice || ''}
                    onChange={(e) => setConfiguringField({ ...configuringField, initialChoice: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              )}

              {/* Unit & Placeholder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Engineering Unit (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A, kVA, kV, mm, Years"
                    value={configuringField.unit || ''}
                    onChange={(e) => setConfiguringField({ ...configuringField, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Placeholder Hint (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Enter serial number..."
                    value={configuringField.placeholder || ''}
                    onChange={(e) => setConfiguringField({ ...configuringField, placeholder: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const fKey = configuringField.fieldKey;
                    const fLabel = configuringField.fieldLabel;
                    const fSec = configuringField.sectionTitle;
                    setShowConfigureFieldModal(false);
                    promptDeleteField(fKey, fLabel, fSec);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-200/80 dark:border-rose-900/60"
                  title="Delete this entire field & all choices"
                >
                  <Trash2 className="w-4 h-4" /> Delete Field
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowConfigureFieldModal(false); setConfiguringField(null); }}
                    className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Save Field Settings
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT SINGLE OPTION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingOption.id ? 'Edit Master Option' : `Add New Option to ${activeTab}`}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Option Choice Value *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABB, 1 R 3Core 400 Sq. mm, Provided..."
                  value={editingOption.optionValue || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, optionValue: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Field (Which Audit Input?) *
                </label>
                {!isCustomKey ? (
                  <select
                    value={editingOption.fieldKey || ''}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomKey(true);
                        setEditingOption({ ...editingOption, fieldKey: '' });
                      } else {
                        setEditingOption({ ...editingOption, fieldKey: e.target.value });
                      }
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    {availableSections.map(sec => (
                      <optgroup key={sec} label={`📁 ${sec}`}>
                        {availableFieldTargets
                          .filter(t => t.section === sec)
                          .map(t => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                    {availableFieldTargets.filter(t => !t.section).length > 0 && (
                      <optgroup label="📁 Other Fields">
                        {availableFieldTargets
                          .filter(t => !t.section)
                          .map(t => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <option value="__custom__">+ Enter Custom Field Key...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Enter custom fieldKey (e.g. custom_field_1)"
                      value={editingOption.fieldKey || ''}
                      onChange={(e) => setEditingOption({ ...editingOption, fieldKey: e.target.value })}
                      className="flex-1 px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomKey(false);
                        setEditingOption({ ...editingOption, fieldKey: availableFieldTargets[0]?.key || 'mfr_name' });
                      }}
                      className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      Select List
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor Scope (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank for all vendors"
                  value={editingOption.manufacturer || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, manufacturer: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all"
                >
                  Save Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* TEMPLATE INFO & PRE-FILLED REFERENCE POP-UP MODAL */}
      {showTemplateInfoModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl text-indigo-600 dark:text-indigo-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    HT Master Data Upload Template Guide
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Read column formatting rules and inspect pre-filled system reference data before downloading.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowTemplateInfoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
              {/* Step 1: Column Rules */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-500" /> 1. Column Formatting Rules
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block mb-1">
                      Category (Required)
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Equipment category name. Must match valid categories like <code className="font-bold bg-white dark:bg-slate-900 px-1 rounded">RMUMD</code>, <code className="font-bold bg-white dark:bg-slate-900 px-1 rounded">TRMaster Data</code>, etc.
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 block mb-1">
                      Target Field Name (Required)
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Exact title of form target field, e.g. <code className="font-bold bg-white dark:bg-slate-900 px-1 rounded">Manufacturer Name</code>, <code className="font-bold bg-white dark:bg-slate-900 px-1 rounded">Capacity</code>.
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 block mb-1">
                      Dropdown Choice Value (Required)
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      The actual text choice option to add into the dropdown (e.g. <code className="font-bold bg-white dark:bg-slate-900 px-1 rounded">ABB India Ltd</code>, <code className="font-bold bg-white dark:bg-slate-900 px-1 rounded">1000 KVA</code>).
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-xs font-extrabold text-slate-500 block mb-1">
                      Manufacturer Scope (Optional)
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Leave blank for all vendors, or specify vendor name if choice is vendor-specific.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Live Available System Data Reference */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" /> 2. Pre-Filled Available Categories & Target Fields
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                      <tr>
                        <th className="p-3">Category</th>
                        <th className="p-3">Target Field Title</th>
                        <th className="p-3">Internal Field Key</th>
                        <th className="p-3">Current Choice Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {categories.flatMap((cat) => {
                        const targets = fieldTargetsMap[cat] || INITIAL_FIELD_TARGETS_MAP[cat] || [];
                        return targets.map((t) => {
                          const count = options.filter((o) => o.category === cat && o.fieldKey === t.key).length;
                          return (
                            <tr key={`${cat}-${t.key}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-bold text-pink-600 dark:text-pink-400">{cat}</td>
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">{t.label}</td>
                              <td className="p-3 font-mono text-slate-400 text-[11px]">{t.key}</td>
                              <td className="p-3 text-slate-500 font-bold">{count} choices</td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setShowTemplateInfoModal(false)}
                className="px-5 py-2.5 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    downloadBulkTemplate();
                    setShowTemplateInfoModal(false);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Excel Template (.XLSX)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD FILE SELECTION MODAL */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                Bulk Upload Master Data
              </h2>
              <button onClick={() => setShowBulkUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <Download className="w-4 h-4 text-indigo-600" /> Step 1: Download Standard Multi-Sheet Template
                </p>
                <p className="text-indigo-700/80 dark:text-indigo-300/80 mb-2.5">
                  Downloads an Excel workbook containing data entry columns + pre-filled Instructions & Reference Sheet tab!
                </p>
                <button
                  onClick={downloadBulkTemplate}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download Multi-Sheet Excel Template (.XLSX)
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center hover:border-emerald-500 transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  Step 2: Upload Completed File
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Upload your filled `.csv` file. All rows will be validated cell-by-cell before update!
                </p>
                <label className="cursor-pointer inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-sm transition-all">
                  <span>Browse & Upload File</span>
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK PRE-IMPORT REVIEW & APPROVAL DRAWER/MODAL */}
      {showBulkPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-5xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-6 h-6 text-indigo-600" />
                  Bulk Data Verification & Pre-Import Review
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review and edit validated rows before approving data import into HT Master Data.
                </p>
              </div>
              <button onClick={() => setShowBulkPreviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Validation Summary Stat Bar */}
            <div className="py-4 flex items-center justify-between gap-3 flex-wrap shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700">
                  Total Parsed: {bulkParsedRows.length} Rows
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800">
                  Ready to Import: {bulkParsedRows.filter(r => r.status === 'valid' && r.isSelected).length}
                </span>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-800">
                  Duplicates: {bulkParsedRows.filter(r => r.status === 'duplicate').length}
                </span>
                {bulkParsedRows.some(r => r.status === 'error') && (
                  <span className="px-3 py-1 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 font-bold text-xs rounded-xl border border-red-200 dark:border-red-800">
                    Errors: {bulkParsedRows.filter(r => r.status === 'error').length}
                  </span>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setBulkFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-lg ${bulkFilterStatus === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs' : 'text-slate-500'}`}
                >
                  All ({bulkParsedRows.length})
                </button>
                <button
                  onClick={() => setBulkFilterStatus('valid')}
                  className={`px-2.5 py-1 rounded-lg ${bulkFilterStatus === 'valid' ? 'bg-white dark:bg-slate-900 text-emerald-600 font-bold shadow-xs' : 'text-slate-500'}`}
                >
                  Valid ({bulkParsedRows.filter(r => r.status === 'valid').length})
                </button>
                <button
                  onClick={() => setBulkFilterStatus('error')}
                  className={`px-2.5 py-1 rounded-lg ${bulkFilterStatus === 'error' ? 'bg-white dark:bg-slate-900 text-red-600 font-bold shadow-xs' : 'text-slate-500'}`}
                >
                  Errors ({bulkParsedRows.filter(r => r.status === 'error').length})
                </button>
              </div>
            </div>

            {/* Interactive Verification Data Table */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={bulkParsedRows.every(r => r.isSelected)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setBulkParsedRows(prev => prev.map(r => ({ ...r, isSelected: checked })));
                        }}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="p-3 w-12">Row</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Target Field Name</th>
                    <th className="p-3">Dropdown Choice Value</th>
                    <th className="p-3">Cell Validation Status</th>
                    <th className="p-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bulkParsedRows
                    .filter(r => bulkFilterStatus === 'all' || r.status === bulkFilterStatus)
                    .map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          row.status === 'error' ? 'bg-red-50/40 dark:bg-red-950/20' : row.status === 'duplicate' ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            disabled={row.status === 'error'}
                            checked={row.isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setBulkParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, isSelected: checked } : r));
                            }}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-400">#{row.rowIndex}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full font-bold bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400">
                            {row.category}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          {row.fieldLabel}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          <input
                            type="text"
                            value={row.optionValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBulkParsedRows(prev => prev.map(r => {
                                if (r.id === row.id) {
                                  const isErr = !val.trim();
                                  return {
                                    ...r,
                                    optionValue: val,
                                    status: isErr ? 'error' : 'valid',
                                    errorMessage: isErr ? 'Choice value cannot be blank' : undefined,
                                    isSelected: !isErr
                                  };
                                }
                                return r;
                              }));
                            }}
                            className="bg-white dark:bg-slate-800 px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs w-full max-w-xs focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-3">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid & Ready
                            </span>
                          ) : row.status === 'duplicate' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60" title={row.errorMessage}>
                              <AlertCircle className="w-3.5 h-3.5" /> {row.errorMessage || 'Duplicate Choice'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200/60">
                              <AlertCircle className="w-3.5 h-3.5" /> {row.errorMessage || 'Invalid Cell'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setBulkParsedRows(prev => prev.filter(r => r.id !== row.id))}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete row from import preview"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions Footer */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setShowBulkPreviewModal(false)}
                className="px-5 py-2.5 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleApproveBulkImport}
                  disabled={isImportingBulk || bulkParsedRows.filter(r => r.isSelected && r.status !== 'error').length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {isImportingBulk ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Importing Data...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Update Master Data ({bulkParsedRows.filter(r => r.isSelected && r.status !== 'error').length} Rows)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Verification Modal for Deletion */}
      {deletePasswordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Confirm Password to Delete
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Security check required for deletion
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletePasswordModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/40 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <p className="font-extrabold">
                ⚠️ You are deleting {deletePasswordModal.type === 'CATEGORY' ? 'Category' : deletePasswordModal.type === 'FIELD' ? 'Field' : 'Option'}: "{deletePasswordModal.targetName}"
              </p>
              <p className="text-[11px] opacity-90">
                Please enter your account password to confirm and authorize this deletion.
              </p>
            </div>

            <form onSubmit={handleConfirmPasswordDelete} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Your Account Password ({currentUser?.email || 'User'})
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your password..."
                  value={deletePasswordModal.passwordInput}
                  onChange={(e) => setDeletePasswordModal(prev => ({ ...prev, passwordInput: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletePasswordModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletePasswordModal.isVerifying}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {deletePasswordModal.isVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" /> Confirm & Delete
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
