import React, { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ChevronDown,
  ChevronRight, Eye, Clock, User, Loader2, FileWarning, ClipboardList, Settings,
  Calculator, Users, Badge, HeartPulse, Archive, Wrench, BarChart, History, Search, CalendarDays
} from 'lucide-react';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import { TEMPLATE_DEFINITIONS, type TemplateDefinition } from '../../utils/templateDefinitions';
import {
  downloadTemplate,
  downloadMasterTemplate,
  parseUploadedFile,
  parseMasterFile,
  downloadErrorReport,
  type ParseResult,
  type ParsedRow,
  type MasterParseResult
} from '../../utils/excelTemplateEngine';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { format } from 'date-fns';
import { ProfilePlaceholder } from '../ui/ProfilePlaceholder';

// Icon map for template cards
const ICON_MAP: Record<string, React.ElementType> = {
  ClipboardList, Settings, Calculator, Users, Badge, HeartPulse, Archive, Wrench, BarChart, CalendarDays
};

// Change log entry type
interface ChangeLogEntry {
  id: string;
  template_id: string;
  template_name: string;
  action: 'upload' | 'download';
  user_id: string;
  user_name: string;
  rows_affected: number;
  rows_created: number;
  rows_updated: number;
  rows_failed: number;
  details: any;
  created_at: string;
}

interface TemplatesHubProps {
  initialTemplateId?: string;
  restrictToTemplateId?: string;
}

const TemplatesHub: React.FC<TemplatesHubProps> = ({ initialTemplateId, restrictToTemplateId }) => {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateDefinition | null>(
    initialTemplateId ? TEMPLATE_DEFINITIONS.find(t => t.id === initialTemplateId) || null : null
  );
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showChangeLogs, setShowChangeLogs] = useState(false);
  const [changeLogs, setChangeLogs] = useState<ChangeLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMasterMode, setIsMasterMode] = useState(false);
  const [masterResult, setMasterResult] = useState<MasterParseResult | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isActualDone, setIsActualDone] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [downloadMonthYear, setDownloadMonthYear] = useState<string>(format(new Date(), 'yyyy-MM'));

  // High-end smooth progress animation
  React.useEffect(() => {
    if (!isPreparing) {
      setDisplayProgress(0);
      setIsActualDone(false);
      return;
    }

    const startTime = Date.now();
    // Estimate 5s for individual, 12s for master for a premium feel
    const targetDuration = isMasterMode ? 12000 : 5000;

    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }

        // Extremely smooth, number-by-number increments
        // 0.1% every 30ms = ~3.3% per second (Total 30s)
        // 0.4% every 30ms = ~13.3% per second (Total 7.5s)
        
        let step = 0.15; // Aim for ~20s total preparation
        
        if (isActualDone) {
          // Once file is ready, move at a steady but faster pace (~10% per second)
          // This ensures the user sees the numbers climbing quickly but smoothly
          step = 0.4;
        } else if (prev >= 95) {
          // Creep at the very end if backend is exceptionally slow
          step = 0.01;
        }

        const next = prev + step;
        return next >= 100 ? 100 : next;
      });
    }, 30);

    return () => clearInterval(timer);
  }, [isPreparing, isActualDone, isMasterMode]);

  // Filter templates by search
  const filteredTemplates = TEMPLATE_DEFINITIONS.filter(t => {
    if (restrictToTemplateId && t.id !== restrictToTemplateId) return false;
    return t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.description.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDownload = useCallback(async (template: TemplateDefinition) => {
    if (isPreparing) return;

    setIsPreparing(true);
    setIsActualDone(false);

    try {
      let dynamicOptions: any;
      
      // For attendance templates, fetch the list of active employees and their sites for dropdowns/autofill
      if (template.id === 'attendance_monthly_bulk' || template.id === 'attendance_bulk') {
        try {
          const users = await api.getUsers({ fetchAll: true });
          
          if (users && users.length > 0) {
            // Filter out unverified users and field staff if needed, or just unverified
            const activeUsers = users.filter((u: any) => u.role !== 'unverified');

            dynamicOptions = {
              // Ensure arrays are exactly the same length, even if values are empty
               employee_name: activeUsers.map((u: any) => `${u.name} (${u.biometricId || 'N/A'})`.trim()),
               employee_id_mapping: activeUsers.map((u: any) => u.biometricId || 'N/A'),
               site_name_mapping: activeUsers.map((u: any) => u.organizationName || 'Office'),
               selected_month: downloadMonthYear
             };
          }
        } catch (error) {
          console.error('Error fetching users for template:', error);
        }
      }

      await downloadTemplate(template, dynamicOptions);
      setIsActualDone(true);
      
      // Wait for animation to hit 100% or close to it
      await new Promise(resolve => {
        const check = setInterval(() => {
          setDisplayProgress(curr => {
            if (curr >= 100) {
              clearInterval(check);
              resolve(true);
            }
            return curr;
          });
        }, 50);
      });

      setToast({ message: `${template.name} template downloaded successfully!`, type: 'success' });
      logAction(template, 'download', 0, 0, 0, 0, null);
    } catch (err) {
      console.error('Download template error:', err);
      setToast({ message: 'Failed to generate template. Please try again.', type: 'error' });
    } finally {
      setIsPreparing(false);
      setIsActualDone(false);
    }
  }, [user, isPreparing, downloadMonthYear]);

  const handleUploadClick = (template: TemplateDefinition) => {
    setIsMasterMode(false);
    setActiveTemplate(template);
    setParseResult(null);
    setMasterResult(null);
    fileInputRef.current?.click();
  };

  const handleMasterUploadClick = () => {
    setIsMasterMode(true);
    setActiveTemplate(null);
    setParseResult(null);
    setMasterResult(null);
    fileInputRef.current?.click();
  };

  const handleMasterDownload = async () => {
    if (isPreparing) return;

    setIsPreparing(true);
    setIsActualDone(false);

    try {
      const [companiesRes, sitesRes, entitiesRes] = await Promise.all([
        supabase.from('companies').select('name'),
        supabase.from('organizations').select('short_name'),
        supabase.from('entities').select('location').not('location', 'is', null)
      ]);
      
      const locations = Array.from(new Set(entitiesRes.data?.map(e => e.location).filter(Boolean) || []));

      const refData = {
        companies: companiesRes.data?.map(c => c.name) || [],
        sites: sitesRes.data?.map(s => s.short_name) || [],
        locations: locations
      };

      const logoUrl = '/Paradigm-Logo-3-1024x157.png';
      const logoBase64 = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('');
        img.src = logoUrl;
      });

      await downloadMasterTemplate(refData, logoBase64);
      setIsActualDone(true);

      // Wait for animation to hit 100%
      await new Promise(resolve => {
        const check = setInterval(() => {
          setDisplayProgress(curr => {
            if (curr >= 100) {
              clearInterval(check);
              resolve(true);
            }
            return curr;
          });
        }, 50);
      });

      setToast({ message: 'Master template downloaded successfully!', type: 'success' });
    } catch (err) {
      console.error('Download error:', err);
      setToast({ message: 'Failed to generate master template.', type: 'error' });
    } finally {
      setIsPreparing(false);
      setIsActualDone(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || (!isMasterMode && !activeTemplate)) return;

    e.target.value = '';
    setIsUploading(true);
    try {
      if (isMasterMode) {
        const result = await parseMasterFile(file);
        const hasData = Object.values(result).some(r => r.rows.length > 0);
        if (!hasData) {
          setToast({ message: 'The uploaded file has no data in any recognized template tabs.', type: 'warning' });
          setIsUploading(false);
          return;
        }
        setMasterResult(result);
        setShowPreview(true);
      } else if (activeTemplate) {
        const result = await parseUploadedFile(file, activeTemplate);
        if (result.rows.length === 0) {
          setToast({ message: 'The uploaded file is empty.', type: 'warning' });
          setIsUploading(false);
          return;
        }
        setParseResult(result);
        setShowPreview(true);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to parse the uploaded file.', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const logAction = async (
    template: TemplateDefinition,
    action: 'upload' | 'download' | 'restore',
    rowsAffected: number,
    rowsCreated: number,
    rowsUpdated: number,
    rowsFailed: number,
    details: any
  ) => {
    try {
      await supabase.from('template_change_logs').insert({
        template_id: template.id,
        template_name: template.name,
        action,
        user_id: user?.id,
        user_name: user?.name || 'Unknown',
        user_photo: user?.photoUrl, // Capture current photo
        rows_affected: rowsAffected,
        rows_created: rowsCreated,
        rows_updated: rowsUpdated,
        rows_failed: rowsFailed,
        details,
      });
    } catch (err) {
      console.warn('Failed to log template action:', err);
    }
  };

  const handleCommit = async () => {
    if ((!isMasterMode && (!parseResult || !activeTemplate)) || (isMasterMode && !masterResult) || !user) return;

    if (isMasterMode) {
      const allSheetsValid = Object.values(masterResult!).every(r => r.allValid);
      if (!allSheetsValid) {
        setToast({ message: 'Some sheets have validation errors. Please fix them before committing.', type: 'error' });
        return;
      }
    } else if (!parseResult!.allValid) {
      setToast({ message: 'Cannot commit — there are validation errors.', type: 'error' });
      return;
    }

    setIsCommitting(true);
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    const priorityMap: Record<string, number> = {
      'client_structure': 1,
      'site_configuration': 2
    };

    const templatesToProcess = (isMasterMode 
      ? TEMPLATE_DEFINITIONS.filter(t => masterResult![t.id] && masterResult![t.id].rows.length > 0)
      : [activeTemplate!]
    ).sort((a, b) => (priorityMap[a.id] || 3) - (priorityMap[b.id] || 3));

    const previousStates: Record<string, any[]> = {};

    try {
      for (const template of templatesToProcess) {
        const result = isMasterMode ? masterResult![template.id] : parseResult!;
        previousStates[template.id] = [];
        let created = 0;
        let updated = 0;
        let failed = 0;

        for (const row of result.rows) {
          if (!row.isValid) { failed++; continue; }

          try {
            if (template.id === 'client_structure') {
              const groupName = row.data['group_name'];
              let groupId;
              const { data: existingGroup } = await supabase.from('organization_groups').select('id').ilike('name', groupName).maybeSingle();
              if (existingGroup) {
                 groupId = existingGroup.id;
              } else {
                 const newGroupId = crypto.randomUUID();
                 const { error: groupErr } = await supabase.from('organization_groups').insert({ id: newGroupId, name: groupName });
                 if (groupErr) throw groupErr;
                 groupId = newGroupId;
              }

              // 2. Company - Only basic info
              const companyName = row.data['company_name'];
              const { data: existingCompany } = await supabase.from('companies').select('id').ilike('name', companyName).maybeSingle();
              let companyId;
              if (existingCompany) {
                 companyId = existingCompany.id;
              } else {
                 const newCompanyId = crypto.randomUUID();
                 const { error: cErr } = await supabase.from('companies').insert({ id: newCompanyId, name: companyName, group_id: groupId });
                 if (cErr) throw cErr;
                 companyId = newCompanyId;
              }

              // 3. Entity (Society/Location) - Registration details
              const location = row.data['location'];
              const entityPayload = {
                 name: companyName,
                 company_id: companyId,
                 location: location,
                 registered_address: row.data['address'],
                 registration_type: row.data['registration_type'],
                 registration_number: row.data['registration_number'],
                 gst_number: row.data['gst_number'],
                 pan_number: row.data['pan_number'],
                 epfo_code: row.data['epfo_code'],
                 esic_code: row.data['esic_code']
              };

              const { data: existingEntity } = await supabase.from('entities')
                .select('id')
                .eq('company_id', companyId)
                .ilike('location', location)
                .maybeSingle();

              if (existingEntity) {
                 await supabase.from('entities').update(entityPayload).eq('id', existingEntity.id);
                 updated++;
              } else {
                 await supabase.from('entities').insert({ id: crypto.randomUUID(), ...entityPayload });
                 created++;
              }
              continue;
            }

            if (template.id === 'site_configuration') {
              const siteName = row.data['short_name'];
              const companyName = row.data['company_name'];
              const { data: comp } = await supabase.from('companies').select('id').ilike('name', companyName).maybeSingle();
              
              const sitePayload = {
                short_name: siteName,
                full_name: siteName,
                address: row.data['address']
              };

              const { data: existingSite } = await supabase.from('organizations').select('id').ilike('short_name', siteName).maybeSingle();
              let siteId;
              if (existingSite) {
                await supabase.from('organizations').update(sitePayload).eq('id', existingSite.id);
                siteId = existingSite.id;
                updated++;
              } else {
                siteId = siteName.toLowerCase().replace(/\s+/g, '_');
                await supabase.from('organizations').insert({ id: siteId, ...sitePayload });
                created++;
              }

              // Also ensure the entity link exists if we have a company
              if (comp) {
                await supabase.from('entities').upsert({
                   id: crypto.randomUUID(),
                   name: siteName,
                   company_id: comp.id,
                   organization_id: siteId,
                   location: row.data['location'],
                   billing_name: row.data['billing_name'],
                   status: row.data['status'] === 'active' ? 'active' : 'inactive',
                   site_management: {
                     contact_person: row.data['contact_person'],
                     contact_phone: row.data['contact_phone']
                   }
                }, { onConflict: 'organization_id,company_id' });
              }
              continue;
            }

            // Specialized handling for JSONB based templates
            if (['asset', 'tools_list', 'attendance_overview', 'costing_resource', 'backoffice_heads', 'gmc_policy'].includes(template.id)) {
              const siteName = row.data['site_name'] || row.data['short_name'];
              const companyName = row.data['company_name'];
              
              // Find site or company ID depending on template
              let targetId;
              const cleanSiteName = siteName?.trim();
              const cleanCompanyName = companyName?.trim();

              if (['gmc_policy'].includes(template.id)) {
                const { data: comp } = await supabase.from('companies').select('id').ilike('name', cleanCompanyName).maybeSingle();
                targetId = comp?.id;
                if (!targetId) console.warn(`[Sync] Company not found for GMC Policy: "${cleanCompanyName}"`);
              } else {
                const { data: site } = await supabase.from('organizations').select('id').ilike('short_name', cleanSiteName).maybeSingle();
                targetId = site?.id;
                
                // PROACTIVE: Auto-create site if missing but mentioned in data
                if (!targetId && cleanSiteName) {
                   console.log(`[Sync] Proactively creating site: "${cleanSiteName}"`);
                   const newSiteId = cleanSiteName.toLowerCase().replace(/\s+/g, '_') + '_' + crypto.randomUUID().slice(0,4);
                   const { error: createErr } = await supabase.from('organizations').insert({
                      id: newSiteId,
                      short_name: cleanSiteName,
                      full_name: cleanSiteName
                   });
                   if (createErr) console.warn('[Sync] Auto-create failed:', createErr);
                   if (!createErr) targetId = newSiteId;
                }
                
                if (!targetId) console.warn(`[Sync] Site not found for ${template.name}: "${cleanSiteName}"`);
              }

              if (!targetId && !['gmc_policy', 'backoffice_heads'].includes(template.id)) { 
                totalFailed++; 
                continue; 
              }

              const dataPayload: Record<string, any> = {};
              template.columns.forEach(col => {
                if (row.data[col.key] !== undefined) dataPayload[col.key] = row.data[col.key];
              });

              if (template.id === 'attendance_overview') {
                const { data: existing } = await supabase.from('attendance_settings_scopes').select('*').eq('scope_type', 'entity').eq('scope_id', targetId).maybeSingle();
                if (existing) previousStates[template.id].push({ table: 'attendance_settings_scopes', data: existing });
                
                await supabase.from('attendance_settings_scopes').upsert({
                  scope_type: 'entity',
                  scope_id: targetId,
                  settings: dataPayload
                }, { onConflict: 'scope_type,scope_id' });
                updated++;
              } else if (template.id === 'costing_resource') {
                const { data: existing } = await supabase.from('site_costing_master').select('*').eq('site_id', targetId).maybeSingle();
                if (existing) {
                  previousStates[template.id].push({ table: 'site_costing_master', data: existing });
                  await supabase.from('site_costing_master').update({ config_data: dataPayload, updated_at: new Date().toISOString() }).eq('id', existing.id);
                } else {
                  await supabase.from('site_costing_master').insert({ id: crypto.randomUUID(), site_id: targetId, config_data: dataPayload });
                }
                updated++;
              } else if (['backoffice_heads', 'gmc_policy'].includes(template.id)) {
                // Settings singleton update
                const settingKey = template.id === 'backoffice_heads' ? 'back_office_id_series' : 'gmc_policy';
                const { data: settings } = await supabase.from('settings').select('*').eq('id', 'singleton').single();
                if (settings) previousStates[template.id].push({ table: 'settings', data: settings });
                
                const currentData = settings?.[settingKey] || [];
                const updatedData = Array.isArray(currentData) ? [...currentData, dataPayload] : [dataPayload];
                await supabase.from('settings').update({ [settingKey]: updatedData }).eq('id', 'singleton');
                updated++;
              } else {
                // Assets and Tools logic
                const { data: existingRecord } = await supabase.from(template.table).select('id, ' + (template.id === 'asset' ? 'assets' : 'tools') as any).eq('organization_id', targetId).maybeSingle();
                const fieldKey = template.id === 'asset' ? 'assets' : 'tools';
                const currentList = (existingRecord as any)?.[fieldKey] || [];
                const newList = Array.isArray(currentList) ? [...currentList, dataPayload] : [dataPayload];
                if (existingRecord) {
                  previousStates[template.id].push({ table: template.table, data: existingRecord });
                  await supabase.from(template.table).update({ [fieldKey]: newList }).eq('id', (existingRecord as any).id);
                } else {
                  await supabase.from(template.table).insert({ id: crypto.randomUUID(), organization_id: targetId, [fieldKey]: newList });
                }
                updated++;
              }
              continue;
            }

            if (template.id === 'attendance_bulk') {
              const employeeId = row.data['employee_id'];
              const providedNameRaw = row.data['employee_name']?.toString().trim();
              const providedName = providedNameRaw?.split(' (')[0]; // Handle Name (ID) format
              // Prefer lookup by name as there is no employee_code column in the users table
              let userQuery = supabase.from('users').select('id, name');
              if (providedName) {
                userQuery = userQuery.ilike('name', providedName);
              } else {
                totalFailed++;
                continue;
              }

              const { data: userData } = await userQuery.maybeSingle();
              
              if (!userData) {
                console.warn(`[Attendance Bulk] User not found for name: ${providedName}`);
                totalFailed++;
                continue;
              }

              // Validate Name Match
              if (providedName && userData.name.toLowerCase() !== providedName.toLowerCase()) {
                console.warn(`[Attendance Bulk] Name mismatch for ${employeeId}. Expected: ${userData.name}, Provided: ${providedName}`);
                totalFailed++;
                continue;
              }

              const date = row.data['date'];
              const punchIn = row.data['punch_in'];
              const punchOut = row.data['punch_out'];
              const siteName = row.data['site_name'];
              const workType = row.data['work_type'];

              // Insert punch-in
              if (punchIn) {
                const timestampIn = `${date}T${punchIn}:00`;
                const { error } = await supabase.from('attendance_events').insert({
                  user_id: userData.id,
                  timestamp: new Date(timestampIn).toISOString(),
                  type: 'punch-in',
                  location_name: siteName,
                  work_type: workType,
                  is_manual: true
                });
                if (!error) created++; else totalFailed++;
              }

              // Insert punch-out
              if (punchOut) {
                const timestampOut = `${date}T${punchOut}:00`;
                const { error } = await supabase.from('attendance_events').insert({
                  user_id: userData.id,
                  timestamp: new Date(timestampOut).toISOString(),
                  type: 'punch-out',
                  location_name: siteName,
                  work_type: workType,
                  is_manual: true
                });
                if (!error) created++; else totalFailed++;
              }
              continue;
            }

            if (template.id === 'attendance_monthly_bulk') {
              // Look up employee by code (auto-filled from Excel dropdown)
              const employeeId = row.data['employee_id']?.toString().trim();
              const providedNameRaw = row.data['employee_name']?.toString().trim();
              // Strip "(EMP001)" suffix that comes from the Excel "Name (ID)" dropdown format
              const providedName = providedNameRaw?.replace(/\s*\([^)]*\)\s*$/, '').trim();

              if (!employeeId && !providedName) { totalFailed++; continue; }

              // Prefer lookup by name as there is no employee_code column in the users table
              let userQuery = supabase
                .from('users')
                .select('id, name, organization_name');
              
              if (providedName) {
                userQuery = userQuery.ilike('name', providedName);
              } else {
                totalFailed++;
                continue;
              }

              const { data: userData, error: userErr } = await userQuery.maybeSingle();

              if (userErr || !userData) { 
                console.warn(`[Monthly Bulk] User lookup error or not found for name: ${providedName}`, userErr);
                totalFailed++; 
                continue; 
              }

              const monthYear = row.data['month_year']?.toString().trim(); // YYYY-MM
              // Default location: use site_name from sheet, else employee's primary org
              const siteName = row.data['site_name']?.toString().trim()
                || userData.organization_name
                || 'Office';

              if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
                console.warn(`[Monthly Bulk] Invalid month_year for ${employeeId}: ${monthYear}`);
                totalFailed++;
                continue;
              }

              // Statuses that generate punch-in/out events with their default times
              const durationMap: Record<string, { in: string; out: string }> = {
                'P':            { in: '09:00', out: '18:00' },
                'PRESENT':      { in: '09:00', out: '18:00' },
                '1/2P':         { in: '09:00', out: '13:30' },
                '1/4P':         { in: '09:00', out: '11:15' },
                '3/4P':         { in: '09:00', out: '15:45' },
                'W/H':          { in: '09:00', out: '17:00' },
                'WFH':          { in: '09:00', out: '17:00' },
                'W/P':          { in: '09:00', out: '18:00' },
                'H/P':          { in: '09:00', out: '18:00' },
                '0.5P EL':      { in: '09:00', out: '13:30' },
                '0.5P SL':      { in: '09:00', out: '13:30' },
                '0.5P CL':      { in: '09:00', out: '13:30' },
                '0.5P LOP':     { in: '09:00', out: '13:30' },
                '0.5P+0.5 EL':  { in: '09:00', out: '13:30' },
                '0.5P+0.5 SL':  { in: '09:00', out: '13:30' },
                '0.5P+0.5 CL':  { in: '09:00', out: '13:30' },
                '0.5P+0.5 LOP': { in: '09:00', out: '13:30' },
              };

              // Statuses that only need a leave record (no attendance punch)
              const leaveOnlyStatuses = ['A', 'ABSENT', 'LOP', 'SL', 'EL', 'CL', 'C/O', 'C/D'];

              for (let day = 1; day <= 31; day++) {
                const rawStatus = row.data[`day_${day}`]?.toString().trim();
                if (!rawStatus || rawStatus === '') continue;

                const status = rawStatus.toUpperCase();
                const dayStr = day.toString().padStart(2, '0');
                const dateStr = `${monthYear}-${dayStr}`;

                // Skip invalid dates (e.g. Feb 30)
                const dateObj = new Date(`${dateStr}T00:00:00`);
                if (isNaN(dateObj.getTime()) || dateObj.getDate() !== day) continue;

                // Skip non-event statuses (Week Off, Holiday) — no DB record needed
                if (['W/O', 'H', 'S', 'WO'].includes(status)) continue;

                // Insert punch events if this status has a time mapping
                const punchTimes = durationMap[status];
                if (punchTimes) {
                  const location = (status === 'W/H' || status === 'WFH') ? 'Work From Home' : siteName;
                  const { error: punchErr } = await supabase.from('attendance_events').insert([
                    {
                      user_id: userData.id,
                      timestamp: new Date(`${dateStr}T${punchTimes.in}:00`).toISOString(),
                      type: 'punch-in',
                      location_name: location,
                      work_type: 'office',
                      is_manual: true
                    },
                    {
                      user_id: userData.id,
                      timestamp: new Date(`${dateStr}T${punchTimes.out}:00`).toISOString(),
                      type: 'punch-out',
                      location_name: location,
                      work_type: 'office',
                      is_manual: true
                    }
                  ]);
                  if (!punchErr) created += 2; else { console.error('[Monthly Bulk] Punch insert error:', punchErr); totalFailed += 2; }
                }

                // Insert leave record for leave/absent statuses
                const isLeave = leaveOnlyStatuses.some(s => status === s || status.includes(s))
                  || ['0.5P EL','0.5P SL','0.5P CL','0.5P LOP','0.5P+0.5 EL','0.5P+0.5 SL','0.5P+0.5 CL','0.5P+0.5 LOP'].includes(status);

                if (isLeave) {
                  let leaveType = 'Loss of Pay';
                  if (status.includes('SL')) leaveType = 'Sick';
                  else if (status.includes('EL')) leaveType = 'Earned';
                  else if (status === 'C/O') leaveType = 'Comp Off';
                  else if (status === 'C/D') leaveType = 'Compensatory Day';
                  else if (status.includes('CL')) leaveType = 'Casual';

                  const isHalfDay = status.startsWith('0.5P');
                  const { error: leaveErr } = await supabase.from('leave_requests').insert({
                    id: crypto.randomUUID(),
                    user_id: userData.id,
                    leave_type: leaveType,
                    start_date: dateStr,
                    end_date: dateStr,
                    reason: 'Bulk Monthly Feed Update',
                    status: 'approved',
                    day_option: isHalfDay ? 'half_afternoon' : 'full',
                    approval_history: []
                  });
                  if (!leaveErr) created++; else { console.error('[Monthly Bulk] Leave insert error:', leaveErr); totalFailed++; }
                }
              }
              continue;
            }

            // Generic logic for other templates with foreign key resolution
            const matchValue = row.data[template.matchKey];
            if (!matchValue) { failed++; continue; }

            const payload: Record<string, any> = {};
            template.columns.forEach(col => {
              if (row.data[col.key] !== '' && row.data[col.key] !== undefined) {
                // Filter out columns that might not exist in the current schema
                if (template.table === 'site_staff_designations' && !['designation', 'department'].includes(col.key)) {
                  return;
                }
                payload[col.key] = col.type === 'number' ? Number(row.data[col.key]) : row.data[col.key];
              }
            });

            // Resolve organization_id if template has site_name
            if (row.data['site_name']) {
              const { data: site } = await supabase.from('organizations').select('id').ilike('short_name', row.data['site_name']).maybeSingle();
              if (site) payload.organization_id = site.id;
            }

            // Resolve company_id if template has company_name
            if (row.data['company_name'] && !payload.company_id) {
              const { data: comp } = await supabase.from('companies').select('id').ilike('name', row.data['company_name']).maybeSingle();
              if (comp) payload.company_id = comp.id;
            }

              const { data: existing } = await supabase
                .from(template.table)
                .select('*')
                .ilike(template.matchKey, matchValue)
                .maybeSingle();

              if (existing) {
                // Save snapshot for restore
                previousStates[template.id].push({ table: template.table, data: existing });
                const { error } = await supabase.from(template.table).update({ ...payload }).eq('id', existing.id);
                if (error) { console.error(`Update failed for ${template.table}:`, error); failed++; } else updated++;
              } else {
                const { error } = await supabase.from(template.table).insert({ id: crypto.randomUUID(), ...payload });
                if (error) { console.error(`Insert failed for ${template.table}:`, error); failed++; } else created++;
              }
          } catch (e) {
            console.error(e);
            failed++;
          }
        }

        totalCreated += created;
        totalUpdated += updated;
        totalFailed += failed;

        await logAction(template, 'upload', result.rows.length, created, updated, failed, {
          columns: template.columns.map(c => c.header),
          sampleRows: result.rows.slice(0, 3).map(r => r.data),
          previousState: previousStates[template.id]
        });
      }

      setIsCommitting(false);
      setShowPreview(false);
      setParseResult(null);
      setMasterResult(null);
      setActiveTemplate(null);

      if (totalFailed === 0) {
        setToast({ message: `Success! ${totalCreated} created, ${totalUpdated} updated across all sections.`, type: 'success' });
      } else {
        setToast({ message: `Completed with issues: ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed.`, type: 'warning' });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'An unexpected error occurred.', type: 'error' });
      setIsCommitting(false);
    }
  };

  const handleDownloadErrors = async () => {
    if (!parseResult || !activeTemplate) return;
    const errorRows = parseResult.rows.filter(r => !r.isValid);
    await downloadErrorReport(activeTemplate, errorRows);
  };

  const loadChangeLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('template_change_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) setChangeLogs(data as ChangeLogEntry[]);
    } catch {
      console.warn('Failed to load change logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRestore = async (log: ChangeLogEntry) => {
    if (!log.details?.previousState || log.details.previousState.length === 0) {
      setToast({ message: 'This entry does not contain restore data.', type: 'warning' });
      return;
    }

    const template = TEMPLATE_DEFINITIONS.find(t => t.id === log.template_id);
    if (!template) {
      setToast({ message: 'Template definition no longer exists.', type: 'error' });
      return;
    }

    if (!window.confirm(`Are you sure you want to restore ${log.details.previousState.length} records to their previous state? This will overwrite the changes made during this upload.`)) {
      return;
    }

    setIsRestoring(log.id);
    try {
      let restored = 0;
      let failed = 0;

      for (const record of log.details.previousState) {
        // Handle polymorphic snapshots (different tables)
        const targetTable = record.table || template.table;
        const targetData = record.data || record;
        
        const { error } = await supabase.from(targetTable).update(targetData).eq('id', targetData.id);
        if (error) failed++;
        else restored++;
      }

      await logAction(template, 'restore', log.details.previousState.length, 0, restored, failed, {
        originalLogId: log.id,
        restoredCount: restored
      });

      setToast({ 
        message: `Restore complete: ${restored} records reverted.${failed > 0 ? ` ${failed} failed.` : ''}`, 
        type: failed > 0 ? 'warning' : 'success' 
      });
      loadChangeLogs();
    } catch (err) {
      console.error('Restore failed:', err);
      setToast({ message: 'An error occurred during restore.', type: 'error' });
    } finally {
      setIsRestoring(null);
    }
  };

  const toggleChangeLogs = () => {
    if (!showChangeLogs) loadChangeLogs();
    setShowChangeLogs(!showChangeLogs);
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {isPreparing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#006b3f]/10 rounded-full"></div>
              <div 
                className="absolute inset-0 border-4 border-[#006b3f] rounded-full border-t-transparent animate-spin"
                style={{ animationDuration: '2s' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-[#006b3f] tabular-nums">
                {Math.round(displayProgress)}%
              </div>
            </div>
            <h3 className="text-xl font-bold text-primary-text mb-2">Preparing Template</h3>
            <p className="text-sm text-muted mb-4">
              {displayProgress >= 100 ? 'Template Ready! Downloading...' : 'Generating your template with real-time data...'}
            </p>
            <div className="h-1.5 w-full bg-page rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-[#006b3f] transition-all duration-75 ease-linear"
                style={{ width: `${displayProgress}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Preparation Progress: {Math.round(displayProgress)}%</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary-text">
            {restrictToTemplateId ? (activeTemplate?.name || 'Bulk Template') : 'Client Management'}
          </h2>
          <p className="text-sm text-muted mt-1">
            Download pre-formatted Excel templates, fill in data, and upload to bulk-manage client records.
          </p>
        </div>
        {!restrictToTemplateId && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleMasterDownload} disabled={isPreparing} className="border-blue-200 text-blue-600 hover:bg-blue-50">
              <Download className="mr-2 h-4 w-4" /> Master Template
            </Button>
            <Button variant="outline" onClick={handleMasterUploadClick} className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
              <Upload className="mr-2 h-4 w-4" /> Upload Master
            </Button>
            <div className="h-8 w-px bg-border mx-1" />
            <Button variant="outline" onClick={toggleChangeLogs} className="border-slate-200 hover:border-[#006b3f] hover:text-[#006b3f]">
              <History className="mr-2 h-4 w-4" /> {showChangeLogs ? 'Hide Logs' : 'Change Logs'}
            </Button>
          </div>
        )}
        {restrictToTemplateId && (
          <Button variant="outline" onClick={toggleChangeLogs} className="border-slate-200 hover:border-[#006b3f] hover:text-[#006b3f]">
            <History className="mr-2 h-4 w-4" /> {showChangeLogs ? 'Hide Logs' : 'Change Logs'}
          </Button>
        )}
      </div>

      {!restrictToTemplateId && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="form-input !pl-10 w-full text-sm"
          />
        </div>
      )}

      {showChangeLogs && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
          <div className="px-6 py-4 border-b border-border bg-page/30">
            <h3 className="font-bold text-primary-text flex items-center gap-2">
              <History className="h-5 w-5 text-[#006b3f]" /> Upload & Download History
            </h3>
          </div>
          {logsLoading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted mb-2" /><p className="text-sm text-muted">Loading history...</p></div>
          ) : changeLogs.length === 0 ? (
            <div className="p-12 text-center text-muted">No history found.</div>
          ) : (
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {changeLogs.map(log => (
                <div key={log.id} className="group">
                  <button onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-page/40 transition-colors text-left">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${log.action === 'upload' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        {log.action === 'upload' ? <Upload className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-text">{log.template_name}<span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${log.action === 'upload' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{log.action.toUpperCase()}</span></p>
                        <p className="text-xs text-muted mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1.5">
                            <div className="h-4 w-4 rounded-full overflow-hidden shadow-sm">
                              <ProfilePlaceholder photoUrl={(log as any).user_photo} seed={log.user_id} />
                            </div>
                            {log.user_name}
                          </span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {log.action === 'upload' && log.details?.previousState?.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handleRestore(log); }}
                          disabled={!!isRestoring}
                          className="h-7 text-[10px] font-bold border-amber-200 text-amber-600 hover:bg-amber-50"
                        >
                          {isRestoring === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Restore Version'}
                        </Button>
                      )}
                      {log.action === 'upload' && (<div className="flex items-center gap-3 text-xs"><span className="text-emerald-600 font-medium">{log.rows_created} created</span><span className="text-amber-600 font-medium">{log.rows_updated} updated</span>{log.rows_failed > 0 && <span className="text-red-500 font-medium">{log.rows_failed} failed</span>}</div>)}
                      <ChevronDown className={`h-4 w-4 text-muted transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {expandedLogId === log.id && log.details && (
                    <div className="px-6 pb-4 bg-page/20 animate-in slide-in-from-top-1">
                      <div className="text-xs text-muted space-y-1 pl-12">
                        {log.details.columns && <p><strong>Columns:</strong> {log.details.columns.join(', ')}</p>}
                        {log.details.sampleRows && (<div className="mt-2"><p className="font-semibold mb-1">Sample Records:</p><div className="overflow-x-auto"><pre className="text-xs bg-white p-3 rounded-lg border border-border">{JSON.stringify(log.details.sampleRows, null, 2)}</pre></div></div>)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => {
          const Icon = ICON_MAP[template.icon] || FileSpreadsheet;
          return (
            <div key={template.id} className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all group border-b-4 border-b-transparent hover:border-b-[#006b3f]">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-page group-hover:bg-[#006b3f]/10 transition-colors text-[#006b3f]">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs text-muted bg-page px-2.5 py-1 rounded-full font-medium">{template.columns.length} fields</span>
              </div>
              <h3 className="text-lg font-bold text-primary-text mb-1">{template.name}</h3>
              <p className="text-sm text-muted mb-5 line-clamp-2">{template.description}</p>
              <div className="mb-5 flex flex-wrap gap-1.5">
                {template.columns.filter(c => c.required).slice(0, 4).map(col => (
                  <span key={col.key} className="text-[10px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{col.header}</span>
                ))}
                {template.columns.filter(c => c.required).length > 4 && <span className="text-[10px] text-muted">+{template.columns.filter(c => c.required).length - 4} more</span>}
              </div>

              {template.id === 'attendance_monthly_bulk' && (
                <div className="mb-5 p-4 rounded-2xl bg-page border border-border group-hover:border-[#006b3f]/20 transition-all duration-300">
                  <label className="text-[10px] uppercase font-bold text-muted mb-2.5 block tracking-widest">Target Month for Download</label>
                  <div className="relative group/input">
                    <input 
                      type="month" 
                      value={downloadMonthYear}
                      onChange={(e) => setDownloadMonthYear(e.target.value)}
                      className="form-input !text-xs w-full bg-white font-bold cursor-pointer hover:border-[#006b3f] transition-all pr-10 shadow-sm"
                    />
                  </div>
                  <p className="text-[10px] text-muted mt-3 leading-relaxed opacity-80 italic">Template will automatically adjust to 28, 30, or 31 days for this month.</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 border-[#006b3f]/20 text-[#006b3f] hover:bg-[#006b3f] hover:text-white hover:border-[#006b3f] transition-all" onClick={() => handleDownload(template)} disabled={isPreparing}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                </Button>
                <Button variant="primary" size="sm" className="flex-1 bg-[#006b3f] hover:bg-[#005632] border-[#006b3f]" onClick={() => handleUploadClick(template)} disabled={isUploading}>
                  {isUploading && activeTemplate?.id === template.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />} Upload
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {showPreview && ((parseResult && activeTemplate) || (isMasterMode && masterResult)) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowPreview(false); setParseResult(null); setMasterResult(null); }}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-[95vw] xl:max-w-[85vw] max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-primary-text flex items-center gap-2">
                  <Eye className="h-5 w-5 text-[#006b3f]" /> {isMasterMode ? 'Master Upload Preview' : `Upload Preview — ${activeTemplate?.name}`}
                </h3>
                <p className="text-sm text-muted mt-0.5">Review the {isMasterMode ? 'summary across all sections' : 'data'} before committing to the database.</p>
              </div>
              <button onClick={() => { setShowPreview(false); setParseResult(null); setMasterResult(null); }} className="p-2 rounded-lg hover:bg-page transition-colors"><X className="h-5 w-5 text-muted" /></button>
            </div>

            {isMasterMode ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TEMPLATE_DEFINITIONS.map(template => {
                    const result = masterResult![template.id];
                    if (!result || result.rows.length === 0) return null;
                    return (
                      <div key={template.id} className="p-4 border border-border rounded-xl bg-page/30">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-primary-text flex items-center gap-2">{React.createElement(ICON_MAP[template.icon] || FileSpreadsheet, { className: "h-4 w-4 text-[#006b3f]" })}{template.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${result.allValid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{result.allValid ? 'READY' : 'HAS ERRORS'}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1.5 text-muted"><FileSpreadsheet className="h-3.5 w-3.5" />{result.rows.length} rows</div>
                          <div className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{result.validCount} valid</div>
                          {result.errorCount > 0 && <div className="flex items-center gap-1.5 text-red-500"><AlertTriangle className="h-3.5 w-3.5" />{result.errorCount} errors</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : parseResult && activeTemplate && (
              <>
                <div className="px-6 py-3 bg-page/40 border-b border-border flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-[#006b3f]" /><span className="font-medium">{parseResult.rows.length} rows</span></div>
                  <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" /><span className="font-medium">{parseResult.validCount} valid</span></div>
                  {parseResult.errorCount > 0 && <div className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-4 w-4" /><span className="font-medium">{parseResult.errorCount} with errors</span></div>}
                </div>
                <div className="flex-1 overflow-auto bg-page/10">
                  <table className="w-full text-left border-collapse min-w-full">
                    <thead className="sticky top-0 bg-page shadow-sm z-10 text-[11px] uppercase tracking-wider font-bold text-muted border-b border-border">
                      <tr><th className="px-6 py-3">#</th>{parseResult.headers.map(h => <th key={h} className="px-6 py-3">{h}</th>)}<th className="px-6 py-3">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parseResult.rows.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-page/50 transition-colors ${!row.isValid ? 'bg-red-50/30' : ''}`}>
                          <td className="px-6 py-3 text-xs text-muted">{row.rowIndex}</td>
                          {activeTemplate.columns.map(col => (<td key={col.key} className={`px-6 py-3 text-xs ${row.errors.find(e => e.column === col.header) ? 'text-red-600 font-medium' : 'text-primary-text'}`}>{row.data[col.key] || <span className="text-muted/40">—</span>}</td>))}
                          <td className="px-6 py-3">
                            {row.isValid ? (
                              <span className="inline-flex items-center text-emerald-600 text-xs font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Valid
                              </span>
                            ) : (
                              <div className="flex flex-col" title={row.errors.map(e => e.message).join('\n')}>
                                <span className="inline-flex items-center text-red-500 text-xs font-medium">
                                  <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Error
                                </span>
                                <span className="text-[10px] text-red-400 mt-0.5 max-w-[200px] whitespace-normal leading-tight">
                                  {row.errors[0]?.message}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div>{!isMasterMode && parseResult?.errorCount ? <Button variant="outline" size="sm" onClick={handleDownloadErrors} className="text-red-500 border-red-200 hover:bg-red-50"><FileWarning className="mr-1.5 h-4 w-4" /> Download Error Report</Button> : null}</div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => { setShowPreview(false); setParseResult(null); setMasterResult(null); }}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleCommit}
                  disabled={isCommitting || (isMasterMode ? !Object.values(masterResult || {}).every(r => r.allValid) : !parseResult?.allValid)}
                  className="bg-[#006b3f] hover:bg-[#005632] border-[#006b3f] disabled:opacity-50"
                >
                  {isCommitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Committing...</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> {isMasterMode ? 'Commit All Data' : `Commit ${parseResult?.validCount} Records`}</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesHub;
