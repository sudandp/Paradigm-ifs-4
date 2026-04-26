/**
 * Excel Template Engine
 * Handles generation, parsing, and validation of Excel templates
 * using the ExcelJS library.
 */
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { TEMPLATE_DEFINITIONS, type TemplateDefinition, type TemplateColumn } from './templateDefinitions';

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value: any;
}

export interface ParsedRow {
  rowIndex: number;
  data: Record<string, any>;
  errors: ValidationError[];
  isValid: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
  validCount: number;
  errorCount: number;
  allValid: boolean;
  headers: string[];
}

export interface MasterParseResult {
  [templateId: string]: ParseResult;
}

export interface ReferenceData {
  companies: string[];
  sites: string[];
  locations: string[];
}

/**
 * Generate and download an Excel template for a given definition.
 */
export const downloadTemplate = async (
  template: TemplateDefinition,
  onProgress?: (progress: number) => void
): Promise<void> => {
  onProgress?.(10);
  const workbook = new ExcelJS.Workbook();
  onProgress?.(30);
  
  // --- Data Sheet ---
  const worksheet = workbook.addWorksheet(template.name);
  const headers = template.columns.map(c => c.header);
  
  // Add headers
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  
  // Add sample data
  template.sampleData.forEach(row => {
    worksheet.addRow(template.columns.map(col => row[col.key] ?? ''));
  });

  // Set column widths
  worksheet.columns = template.columns.map(col => ({ 
    header: col.header, 
    key: col.key, 
    width: col.width || 18 
  }));

  // Add Data Validation for Enum, Date, and Number Columns
  for (const [idx, col] of template.columns.entries()) {
    // Yield every few columns to keep UI smooth
    if (idx % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    const columnLetter = worksheet.getColumn(idx + 1).letter;
    
    // Format date columns
    if (col.type === 'date') {
      worksheet.getColumn(idx + 1).numFmt = 'yyyy-mm-dd';
    }

    for (let i = 2; i <= 1000; i++) {
      const cell = worksheet.getCell(`${columnLetter}${i}`);
      
      if (col.type === 'enum' && col.enumValues && col.enumValues.length > 0) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Invalid Selection',
          error: 'Please select a value from the dropdown list.',
          formulae: [`"${col.enumValues.join(',')}"`]
        };
      } else if (col.type === 'date') {
        cell.dataValidation = {
          type: 'date',
          operator: 'greaterThan',
          showErrorMessage: true,
          allowBlank: true,
          errorTitle: 'Invalid Date Format',
          error: 'Please enter a valid date in YYYY-MM-DD format.',
          formulae: [new Date('1900-01-01')]
        };
      } else if (col.type === 'number') {
        cell.dataValidation = {
          type: 'decimal',
          operator: 'between',
          showErrorMessage: true,
          allowBlank: true,
          errorTitle: 'Invalid Number',
          error: 'Please enter a valid numerical value.',
          formulae: [-999999999, 999999999]
        };
      }
    }
  }

  // --- Instructions Sheet ---
  const instrWs = workbook.addWorksheet('Instructions');
  const instrHeaders = ['Column', 'Required', 'Type', 'Description', 'Allowed Values'];
  const instrRow = instrWs.addRow(instrHeaders);
  instrRow.font = { bold: true };

  template.columns.forEach(col => {
    instrWs.addRow([
      col.header,
      col.required ? 'YES' : 'No',
      col.type === 'enum' ? 'Dropdown' : col.type.charAt(0).toUpperCase() + col.type.slice(1),
      col.description || '',
      col.enumValues ? col.enumValues.join(', ') : '',
    ]);
  });

  instrWs.columns = [
    { width: 25 }, { width: 10 }, { width: 12 }, { width: 50 }, { width: 30 },
  ];

  // Download
  onProgress?.(80);
  const fileName = `${template.name} Template.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  onProgress?.(100);
  saveAs(new Blob([buffer]), fileName);
};

/**
 * Extract the plain value from an ExcelJS cell.
 */
const getCellValue = (cell: ExcelJS.Cell): any => {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  
  // Handle objects (formulas, rich text, hyperlinks)
  if (typeof value === 'object') {
    if ('result' in value) return value.result; // FormulaValue
    if ('richText' in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
    }
    if ('text' in value) return (value as ExcelJS.CellHyperlinkValue).text; // HyperlinkValue
  }
  
  return value;
};

/**
 * Parse an uploaded Excel file and validate against the template definition.
 */
export const parseUploadedFile = async (
  file: File,
  template: TemplateDefinition
): Promise<ParseResult> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const data = await file.arrayBuffer();
    await workbook.xlsx.load(data);

    // Read from the first sheet (data sheet)
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheets found in the file.');
    }

    const rows: any[] = [];
    const headers: string[] = [];

    // Identify headers from the first row
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const headerVal = getCellValue(cell);
      headers[colNumber - 1] = String(headerVal || '').trim();
    });

    // Parse data rows
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const rowData: Record<string, any> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = getCellValue(cell);
        }
      });
      
      // Check if this row is exactly the sample data
      let isSampleData = false;
      if (rowNumber === 2 && template.sampleData && template.sampleData.length > 0) {
        const sample = template.sampleData[0];
        isSampleData = template.columns.every(col => {
          const val1 = rowData[col.header];
          const val2 = sample[col.key];
          return String(val1 || '').trim() === String(val2 ?? '').trim();
        });
      }

      // Only add rows that have some data and are NOT the sample data
      const hasData = Object.values(rowData).some(v => v !== '' && v !== null && v !== undefined);
      if (hasData && !isSampleData) {
        rows.push({ rowData, rowIndex: rowNumber });
      }
    });

    if (rows.length === 0) {
      return {
        rows: [],
        validCount: 0,
        errorCount: 0,
        allValid: false,
        headers,
      };
    }

    // Map headers to column keys
    const parsedRows: ParsedRow[] = [];
    for (const { rowData, rowIndex } of rows) {
      const errors: ValidationError[] = [];
      const mappedData: Record<string, any> = {};

      // Map each header value to the column key
      for (const col of template.columns) {
        const rawValue = rowData[col.header];
        const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        mappedData[col.key] = value;

        // Required check
        if (col.required && (value === '' || value === undefined || value === null)) {
          errors.push({
            row: rowIndex,
            column: col.header,
            message: `${col.header} is required`,
            value,
          });
        }

        // Type validation
        if (value !== '' && value !== undefined && value !== null) {
          if (col.type === 'number' && isNaN(Number(value))) {
            errors.push({
              row: rowIndex,
              column: col.header,
              message: `${col.header} must be a number`,
              value,
            });
          }

          if (col.type === 'enum' && col.enumValues && !col.enumValues.includes(String(value))) {
            errors.push({
              row: rowIndex,
              column: col.header,
              message: `${col.header} must be one of: ${col.enumValues.join(', ')}`,
              value,
            });
          }

          if (col.type === 'date' && value) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            let dateStr = '';
            if (value instanceof Date) {
              dateStr = value.toISOString().split('T')[0];
              mappedData[col.key] = dateStr; // Normalize to string for consistency
            } else {
              dateStr = String(value);
            }

            if (!dateRegex.test(dateStr)) {
              errors.push({
                row: rowIndex,
                column: col.header,
                message: `${col.header} must be in YYYY-MM-DD format`,
                value,
              });
            }
          }
        }
      }

      parsedRows.push({
        rowIndex,
        data: mappedData,
        errors,
        isValid: errors.length === 0,
      });
    }

    // Check for duplicates based on matchKey
    const matchCol = template.columns.find(c => c.key === template.matchKey);
    if (matchCol) {
      const seen = new Map<string, number>();
      parsedRows.forEach((row) => {
        const key = String(row.data[template.matchKey] || '').toLowerCase();
        if (key && seen.has(key)) {
          row.errors.push({
            row: row.rowIndex,
            column: matchCol.header,
            message: `Duplicate: "${row.data[template.matchKey]}" also appears in row ${seen.get(key)}`,
            value: row.data[template.matchKey],
          });
          row.isValid = false;
        } else if (key) {
          seen.set(key, row.rowIndex);
        }
      });
    }

    const validCount = parsedRows.filter(r => r.isValid).length;
    const errorCount = parsedRows.filter(r => !r.isValid).length;

    return {
      rows: parsedRows,
      validCount,
      errorCount,
      allValid: errorCount === 0,
      headers,
    };
  } catch (err) {
    console.error('Excel parse error:', err);
    throw new Error('Failed to parse Excel file. Please check the format.');
  }
};

/**
 * Generate an error report Excel file for failed uploads.
 */
export const downloadErrorReport = async (
  template: TemplateDefinition,
  rows: ParsedRow[]
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Validation Report');
  
  const headers = [...template.columns.map(c => c.header), 'Errors'];
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };

  rows.forEach(row => {
    worksheet.addRow([
      ...template.columns.map(col => row.data[col.key] ?? ''),
      row.errors.map(e => e.message).join('; '),
    ]);
  });

  worksheet.columns = [
    ...template.columns.map(col => ({ width: col.width || 18 })),
    { width: 50 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${template.name.replace(/\s+/g, '_')}_Errors.xlsx`);
};

/**
 * Generate and download a Master Excel template containing all sheets.
 */
export const downloadMasterTemplate = async (
  refData?: ReferenceData, 
  logoBase64?: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  onProgress?.(5);
  const workbook = new ExcelJS.Workbook();
  const COMMON_PASSWORD = 'ParadigmHR2025';

  let logoId: number | null = null;
  if (logoBase64 && logoBase64.includes('base64,')) {
    try {
      logoId = workbook.addImage({
        base64: logoBase64.split('base64,')[1],
        extension: 'png',
      });
    } catch (e) {
      console.error('Failed to add logo to workbook:', e);
    }
  }

  onProgress?.(10);

  // 1. Add a generic instructions sheet FIRST so it is the first tab the user sees
  const instrWs = workbook.addWorksheet('Instructions');
  instrWs.addRow(['MASTER TEMPLATE USAGE GUIDELINES']).font = { bold: true, size: 16, color: { argb: 'FF006B3F' } };
  instrWs.addRow(['']);
  instrWs.addRow(['HOW TO FILL THIS TEMPLATE:']).font = { bold: true, size: 12 };
  instrWs.addRow(['• Each tab at the bottom represents a specific module (e.g., Client Structure, Site Configuration).']);
  instrWs.addRow(['• Required Fields: Headers highlighted in RED are mandatory. Cells will turn red if left empty while filling a row.']);
  instrWs.addRow(['• Smart Dropdowns: Use the dropdown menus for fields like Company Name, Site Name, and Location. Do not type them manually.']);
  instrWs.addRow(['• Data Formats: Dates must be YYYY-MM-DD. PAN must be 10 characters. GST must be 15 characters.']);
  instrWs.addRow(['']);
  instrWs.addRow(['DOs:']).font = { bold: true, color: { argb: 'FF008000' } };
  instrWs.addRow(['• DO use the dropdowns whenever available to ensure data matches the system.']);
  instrWs.addRow(['• DO check for red highlights before uploading—these indicate missing mandatory data.']);
  instrWs.addRow(['• DO ensure your PAN and GST numbers are in the correct format.']);
  instrWs.addRow(['']);
  instrWs.addRow(['DON\'Ts (STRICTLY PROHIBITED):']).font = { bold: true, color: { argb: 'FFCC0000' } };
  instrWs.addRow(['• DO NOT rename any of the sheet tabs at the bottom.']);
  instrWs.addRow(['• DO NOT add new columns or delete existing columns.']);
  instrWs.addRow(['• DO NOT change the formatting or data validation rules.']);
  instrWs.addRow(['• DO NOT upload data with red highlights or duplicate warnings.']);
  instrWs.addRow(['']);
  instrWs.addRow(['UPLOAD INSTRUCTIONS:']).font = { bold: true };
  instrWs.addRow(['Once filled, save the file and use the "Upload Master" button in the Templates Hub.']);

  instrWs.getColumn(1).width = 120;

  // Add Logo to Instructions if available
  if (logoId !== null) {
    instrWs.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 300, height: 45 }
    });
    // Shift text down to not overlap with logo
    for (let i = 0; i < 4; i++) instrWs.insertRow(1, []);
  }

  instrWs.protect(COMMON_PASSWORD, {
    selectLockedCells: true,
    selectUnlockedCells: false,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false
  });
  
  onProgress?.(20);

  if (refData) {
    const refSheet = workbook.addWorksheet('_ReferenceData');
    refSheet.state = 'veryHidden'; // Completely invisible to users
    refSheet.addRow(['Companies', 'Sites', 'Locations']);
    const maxLen = Math.max(refData.companies.length, refData.sites.length, refData.locations.length);
    for (let i = 0; i < maxLen; i++) {
      refSheet.addRow([
        refData.companies[i] || '', 
        refData.sites[i] || '',
        refData.locations[i] || ''
      ]);
    }
    refSheet.protect(COMMON_PASSWORD, {
      selectLockedCells: true,
      selectUnlockedCells: false,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      deleteColumns: false,
      deleteRows: false
    });
  }
  
  const totalTemplates = TEMPLATE_DEFINITIONS.length;
  let processedTemplates = 0;

  for (const template of TEMPLATE_DEFINITIONS) {
    onProgress?.(20 + Math.round((processedTemplates / totalTemplates) * 70));
    // Yield to main thread before starting a new sheet
    await new Promise(resolve => setTimeout(resolve, 0));
    const worksheet = workbook.addWorksheet(template.name);
    
    worksheet.columns = template.columns.map(col => ({ 
      header: col.header, 
      key: col.key, 
      width: col.width || 18 
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const colDef = template.columns[colNumber - 1];
      // Color coding: Light Red for required, Light Blue for optional
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colDef.required ? 'FFFFEAEA' : 'FFEAF4FF' }
      };
      cell.font = { bold: true, color: { argb: colDef.required ? 'FF990000' : 'FF003366' } };
      
      // Hover Tooltip
      if (colDef.description) {
        cell.note = colDef.description;
      }
    });
    
    template.sampleData.forEach(row => {
      worksheet.addRow(template.columns.map(col => row[col.key] ?? ''));
    });


    // Add Data Validation for Enum, Date, and Number Columns
    for (const [idx, col] of template.columns.entries()) {
      // Yield every few columns to keep UI smooth
      if (idx % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      const columnLetter = worksheet.getColumn(idx + 1).letter;
      
      // Format date columns
      if (col.type === 'date') {
        worksheet.getColumn(idx + 1).numFmt = 'yyyy-mm-dd';
      }

      let validationFormula: string[] | null = null;
      if (col.type === 'enum' && col.enumValues && col.enumValues.length > 0) {
        validationFormula = [`"${col.enumValues.join(',')}"`];
      } else if (refData && col.key === 'company_name') {
        validationFormula = [`_ReferenceData!$A$2:$A$${Math.max(2, refData.companies.length + 1)}`];
      } else if (refData && (col.key === 'site_name' || col.key === 'short_name') && template.id !== 'site_configuration') {
        validationFormula = [`_ReferenceData!$B$2:$B$${Math.max(2, refData.sites.length + 1)}`];
      } else if (refData && col.key === 'location') {
        validationFormula = [`_ReferenceData!$C$2:$C$${Math.max(2, refData.locations.length + 1)}`];
      }

      let customValidation: any = null;
      if (col.key === 'pan_number') {
        customValidation = {
          type: 'custom',
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Invalid PAN Format',
          error: 'PAN must be 10 characters: 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F).',
        };
      } else if (col.key === 'gst_number') {
        customValidation = {
          type: 'custom',
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Invalid GST Format',
          error: 'GST Number must be exactly 15 characters.',
        };
      } else if (col.key === 'contact_phone') {
        customValidation = {
          type: 'custom',
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Invalid Phone',
          error: 'Phone Number must be 10 digits.',
        };
      }

      const rowLimit = 200;
      const column = worksheet.getColumn(idx + 1);
      
      // OPTIMIZATION: Unlock the entire column at once, then lock the header
      column.protection = { locked: false };
      worksheet.getRow(1).getCell(idx + 1).protection = { locked: true };

      // Add Duplicate Conditional Formatting
      const uniqueKeys = ['pan_number', 'gst_number', 'epfo_code', 'esic_code', 'contact_phone', 'email', 'registration_number'];
      if (uniqueKeys.includes(col.key)) {
        worksheet.addConditionalFormatting({
          ref: `${columnLetter}2:${columnLetter}${rowLimit}`,
          rules: [
            {
              priority: 1,
              type: 'expression',
              formulae: [`COUNTIF($${columnLetter}$2:$${columnLetter}$${rowLimit}, ${columnLetter}2)>1`],
              style: {
                fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } },
                font: { color: { argb: 'FF9C0006' } }
              }
            }
          ]
        });
      }

      // Add Required Field Highlighting
      if (col.required) {
        const lastColLetter = worksheet.getColumn(template.columns.length).letter;
        worksheet.addConditionalFormatting({
          ref: `${columnLetter}2:${columnLetter}${rowLimit}`,
          rules: [
            {
              priority: 2,
              type: 'expression',
              formulae: [`AND(ISBLANK(${columnLetter}2), COUNTA($A2:$${lastColLetter}2)>0)`],
              style: {
                fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFCCCC' } }
              }
            }
          ]
        });
      }

      // PRE-CREATE Validation Objects for Reuse
      let baseValidation: any = null;
      if (validationFormula) {
        baseValidation = {
          type: 'list',
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Invalid Selection',
          error: 'Please select a value from the dropdown list.',
          formulae: validationFormula
        };
      } else if (col.type === 'date') {
        baseValidation = {
          type: 'date',
          operator: 'greaterThan',
          showErrorMessage: true,
          allowBlank: true,
          errorTitle: 'Invalid Date Format',
          error: 'Please enter a valid date in YYYY-MM-DD format.',
          formulae: [new Date('1900-01-01')]
        };
      } else if (col.type === 'number') {
        baseValidation = {
          type: 'decimal',
          operator: 'between',
          showErrorMessage: true,
          allowBlank: true,
          errorTitle: 'Invalid Number',
          error: 'Please enter a valid numerical value.',
          formulae: [-999999999, 999999999]
        };
      }

      for (let i = 2; i <= rowLimit; i++) {
        const cell = worksheet.getCell(`${columnLetter}${i}`);
        
        if (customValidation) {
           // Formulas must be unique per cell because of relative references
           if (col.key === 'pan_number') {
             cell.dataValidation = { ...customValidation, formulae: [`AND(LEN(${columnLetter}${i})=10, ISNUMBER(VALUE(MID(${columnLetter}${i},6,4))), ISERR(VALUE(MID(${columnLetter}${i},1,5))), ISERR(VALUE(MID(${columnLetter}${i},10,1))))`] };
           } else if (col.key === 'gst_number') {
             cell.dataValidation = { ...customValidation, formulae: [`LEN(${columnLetter}${i})=15`] };
           } else if (col.key === 'contact_phone') {
             cell.dataValidation = { ...customValidation, formulae: [`AND(ISNUMBER(VALUE(${columnLetter}${i})), LEN(${columnLetter}${i})=10)`] };
           }
        } else if (baseValidation) {
          cell.dataValidation = baseValidation;
        }
      }
    }

    // Protect the worksheet (Locks the Header row by default, allows editing unlocked cells)
    worksheet.protect(COMMON_PASSWORD, {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: true,
      deleteColumns: false,
      deleteRows: true,
      sort: true,
      autoFilter: true
    });
    processedTemplates++;
  }

  onProgress?.(95);

  const fileName = `Client Management Template.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  onProgress?.(100);
  saveAs(new Blob([buffer]), fileName);
};

/**
 * Parse a multi-sheet Excel file.
 */
export const parseMasterFile = async (file: File): Promise<MasterParseResult> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const data = await file.arrayBuffer();
    await workbook.xlsx.load(data);

    const masterResult: MasterParseResult = {};

    for (const template of TEMPLATE_DEFINITIONS) {
      // Try to find sheet by name
      let worksheet = workbook.getWorksheet(template.name);
      
      // If not found, try case-insensitive or partial match?
      // For now, stick to exact name as generated.
      
      if (!worksheet) continue;

      // Extract rows and validate using the same logic as parseUploadedFile
      // Refactor: We can call a private version of parseUploadedFile that takes a worksheet
      masterResult[template.id] = await parseWorksheet(worksheet, template);
    }

    return masterResult;
  } catch (err) {
    console.error('Master Excel parse error:', err);
    throw new Error('Failed to parse Master Excel file.');
  }
};

/**
 * Helper to parse a single worksheet (Refactored from parseUploadedFile)
 */
const parseWorksheet = async (
  worksheet: ExcelJS.Worksheet,
  template: TemplateDefinition
): Promise<ParseResult> => {
  const rows: any[] = [];
  const headers: string[] = [];

  const firstRow = worksheet.getRow(1);
  firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const headerVal = getCellValue(cell);
    headers[colNumber - 1] = String(headerVal || '').trim();
  });

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData: Record<string, any> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = getCellValue(cell);
      }
    });
    // Check if this row is exactly the sample data
    let isSampleData = false;
    if (rowNumber === 2 && template.sampleData && template.sampleData.length > 0) {
      const sample = template.sampleData[0];
      isSampleData = template.columns.every(col => {
        const val1 = rowData[col.header];
        const val2 = sample[col.key];
        return String(val1 || '').trim() === String(val2 ?? '').trim();
      });
    }

    const hasData = Object.values(rowData).some(v => v !== '' && v !== null && v !== undefined);
    if (hasData && !isSampleData) {
      rows.push({ rowData, rowIndex: rowNumber });
    }
  });

  if (rows.length === 0) {
    return { rows: [], validCount: 0, errorCount: 0, allValid: false, headers };
  }

  const parsedRows: ParsedRow[] = [];
  for (const { rowData, rowIndex } of rows) {
    const errors: ValidationError[] = [];
    const mappedData: Record<string, any> = {};

    for (const col of template.columns) {
      const rawValue = rowData[col.header];
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      mappedData[col.key] = value;

      if (col.required && (value === '' || value === undefined || value === null)) {
        errors.push({ row: rowIndex, column: col.header, message: `${col.header} is required`, value });
      }

      if (value !== '' && value !== undefined && value !== null) {
        if (col.type === 'number' && isNaN(Number(value))) {
          errors.push({ row: rowIndex, column: col.header, message: `${col.header} must be a number`, value });
        }
        if (col.type === 'enum' && col.enumValues && !col.enumValues.includes(String(value))) {
          errors.push({ row: rowIndex, column: col.header, message: `${col.header} must be one of: ${col.enumValues.join(', ')}`, value });
        }
        if (col.type === 'date' && value) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          let dateStr = value instanceof Date ? value.toISOString().split('T')[0] : String(value);
          mappedData[col.key] = dateStr;
          if (!dateRegex.test(dateStr)) {
            errors.push({ row: rowIndex, column: col.header, message: `${col.header} must be in YYYY-MM-DD format`, value });
          }
        }
      }
    }
    parsedRows.push({ rowIndex, data: mappedData, errors, isValid: errors.length === 0 });
  }

  const matchCol = template.columns.find(c => c.key === template.matchKey);
  if (matchCol) {
    const seen = new Map<string, number>();
    parsedRows.forEach((row) => {
      const key = String(row.data[template.matchKey] || '').toLowerCase();
      if (key && seen.has(key)) {
        row.errors.push({ row: row.rowIndex, column: matchCol.header, message: `Duplicate: "${row.data[template.matchKey]}" in row ${seen.get(key)}`, value: row.data[template.matchKey] });
        row.isValid = false;
      } else if (key) {
        seen.set(key, row.rowIndex);
      }
    });
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  return { rows: parsedRows, validCount, errorCount, allValid: errorCount === 0, headers };
};
