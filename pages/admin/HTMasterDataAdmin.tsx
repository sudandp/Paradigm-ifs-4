import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit2, Trash2, Box, RefreshCw, RotateCcw, Plus, Eye, X, Layers, List, Check, Tag, ChevronDown, ChevronUp, Maximize2, Minimize2, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, FileText, HelpCircle, BookOpen } from 'lucide-react';
import { HTMasterOption, HTMasterCategory } from '../../types/htYard';
import { htYardMasterDataService } from '../../services/htYardMasterDataService';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const INITIAL_FIELD_TARGETS_MAP: Record<HTMasterCategory, Array<{ key: string; label: string }>> = {
  'RMUMD': [
    { key: 'mfr_name', label: 'Manufacturer Name' },
    { key: 'no_of_ways', label: 'No. of Ways' },
    { key: 'no_of_sections', label: 'No. of Sections' },
    { key: 'power_indicator', label: 'Power Line Indicators Details' },
    { key: 'protection_relay', label: 'RMU Protection Relay Details' },
    { key: 'mf_meter', label: 'Multi Function Meter' },
    { key: 'fault_indicator', label: 'Line Fault Indicator Details' },
    { key: 'selector_switch', label: 'Selector Switch 1 & 2 Details' },
    { key: 'line_charge_indicator', label: 'Line Charge Indicator' },
    { key: 'sf6_status', label: 'SF-6 Status' },
    { key: 'labelling', label: 'Labelling' },
    { key: 'door_condition', label: 'Condition of Doors' },
    { key: 'vcb_breaker_make', label: 'VCB Breaker Make' },
    { key: 'capacity', label: 'Current Rating / Capacity' },
    { key: 'master_trip_relay', label: 'Master Trip Relay' },
    { key: 'tc_supervision_relay', label: 'Trip Circuit Supervision Relay' },
    { key: 'annunciator', label: 'Annunciator' },
    { key: 'tr_protection_relay', label: 'Transformer Protection Relay' },
    { key: 'selector_switch_relay', label: 'Selector Switch Relay' },
    { key: 'control_mcb', label: "Control MCB's" },
    { key: 'acb_breaker_make', label: 'ACB Breaker Make' },
    { key: 'voltmeter', label: 'Volt Meter' },
    { key: 'power_pack_battery_backup', label: 'Power Pack With Battery Backup' },
    { key: 'nonc_contactor', label: 'NO/NC Contactor' },
    { key: 'relay_1', label: 'Relay 1' },
    { key: 'body_condition', label: 'Body Condition' }
  ],
  'TRMaster Data': [
    { key: 'mfr_name', label: 'Manufacturer Name' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'coil_material', label: 'Coil Winding Material' },
    { key: 'oil_level_indicator', label: 'Oil Level Indicator' },
    { key: 'oil_temp_indicator', label: 'Oil Temperature Indicator' },
    { key: 'winding_temp_indicator', label: 'Winding Temperature Indicator' },
    { key: 'prv', label: 'Pressure Relief Valve' },
    { key: 'drain_valve', label: 'Drain Valve' },
    { key: 'tap_changer', label: 'Tap Changer' },
    { key: 'tap_position', label: 'Tap Position' },
    { key: 'conservator_cond', label: 'Condition of Oil Conservator' },
    { key: 'explosion_vent', label: 'Explosion Vent' },
    { key: 'air_breather', label: 'Air Breather Silica Gel' },
    { key: 'body_earth_terminals', label: 'Earthing Terminals Body' },
    { key: 'neutral_earth_terminals', label: 'Earthing Terminals Neutral' },
    { key: 'lifting_lugs', label: 'Lifting Lugs' },
    { key: 'foundation_cond', label: 'Condition of Foundation' },
    { key: 'cable_laying', label: 'Laying of Cables' },
    { key: 'incoming_cable_fixing', label: 'Incoming Cable Fixing' },
    { key: 'outgoing_cable_fixing', label: 'Outgoing Cable Fixing' },
    { key: 'gland_condition', label: 'Cable Gland Condition' },
    { key: 'gland_earthing', label: 'Cable Gland Earthing' },
    { key: 'body_condition', label: 'Body Condition' },
    { key: 'silica_gel', label: 'Silica Gel Condition' },
    { key: 'oil_level', label: 'Oil Level' },
    { key: 'oil_leakage', label: 'Oil Leakage' },
    { key: 'humming_sound', label: 'Humming Sound' }
  ],
  'LTKMD': [
    { key: 'mfr_name', label: 'Manufacturer Name' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'incomer_mccb_make', label: 'Incomer MCCB Make' },
    { key: 'earth_leakage_relay', label: 'Earth Leakage Relay Make' },
    { key: 'voltmeter', label: 'Volt Meter' },
    { key: 'ammeter', label: 'Ammeter' },
    { key: 'mf_meter', label: 'Multi Function Meter' },
    { key: 'selector_switch_make', label: 'Selector Switch Make' },
    { key: 'bescom_master_meter', label: 'BESCOM Master Meter Details' },
    { key: 'bus_coupler', label: 'Bus Coupler Details' },
    { key: 'pfc_controller', label: 'PFC Controller Make' },
    { key: 'cap_bank_sizes', label: 'Capacitor Bank Sizes' },
    { key: 'relay_timer_lvm', label: 'Relay / Timer / LVM' },
    { key: 'ct_ratio', label: 'CT Ratio' },
    { key: 'ct_constant', label: 'CT Constant' },
    { key: 'ct_va', label: 'CT VA' },
    { key: 'ct_cl', label: 'CT CL' },
    { key: 'bescom_seal', label: 'BESCOM Seal' },
    { key: 'ct_classification', label: 'CT Classification' },
    { key: 'outgoing_mccb_make', label: 'Outgoing MCCB Make' },
    { key: 'outgoing_capacity', label: 'Outgoing Capacity' }
  ],
  'Cable Details': [
    { key: 'cable_rating_rmu', label: 'RMU Cable Rating' },
    { key: 'cable_rating_transformer', label: 'Transformer Cable Details' },
    { key: 'cable_rating_ltkiosk', label: 'LT Kiosk Cable Details' }
  ],
  'HTYardCommon': [
    { key: 'yard_cleanliness', label: 'Yard Cleanliness' },
    { key: 'fire_extinguishers', label: 'Fire Extinguishers' }
  ]
};

export const HTMasterDataAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HTMasterCategory>('RMUMD');
  const [options, setOptions] = useState<HTMasterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('All');
  const [fieldTargetsMap, setFieldTargetsMap] = useState(INITIAL_FIELD_TARGETS_MAP);

  // Accordion state
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [quickAddInputs, setQuickAddInputs] = useState<Record<string, string>>({});

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

  // Custom Target Field & Category states
  const [newTargetLabel, setNewTargetLabel] = useState('');
  const [newTargetKey, setNewTargetKey] = useState('');
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
          refSheet.addRow([cat, t.label, `Form dropdown field for ${cat}`, `${count} existing choices`]);
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
    } catch (e) {}
    return defaultCategories;
  });

  useEffect(() => {
    setSearchQuery('');
    setSelectedFieldKey('All');
    loadOptions();
  }, [activeTab]);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const data = await htYardMasterDataService.getMasterOptions(activeTab);
      setOptions(data);
    } catch (error) {
      toast.error('Failed to load master options');
    } finally {
      setLoading(false);
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
    } catch (e) {}

    setActiveTab(catName);
    toast.success(`Category "${catName}" created!`);
    setShowAddCategoryModal(false);
    setNewCategoryName('');

    // Automatically prompt to add the first target field for this category
    setShowAddTargetModal(true);
  };

  const handleCreateNewTargetField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetLabel.trim() || !newTargetKey.trim()) {
      toast.error('Both field name and technical key are required');
      return;
    }

    const cleanKey = newTargetKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const label = newTargetLabel.trim();

    setFieldTargetsMap(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), { key: cleanKey, label }]
    }));

    toast.success(`Target field "${cleanKey}" created!`);
    setShowAddTargetModal(false);
    setNewTargetLabel('');
    setNewTargetKey('');

    // Open add choice modal prefilled with new target key
    setEditingOption({
      category: activeTab,
      fieldKey: cleanKey,
      optionValue: '',
      manufacturer: ''
    });
    setIsCustomKey(false);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;
    try {
      await htYardMasterDataService.deleteMasterOption(id, activeTab);
      toast.success('Option removed');
      loadOptions();
    } catch (error) {
      toast.error('Failed to delete option');
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

  // Group options by field target key
  const groupedFields = useMemo(() => {
    const map = new Map<string, { fieldKey: string; label: string; category: HTMasterCategory; items: HTMasterOption[] }>();

    // Pre-populate with all known field targets for activeTab
    availableFieldTargets.forEach(t => {
      map.set(t.key, { fieldKey: t.key, label: t.label, category: activeTab, items: [] });
    });

    // Add actual items
    options.forEach(opt => {
      const key = opt.fieldKey || 'generic';
      if (!map.has(key)) {
        const friendly = availableFieldTargets.find(t => t.key === key);
        map.set(key, { fieldKey: key, label: friendly ? friendly.label : key, category: activeTab, items: [] });
      }
      map.get(key)!.items.push(opt);
    });

    return Array.from(map.values()).filter(g => {
      const matchesSearch = searchQuery === '' || 
        g.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        g.fieldKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.items.some(i => i.optionValue.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFieldKey = selectedFieldKey === 'All' || g.fieldKey === selectedFieldKey;
      return matchesSearch && matchesFieldKey;
    });
  }, [options, activeTab, searchQuery, selectedFieldKey, fieldTargetsMap]);

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
              className="px-3.5 py-2 rounded-2xl text-xs font-bold border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> + New Category
            </button>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {categories.length} Categories • {groupedFields.length} Fields • {options.length} Choices
            </span>
          </div>
        </div>
      </div>

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
              {availableFieldTargets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
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
              No fields or choices found for {activeTab}.
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400 border border-pink-200/60 dark:border-pink-800/40">
                            {group.category}
                          </span>
                        </div>

                        {/* Collapsed Preview Chips */}
                        {!isExpanded && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {group.items.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">No choices added yet</span>
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
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border transition-colors ${
                        isExpanded
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                      }`}>
                        {group.items.length} choices
                      </span>

                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isExpanded
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rotate-180'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                      }`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Choices Panel */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40">
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
                            No choices configured yet for this field. Type above to add one!
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
                                        onClick={() => handleDelete(opt.id)}
                                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
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
                          <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white text-xs">
                            <Box className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{group.label}</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                            {group.items.length} choices
                          </span>
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
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                Add New Target Field to {activeTab}
              </h2>
              <button onClick={() => setShowAddTargetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTargetField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Field Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Breaker Status, Oil Color, Relay Type"
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
                  Technical Field Key (snake_case) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. breaker_status, oil_color"
                  value={newTargetKey}
                  onChange={(e) => setNewTargetKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

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
                  className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all"
                >
                  Create Target Field
                </button>
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
                    {availableFieldTargets.map(t => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
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
    </div>
  );
};
