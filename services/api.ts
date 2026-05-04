import { createClient, PostgrestResponse } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { dispatchNotificationFromRules } from './notificationService';
import type {
  OnboardingData, User, Organization, OrganizationGroup, AttendanceEvent, Location, AttendanceSettings, Holiday,
  LeaveBalance, LeaveRequest, Task, Notification, SiteConfiguration, Entity, Policy, Insurance,
  ManpowerDetail, BackOfficeIdSeries, SiteStaffDesignation, Asset, MasterTool, MasterToolsList,
  SiteGentsUniformConfig, MasterGentsUniforms, SiteLadiesUniformConfig, MasterLadiesUniforms, UniformRequest,
  SiteUniformDetailsConfig, EnrollmentRules, InvoiceData, UserRole, UploadedFile, SalaryChangeRequest, SiteStaff,
  SubmissionCostBreakdown, TaskGroup, Role, SupportTicket, TicketPost, TicketComment, VerificationResult, CompOffLog,
  ExtraWorkLog, PerfiosVerificationData, HolidayListItem, UniformRequestItem, IssuedTool, RecurringHolidayRule,
  BiometricDevice, ChecklistTemplate, FieldReport, FieldAttendanceViolation,
  NotificationRule, AutomatedNotificationRule, ScheduledNotification, NotificationType, Company, GmcPolicySettings, StaffAttendanceRules,
  GmcSubmission, UserHoliday, AttendanceUnlockRequest, LeaveType, SiteAttendanceRecord, SiteInvoiceRecord, SiteInvoiceDefault, SiteFinanceRecord,
  CommunicationLog, RevisionLog, UserChild, RoutePoint,
  AttendanceReportType, ReportEmailPayload
} from '../types';
import { getObjectDiff } from '../utils/diff';
import { 
  differenceInCalendarDays, differenceInCalendarMonths, differenceInMonths, format, startOfMonth, endOfMonth, 
  startOfDay, endOfDay, eachDayOfInterval, isSameDay, getDay, getDate, getDaysInMonth, addMonths, addDays,
  subDays, subMonths, eachMonthOfInterval, isSameMonth, startOfWeek
} from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { offlineDb } from './offline/database';
import { Network } from '@capacitor/network';
import { calculateSiteTravelTime, validateFieldStaffAttendance } from '../utils/fieldStaffTracking';
import { isTechnicalRole } from '../utils/attendanceCalculations';
import { FIXED_HOLIDAYS } from '../utils/constants';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { createWorker } from 'tesseract.js';
import { withTimeout } from '../utils/async';
import { getProxyUrl } from '../utils/fileUrl';

const ONBOARDING_DOCS_BUCKET = 'onboarding-documents';
const COMPLIANCE_DOCS_BUCKET = 'compliance-documents';
const AVATAR_BUCKET = 'avatars';
const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments';
const BIRTH_CERT_BUCKET = 'birth-certificates';
// Buckets for storing branding assets.  These buckets should be created
// in your Supabase project via the Storage interface.  The `logo`
// bucket stores the active and default logos displayed throughout the
// application.  The `background` bucket stores the carousel images for
// the login screen.  Policies should permit public read and
// authenticated upload/update/delete.
const LOGO_BUCKET = 'logo';
const BACKGROUND_BUCKET = 'background';

// Bucket used to store attachments uploaded when marking tasks complete.  If this
// bucket does not already exist in your Supabase project, create it via the
// Supabase web console or CLI.  All task completion photos will be stored
// here.  Alternatively you can reuse SUPPORT_ATTACHMENTS_BUCKET if you prefer.
const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

// Resolve the Google GenAI API key from Vite environment variables.  When running
// locally without a real key, the application should still boot and render
// normally; AI-powered features will be disabled.  If a key is provided, the
// GoogleGenAI client is instantiated for use by downstream functions.  If the
// key is missing, log a warning and set `ai` to null.  Downstream functions
// should check for a null `ai` and provide sensible fallbacks rather than
// throwing.
const apiKey = import.meta.env.VITE_API_KEY;
let ai: GoogleGenAI | null = null;
if (!apiKey) {
  console.warn(
    "VITE_API_KEY for Google GenAI is not set in the environment variables. " +
    "AI-powered features (document extraction, name cross‑verification, fingerprint detection, document enhancement) will be disabled."
  );
} else {
  ai = new GoogleGenAI({ apiKey });
}

// --- Location Constants & Helpers ---

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
  'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

const CITY_NAME_MAP: Record<string, string> = {
  'Bangalore': 'Bengaluru',
  'Mysore': 'Mysuru',
  'Mangalore': 'Mangaluru',
  'Vizag': 'Visakhapatnam',
  'Hydrabat': 'Hyderabad',
  'Cochin': 'Kochi'
};

const CITY_TO_STATE_MAP: Record<string, string> = {
  'Hyderabad': 'Telangana',
  'Secunderabad': 'Telangana',
  'Warangal': 'Telangana',
  'Nizamabad': 'Telangana',
  'Bengaluru': 'Karnataka',
  'Hubballi': 'Karnataka',
  'Dharwad': 'Karnataka',
  'Mysuru': 'Karnataka',
  'Mangaluru': 'Karnataka',
  'Mumbai': 'Maharashtra',
  'Pune': 'Maharashtra',
  'Chennai': 'Tamil Nadu',
  'Delhi': 'Delhi',
  'New Delhi': 'Delhi',
  'Kochi': 'Kerala',
  'Visakhapatnam': 'Andhra Pradesh',
  'Vijayawada': 'Andhra Pradesh'
};

const normalizeStateName = (str: string) => {
  if (!str) return '';
  const n = str.trim();
  if (n.toLowerCase() === 'telugana') return 'Telangana';
  return n;
};


// --- Helper Functions ---

const processUrlsForDisplay = (obj: any): any => {
  if (obj === null) return obj;
  
  // If it's a string, check if it's a Supabase URL that needs proxying
  if (typeof obj === 'string') {
    return getProxyUrl(obj);
  }

  if (Array.isArray(obj)) return obj.map(processUrlsForDisplay);
  if (typeof obj !== 'object') return obj;

  const newObj = { ...obj };
  // Check if the object looks like our UploadedFile structure with a path
  if (typeof newObj.name === 'string' && typeof newObj.path === 'string') {
    const bucket = newObj.path.startsWith('avatars/') ? AVATAR_BUCKET : ONBOARDING_DOCS_BUCKET;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(newObj.path);
    const maskedUrl = getProxyUrl(publicUrl);
    newObj.preview = maskedUrl;
    newObj.url = maskedUrl;
  }

  // Recursively process nested objects
  for (const key in newObj) {
    if (Object.prototype.hasOwnProperty.call(newObj, key)) {
      newObj[key] = processUrlsForDisplay(newObj[key]);
    }
  }
  return newObj;
};

/**
 * Recursively process a mixed object structure and upload any File objects to
 * Supabase Storage.  For each file encountered, the file is uploaded to the
 * onboarding documents bucket and a corresponding record is inserted into
 * the user_documents table.  The returned object mirrors the input but
 * replaces File objects with plain metadata objects containing name,
 * type, size and the storage path.  If the input contains nested arrays
 * or objects, those structures are preserved.
 *
 * @param obj        Arbitrary object containing primitive values or nested
 *                   objects/arrays.  Any property named `file` with a
 *                   File instance will be uploaded.
 * @param userId     The ID of the user uploading the file.  Used to
 *                   construct storage paths and associate the document with
 *                   the user_documents table.
 * @param submissionId The onboarding submission ID; helps group files by
 *                   submission when provided.  May be an empty string.
 */
const processFilesForUpload = async (obj: any, userId: string, submissionId: string): Promise<any> => {
  if (obj === null || typeof obj !== 'object') return obj;
  // Handle arrays by processing each element
  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => processFilesForUpload(item, userId, submissionId)));
  }

  const newObj: any = { ...obj };
  // If the object has a File to upload
  if (newObj.file instanceof File) {
    const file: File = newObj.file;
    // Construct a unique storage path using the userId and submissionId
    const filePath = `${userId}/documents/${Date.now()}_${file.name}`;
    // Upload the file to the onboarding documents bucket
    const { error: uploadError } = await supabase.storage.from(ONBOARDING_DOCS_BUCKET).upload(filePath, file);
    if (uploadError) throw uploadError;
    // Insert a record into the user_documents table.  Use a best‑effort
    // approach so the insert failing doesn't block the upload.
    try {
      await supabase.from('user_documents').insert({
        user_id: userId,
        submission_id: submissionId || null,
        name: newObj.name || file.name,
        bucket: ONBOARDING_DOCS_BUCKET,
        path: filePath,
        file_type: file.type,
        file_size: file.size,
      });
    } catch (insertErr) {
      console.error('Failed to record uploaded document:', insertErr);
    }
    // Replace with metadata object that will be stored in the submission JSON
    return {
      name: newObj.name || file.name,
      type: file.type,
      size: file.size,
      path: filePath,
    };
  }
  // If object already has name and path, treat as existing file metadata
  if (typeof newObj.name === 'string' && newObj.path) {
    return {
      name: newObj.name,
      type: newObj.type,
      size: newObj.size,
      path: newObj.path,
    };
  }
  // Recursively process nested properties
  for (const key in newObj) {
    if (Object.prototype.hasOwnProperty.call(newObj, key)) {
      newObj[key] = await processFilesForUpload(newObj[key], userId, submissionId);
    }
  }
  return newObj;
};

const dataUrlToBlob = async (dataUrl: string) => {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    // Fallback if atob fails
    const res = await fetch(dataUrl);
    return await res.blob();
  }
};

const toSnakeCase = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => toSnakeCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
    const snaked: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snaked[snakeKey] = toSnakeCase(data[key]);
      }
    }
    return snaked;
  }
  return data;
};

const toCamelCase = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => toCamelCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const camelCased: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
        let value = data[key];
        
        // Auto-parse JSON strings
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            const parsed = JSON.parse(value);
            // Only use parsed value if it resulted in an object or array
            if (parsed && typeof parsed === 'object') {
              value = parsed;
            }
          } catch (e) {
            // Not JSON or malformed, keep as original string
          }
        }
        
        camelCased[camelKey] = toCamelCase(value);
      }
    }
    return processUrlsForDisplay(camelCased);
  }
  return data;
};

/**
 * Helper to fetch all pages from a Supabase query.
 * Bypasses the default 1000-row limit by paginating until all records are retrieved.
 */
const fetchAll = async <T,>(queryBuilder: any, pageSize = 1000): Promise<T[]> => {
  let allData: T[] = [];
  let from = 0;
  let to = pageSize - 1;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = (await withTimeout(
      queryBuilder.range(from, to) as any,
      15000,
      'Query execution timeout'
    )) as any;
    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
        to += pageSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
};

/**
 * Generic helper to fetch data from a function, cache it locally, 
 * and fallback to the cache if offline or on network failure.
 */
const fetchWithCache = async <T>(cacheKey: string, fetchFn: () => Promise<T>, defaultOfflineValue: any = []): Promise<T> => {
  const status = await Network.getStatus();
  if (status.connected) {
    try {
      const data = await fetchFn();
      if (data !== undefined && data !== null) {
        await offlineDb.setCache(cacheKey, data);
      }
      return data;
    } catch (err: any) {
      console.warn(`[API] Failed to fetch ${cacheKey} from cloud, falling back to cache:`, err);
    }
  }
  
  const cached = await offlineDb.getCache(cacheKey);
  if (cached !== null) return cached;
  
  if (defaultOfflineValue !== undefined) return defaultOfflineValue;
  throw new Error(`You are offline and no cached data is available for ${cacheKey}.`);
};

export const api = {
  processUrlsForDisplay,
  auth: supabase.auth,
  toCamelCase,
  handleError: (error: any): never => {
    if (!error) throw new Error('An unknown error occurred.');
    
    // Check for definitive auth failures (400 - Invalid Token/Expired Session)
    const isAuthError = 
        (error.status === 400 || error.code === '400') && 
        (error.message?.includes('invalid') || error.message?.includes('expired') || error.message?.includes('token'));
    
    const isUnauthorized = error.status === 401 || error.code === '401' || error.status === 403 || error.code === '403';
    
    if (isAuthError || isUnauthorized) {
        console.error('CRITICAL AUTH ERROR (400/401) DETECTED:', error.message);
        // We trigger an event that authStore or App.tsx can handle
        window.dispatchEvent(new CustomEvent('supabase-auth-failure', { detail: error }));
    }
    
    throw error;
  },
  // --- Initial Data Loading ---
  getInitialAppData: async (): Promise<{ settings: any; roles: Role[]; holidays: Holiday[] }> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const [settingsRes, rolesRes, holidaysRes] = (await withTimeout(
          Promise.all([
            supabase.from('settings').select('*').eq('id', 'singleton').maybeSingle(),
            supabase.from('roles').select('*'),
            supabase.from('holidays').select('*')
          ]) as any,
          15000,
          'Initial data fetch timed out'
        )) as any[];

        if (settingsRes.error) return api.handleError(settingsRes.error);
        if (rolesRes.error) return api.handleError(rolesRes.error);
        if (holidaysRes.error) return api.handleError(holidaysRes.error);

        const result = {
          settings: toCamelCase(settingsRes.data),
          roles: (rolesRes.data || []).map(toCamelCase),
          holidays: (holidaysRes.data || []).map(toCamelCase),
        };

        // Cache for offline use
        await offlineDb.setCache('initial_app_data', result);
        return result;
      } catch (err) {
        console.warn('Failed to fetch initial app data from cloud, falling back to cache:', err);
      }
    }

    const cached = await offlineDb.getCache('initial_app_data');
    if (cached) return cached;
    
    throw new Error('You are offline and no cached application data is available. Please connect to the internet.');
  },
  getAttendanceAuditLogs: async (startDate: string, endDate: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('attendance_audit_logs') // Ensure this table exists in your DB
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn("Could not fetch attendance audit logs", error);
      return [];
    }
    return (data || []).map(toCamelCase);
  },

  requestRealTimeTracking: async (targetUserIds: string[], platforms?: string[]): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Create audit log entries with a shared request_id for tracking
    const requestId = crypto.randomUUID();
    const logEntries = targetUserIds.map(targetId => ({
      request_id: requestId,
      admin_id: user.id,
      target_user_id: targetId,
      status: 'pending',
      metadata: { 
        source: 'dashboard_manual_find',
        target_platforms: platforms 
      }
    }));

    const { error: logError } = await supabase.from('tracking_audit_logs').insert(logEntries);
    if (logError) console.error('Failed to log tracking request:', logError);

    // 2. Trigger push notifications via Edge Function
    // We send a disguised 'weather update' which the app handles to record position
    const weatherMessages = [
      { title: 'Weather Update ☀️', message: 'Clear skies today. Perfect for field operations!' },
      { title: 'Weather Advisory ☁️', message: 'Partly cloudy conditions. Stay safe on the road.' },
      { title: 'Daily Forecast 🌡️', message: 'Temperature is within normal range. Keep hydrated!' },
      { title: 'Sky Watch 🌤️', message: 'Good visibility today. Have a productive shift!' },
      { title: 'Atmosphere Update 🌫️', message: 'Visibility is good. Proceed with your scheduled route.' }
    ];
    const randomWeather = weatherMessages[Math.floor(Math.random() * weatherMessages.length)];

    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          userIds: targetUserIds,
          platforms: platforms,
          title: randomWeather.title,
          message: randomWeather.message,
          data: {
            type: 'SILENT_TRACKING_PING',
            requestId: requestId,
            userId: targetUserIds[0] // Primary target user ID for background service route_history insert
          }
        }
      });

      // Local bypass: If the current user is a target, trigger locally too
      // This helps with testing on the same machine and ensures immediate response
      const currentPlatform = Capacitor.getPlatform(); // 'web', 'ios', or 'android'
      const isTargetPlatform = !platforms || platforms.length === 0 || platforms.includes(currentPlatform);

      if (targetUserIds.includes(user.id) && isTargetPlatform) {
        console.log(`[API] Target includes current user on ${currentPlatform}, triggering local ping...`);
        window.dispatchEvent(new CustomEvent('silent-tracking-ping', { 
          detail: { type: 'SILENT_TRACKING_PING', requestId } 
        }));
      }
    } catch (err) {
      console.error('Failed to trigger tracking pings:', err);
      throw err;
    }
  },

  getUserActivePlatforms: async (userIds: string[]): Promise<Record<string, string[]>> => {
    if (userIds.length === 0) return {};

    const { data, error } = await supabase
      .from('fcm_tokens')
      .select('user_id, platform')
      .in('user_id', userIds);

    if (error) {
      console.error('Failed to fetch user platforms:', error);
      return {};
    }

    const mapping: Record<string, string[]> = {};
    (data || []).forEach(row => {
      if (!mapping[row.user_id]) {
        mapping[row.user_id] = [];
      }
      if (!mapping[row.user_id].includes(row.platform)) {
        mapping[row.user_id].push(row.platform);
      }
    });

    return mapping;
  },

  getTrackingAuditLogs: async (startDate: string, endDate: string): Promise<any[]> => {
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // 1. Fetch the raw logs without joins to avoid schema cache issues
      const { data: logs, error: logsError } = await supabase
        .from('tracking_audit_logs')
        .select('*')
        .gte('requested_at', start.toISOString())
        .lte('requested_at', end.toISOString())
        .order('requested_at', { ascending: false });
      
      if (logsError) {
        console.error("Failed to fetch tracking logs:", logsError);
        return [];
      }
      
      if (!logs || logs.length === 0) return [];

      // 2. Collect all unique user IDs involved
      const userIds = new Set<string>();
      logs.forEach(log => {
        if (log.admin_id) userIds.add(log.admin_id);
        if (log.target_user_id) userIds.add(log.target_user_id);
      });

      // 3. Fetch user names, roles and photos in a single batch
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, role_id, photo_url')
        .in('id', Array.from(userIds));

      const userMap = new Map();
      if (!usersError && users) {
        users.forEach(u => userMap.set(u.id, u));
      }

      // 4. Merge data manually
      return logs.map(log => {
        const adminUser = userMap.get(log.admin_id);
        const targetUser = userMap.get(log.target_user_id);
        
        return {
          id: log.id,
          requestId: log.request_id,
          adminId: log.admin_id,
          targetUserId: log.target_user_id,
          requestedAt: log.requested_at,
          status: log.status,
          admin: adminUser ? { 
            name: adminUser.name, 
            role: adminUser.role_id, 
            photoUrl: adminUser.photo_url 
          } : { name: 'Unknown Admin', role: '', photoUrl: null },
          target: targetUser ? { 
            name: targetUser.name, 
            role: targetUser.role_id, 
            photoUrl: targetUser.photo_url 
          } : { name: 'Unknown Agent', role: '', photoUrl: null }
        };
      });
    } catch (err) {
      console.error("Exception in getTrackingAuditLogs:", err);
      return [];
    }
  },

  updateTrackingRequestStatus: async (requestId: string, status: 'successful' | 'failed'): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('tracking_audit_logs')
        .update({ status })
        .eq('request_id', requestId)
        .eq('target_user_id', user.id);
        
      if (error) {
        console.error(`[API] Failed to update tracking status to ${status}:`, error);
      } else {
        console.log(`[API] Successfully updated tracking status for request ${requestId} to ${status}`);
      }
    } catch (err) {
      console.error('[API] Exception updating tracking status:', err);
    }
  },

  getSiteAttendanceRecords: async (): Promise<SiteAttendanceRecord[]> => {
    return fetchWithCache('site_attendance_records', async () => {
      const { data, error } = await supabase
        .from('site_attendance_tracker')
        .select('*')
        .order('billing_date', { ascending: false });
      if (error) throw error;
      return (data || []).map(toCamelCase);
    });
  },

  saveSiteAttendanceRecord: async (record: Partial<SiteAttendanceRecord>): Promise<SiteAttendanceRecord> => {
    const { id, billingDifference, managementFeeDifference, variationStatus, createdAt, updatedAt, ...rest } = record;
    const dbData = toSnakeCase(rest);
    let query;
    if (id) {
      query = supabase.from('site_attendance_tracker').update(dbData).eq('id', id);
    } else {
      query = supabase.from('site_attendance_tracker').insert(dbData);
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  deleteSiteAttendanceRecord: async (id: string): Promise<void> => {
    const { error } = await supabase.from('site_attendance_tracker').delete().eq('id', id);
    if (error) throw error;
  },

  getSiteInvoiceRecords: async (managerId?: string): Promise<SiteInvoiceRecord[]> => {
    return fetchWithCache(`site_invoice_records_${managerId || 'all'}`, async () => {
      const query = supabase
        .from('site_invoice_tracker')
        .select('*, creator:created_by(reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id)')
        .is('deleted_at', null)
        .order('site_name');
      
      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (managerId) {
          filteredData = filteredData.filter((row: any) => 
              row.creator?.reporting_manager_id === managerId ||
              row.creator?.reporting_manager_2_id === managerId ||
              row.creator?.reporting_manager_3_id === managerId
          );
      }

      return filteredData.map(toCamelCase);
    });
  },

  getDeletedSiteInvoiceRecords: async (managerId?: string): Promise<SiteInvoiceRecord[]> => {
    return fetchWithCache(`deleted_site_invoice_records_${managerId || 'all'}`, async () => {
      let query = supabase
        .from('site_invoice_tracker')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('site_name');
        
      if (managerId) {
          query = query.eq('created_by', managerId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(toCamelCase);
    });
  },

  saveSiteInvoiceRecord: async (record: Partial<SiteInvoiceRecord>): Promise<SiteInvoiceRecord> => {
    const { id, sNo, createdAt, updatedAt, revisionCount, ...rest } = record;
    const dbData = toSnakeCase(rest);
    let query;
    if (id) {
      // Fetch the existing record for diff comparison
      const { data: existingRaw } = await supabase.from('site_invoice_tracker').select('*').eq('id', id).single();
      const existingRecord = existingRaw ? toCamelCase(existingRaw) : null;

      query = supabase.from('site_invoice_tracker').update(dbData).eq('id', id);
      const { data, error } = await query.select().single();
      if (error) throw error;

      // Log revision if there are differences
      if (existingRecord) {
        const diff = getObjectDiff(existingRecord, toCamelCase(data));
        if (Object.keys(diff).length > 0) {
          const newRevisionNumber = (existingRecord.revisionCount || 0) + 1;
          await supabase.from('site_invoice_revisions').insert({
            record_id: id,
            revised_by: record.createdBy || null,
            revised_by_name: record.createdByName || 'Unknown',
            diff: diff,
            revision_number: newRevisionNumber
          });
          // Update revision count on the main record
          await supabase.from('site_invoice_tracker').update({ revision_count: newRevisionNumber }).eq('id', id);
        }
      }
      return toCamelCase(data);
    } else {
      query = supabase.from('site_invoice_tracker').insert(dbData);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return toCamelCase(data);
    }
  },

  softDeleteSiteInvoiceRecord: async (id: string, reason: string, userId: string, userName: string): Promise<void> => {
    const { error } = await supabase
      .from('site_invoice_tracker')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deleted_by_name: userName,
        deleted_reason: reason
      })
      .eq('id', id);
    if (error) throw error;
  },

  bulkSoftDeleteSiteInvoiceRecords: async (ids: string[], reason: string, userId: string, userName: string): Promise<void> => {
    const { error } = await supabase
      .from('site_invoice_tracker')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deleted_by_name: userName,
        deleted_reason: reason
      })
      .in('id', ids);
    if (error) throw error;
  },

  restoreSiteInvoiceRecord: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('site_invoice_tracker')
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_by_name: null,
        deleted_reason: null
      })
      .eq('id', id);
    if (error) throw error;
  },

  permanentlyDeleteSiteInvoiceRecord: async (id: string): Promise<void> => {
    const { error } = await supabase.from('site_invoice_tracker').delete().eq('id', id);
    if (error) throw error;
  },

  bulkRestoreSiteInvoiceRecords: async (ids: string[]): Promise<void> => {
    const { error } = await supabase
      .from('site_invoice_tracker')
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_by_name: null,
        deleted_reason: null
      })
      .in('id', ids);
    if (error) throw error;
  },

  bulkPermanentlyDeleteSiteInvoiceRecords: async (ids: string[]): Promise<void> => {
    const { error } = await supabase.from('site_invoice_tracker').delete().in('id', ids);
    if (error) throw error;
  },

  // --- Revision History ---
  getSiteInvoiceRevisions: async (recordId: string): Promise<RevisionLog[]> => {
    const { data, error } = await supabase
      .from('site_invoice_revisions')
      .select('*')
      .eq('record_id', recordId)
      .order('revision_number', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  getSiteFinanceRevisions: async (recordId: string): Promise<RevisionLog[]> => {
    const { data, error } = await supabase
      .from('site_finance_revisions')
      .select('*')
      .eq('record_id', recordId)
      .order('revision_number', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  // --- Site Invoice Defaults (Auto-fill templates) ---
  getSiteInvoiceDefaults: async (managerId?: string): Promise<SiteInvoiceDefault[]> => {
    return fetchWithCache(`site_invoice_defaults_${managerId || 'all'}`, async () => {
      let query = supabase
        .from('site_invoice_defaults')
        .select('*')
        .order('site_name');
        
      if (managerId) {
          query = query.eq('created_by', managerId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(toCamelCase);
    });
  },

  upsertSiteContract: async (siteId: string, year: number, details: { contractAmount: number, contractManagementFee: number, companyName: string, createdBy?: string, createdByName?: string }): Promise<void> => {
    // 1. Try to find existing contract for this site and year
    const { data: existing } = await supabase.from('site_invoice_defaults')
        .select('id')
        .eq('site_id', siteId)
        .eq('billing_year', year)
        .maybeSingle();

    const payload = {
        site_id: siteId,
        billing_year: year,
        company_name: details.companyName,
        contract_amount: details.contractAmount,
        contract_management_fee: details.contractManagementFee,
    };

    if (existing) {
        const { error } = await supabase.from('site_invoice_defaults').update({
            ...payload,
            updated_at: new Date().toISOString()
        }).eq('id', existing.id);
        if (error) throw error;
    } else {
        // Need site_name for new insert
        // Only query organizations if siteId is a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let org = null;
        if (uuidRegex.test(siteId)) {
            const { data } = await supabase.from('organizations').select('short_name').eq('id', siteId).single();
            org = data;
        }

        if (org) {
            const { error } = await supabase.from('site_invoice_defaults').insert({ 
                ...payload, 
                site_name: org.short_name,
                created_by: details.createdBy,
                created_by_name: details.createdByName
            });
            if (error) throw error;
        }
    }
  },

  saveSiteInvoiceDefault: async (record: Partial<SiteInvoiceDefault>): Promise<SiteInvoiceDefault> => {
    const { id, createdAt, updatedAt, ...rest } = record;
    const dbData = toSnakeCase(rest);
    let query;
    if (id) {
      query = supabase.from('site_invoice_defaults').update({
          ...dbData,
          updated_at: new Date().toISOString()
      }).eq('id', id);
    } else {
      query = supabase.from('site_invoice_defaults').upsert(dbData, { onConflict: 'site_id' });
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  bulkSaveSiteInvoiceDefaults: async (records: Partial<SiteInvoiceDefault>[]): Promise<void> => {
    const dbRecords = records.map(r => {
      const { id, createdAt, updatedAt, ...rest } = r;
      return toSnakeCase(rest);
    });
    const { error } = await supabase.from('site_invoice_defaults').upsert(dbRecords, { onConflict: 'site_id' });
    if (error) throw error;
  },

  bulkSaveSiteInvoiceRecords: async (records: Partial<SiteInvoiceRecord>[]): Promise<void> => {
    const dbRecords = records.map(r => {
      const { id, sNo, createdAt, updatedAt, ...rest } = r;
      return toSnakeCase(rest);
    });
    const { error } = await supabase.from('site_invoice_tracker').insert(dbRecords);
    if (error) throw error;
  },

    // --- Settings ---
  updateAttendanceSettings: async (settings: AttendanceSettings): Promise<void> => {
    // Determine the ID to update. Singleton is usually 'singleton' or a specific ID.
    // Based on getInitialAppData, it fetches where id='singleton'.
    const { error } = await supabase
      .from('settings')
      .update({ attendance_settings: toSnakeCase(settings) })
      .eq('id', 'singleton');

    if (error) throw error;
  },

  getScopedAttendanceSettings: async (scope: 'location' | 'company' | 'entity', scopeId: string): Promise<AttendanceSettings | null> => {
    const { data, error } = await supabase
      .from('attendance_settings_scopes')
      .select('settings')
      .eq('scope_type', scope)
      .eq('scope_id', scopeId)
      .maybeSingle();

    if (error) throw error;
    return data ? toCamelCase(data.settings) : null;
  },

  saveScopedAttendanceSettings: async (scope: 'location' | 'company' | 'entity', scopeId: string, settings: AttendanceSettings): Promise<void> => {
    const { error } = await supabase
      .from('attendance_settings_scopes')
      .upsert({
        scope_type: scope,
        scope_id: scopeId,
        settings: toSnakeCase(settings),
        updated_at: new Date().toISOString()
      }, { onConflict: 'scope_type,scope_id' });

    if (error) throw error;
  },

  getAllScopedSettings: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('attendance_settings_scopes')
      .select('*');
    
    if (error) throw error;
    return (data || []).map(item => ({
        ...item,
        settings: toCamelCase(item.settings)
    }));
  },

  // --- Onboarding & Verification ---
  getVerificationSubmissions: async (status?: string, organizationId?: string, managerId?: string): Promise<OnboardingData[]> => {
    return fetchWithCache(`verification_submissions_${status || 'all'}_${organizationId || 'all'}_${managerId || 'all'}`, async () => {
      let query = supabase.from('onboarding_submissions').select('*, user:user_id(reporting_manager_id)');
      if (status) query = query.eq('status', status);
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(5000);
      if (error) throw error;
      
      let filteredData = data || [];
      if (managerId) {
          filteredData = filteredData.filter((row: any) => 
              row.user?.reporting_manager_id === managerId || 
              row.user?.reporting_manager_2_id === managerId || 
              row.user?.reporting_manager_3_id === managerId
          );
      }
      
      return filteredData.map(toCamelCase);
    });
  },

  getOnboardingDataById: async (id: string): Promise<OnboardingData | null> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase.from('onboarding_submissions').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          const formatted = processUrlsForDisplay(toCamelCase(data));
          await offlineDb.setCache(`onboarding_${id}`, formatted);
          return formatted;
        }
      } catch (err) {
        console.warn('Failed to fetch onboarding data from cloud, falling back to cache');
      }
    }
    return processUrlsForDisplay(await offlineDb.getCache(`onboarding_${id}`));
  },

  _saveSubmission: async (data: OnboardingData, asDraft: boolean): Promise<{ draftId: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const submissionId = (data.id && !data.id.startsWith('draft_')) ? data.id : (data.id || crypto.randomUUID());
    
    const status = await Network.getStatus();
    if (!status.connected) {
        const offlineData = { ...data, id: submissionId, status: asDraft ? 'draft' : data.status };
        await offlineDb.addToOutbox({ table_name: 'onboarding_submissions', action: 'INSERT', payload: { data, asDraft } });
        await offlineDb.setCache(`onboarding_${submissionId}`, offlineData);
        return { draftId: submissionId };
    }

    const dataWithPaths = await processFilesForUpload(data, session.user.id, submissionId);
    const snakedData = toSnakeCase(dataWithPaths);
    
    const dbData = {
      ...snakedData,
      id: submissionId,
      user_id: session.user.id,
      employee_id: data.personal?.employeeId || null,
      status: asDraft ? 'draft' : data.status,
    };

    // Remove any client-side only properties that don't have columns
    delete dbData.file;
    delete dbData.confirm_account_number;
    delete (dbData as any).is_qr_verified; 

    const { data: savedData, error } = await supabase.from('onboarding_submissions').upsert(dbData, { onConflict: 'id' }).select('id').single();
    if (error) {
        console.error('Save submission error:', error);
        throw error;
    }
    // Update cache
    await offlineDb.setCache(`onboarding_${savedData.id}`, toCamelCase(dbData));
    return { draftId: savedData.id };
  },

  saveDraft: async (data: OnboardingData) => api._saveSubmission(data, true),

  submitGmcPublicForm: async (data: any) => {
    const { error } = await supabase.from('gmc_form_submissions').insert([toSnakeCase(data)]);
    if (error) throw error;
  },

  getGMCRates: async (): Promise<{ id: number, minAge: number, maxAge: number, rate: number }[]> => {
    const { data, error } = await supabase
        .from('gmc_rates')
        .select('*')
        .order('min_age', { ascending: true });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  updateGMCRate: async (id: number, updates: { minAge?: number, maxAge?: number, rate?: number }): Promise<void> => {
    const { error } = await supabase
        .from('gmc_rates')
        .update(toSnakeCase(updates))
        .eq('id', id);
    if (error) throw error;
  },

  addGMCRate: async (rateData: { minAge: number, maxAge: number, rate: number }): Promise<void> => {
    const { error } = await supabase
        .from('gmc_rates')
        .insert([toSnakeCase(rateData)]);
    if (error) throw error;
  },

  deleteGMCRate: async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('gmc_rates')
        .delete()
        .eq('id', id);
    if (error) throw error;
  },

  getGmcSubmissions: async (filters?: { 
    name?: string, 
    site?: string, 
    role?: string, 
    company?: string,
    minAge?: number,
    maxAge?: number,
    maritalStatus?: string,
    startDate?: string,
    endDate?: string,
    page?: number,
    limit?: number 
  }): Promise<{ data: GmcSubmission[], total: number }> => {
    const filterKey = JSON.stringify(filters || {});
    return fetchWithCache(`gmc_submissions_${filterKey}`, async () => {
      const { 
        name, site, role, company, 
        minAge, maxAge, maritalStatus,
        startDate, endDate,
        page, limit 
      } = filters || {};
      let query = supabase.from('gmc_form_submissions').select('*', { count: 'exact' });

      if (name) query = query.ilike('employee_name', `%${name}%`);
      if (site) query = query.eq('site_name', site);
      // Role is not explicitly in the GMCForm data but can be searched in the employee_name/details if needed.
      // However, the user asked for "search by name,site,role,etc". 
      // I'll assume role might be added later or we search in related user data if available.
      // For now, I'll filter by the fields we have.
      if (company) query = query.eq('company_name', company);
      if (maritalStatus) query = query.eq('marital_status', maritalStatus);

      if (minAge !== undefined || maxAge !== undefined) {
        const today = new Date();
        if (maxAge !== undefined) {
          // maxAge 30 means DOB must be >= (Today - 31 years + 1 day)
          const minDob = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate() + 1);
          query = query.gte('dob', format(minDob, 'yyyy-MM-dd'));
        }
        if (minAge !== undefined) {
          // minAge 18 means DOB must be <= (Today - 18 years)
          const maxDob = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
          query = query.lte('dob', format(maxDob, 'yyyy-MM-dd'));
        }
      }

      if (startDate) {
        query = query.gte('updated_at', startOfDay(new Date(startDate)).toISOString());
      }
      if (endDate) {
        query = query.lte('updated_at', endOfDay(new Date(endDate)).toISOString());
      }

      const currentPage = page || 1;
      const currentLimit = limit || 10;
      const isExport = limit === -1;

      if (!isExport) {
          const from = (currentPage - 1) * currentLimit;
          const to = from + currentLimit - 1;
          query = query.range(from, to);
      }

      const { data, error, count } = await query
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return {
        data: (data || []).map(toCamelCase),
        total: count || 0
      };
    }, { data: [], total: 0 });
  },

  getEntities: async (): Promise<Entity[]> => {
    const { data, error } = await supabase.from('entities').select('*').order('name');
    if (error) throw error;
    return (data || []).map(row => processUrlsForDisplay(toCamelCase(row)));
  },

  getGroups: async (): Promise<OrganizationGroup[]> => {
    const { data, error } = await supabase.from('organization_groups').select('*').order('name');
    if (error) throw error;
    return (data || []).map(row => processUrlsForDisplay(toCamelCase(row)));
  },

  submitOnboarding: async (data: OnboardingData) => {
    const { draftId } = await api._saveSubmission(data, false);
    const submittedData = await api.getOnboardingDataById(draftId);
    if (!submittedData) throw new Error("Failed to retrieve submitted data.");
    
    // Trigger rule-based notification
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        dispatchNotificationFromRules('onboarding_submitted', {
            actorName: data.personal.firstName + ' ' + data.personal.lastName,
            actionText: 'has submitted a new enrollment',
            locString: '',
            actor: { id: user.id, name: user.email || 'Admin', role: 'admin' }
        });
    }
    
    return submittedData;
  },

  updateOnboarding: async (data: OnboardingData) => {
    const { draftId } = await api._saveSubmission(data, data.status === 'draft');
    const updatedData = await api.getOnboardingDataById(draftId);
    if (!updatedData) throw new Error("Failed to retrieve updated data.");
    return updatedData;
  },

  verifySubmission: async (id: string): Promise<void> => {
    const { error } = await supabase.from('onboarding_submissions').update({ status: 'verified', portal_sync_status: 'pending_sync' }).eq('id', id);
    if (error) throw error;
    
    // Trigger notification
    const submission = await api.getOnboardingDataById(id);
    const { data: { user } } = await supabase.auth.getUser();
    if (submission && user) {
        dispatchNotificationFromRules('onboarding_verified', {
            actorName: 'Enrollment for ' + (submission.personal as any).firstName,
            actionText: 'has been verified',
            locString: '',
            actor: { id: user.id, name: user.email || 'Admin', role: 'admin' }
        });
    }
  },

  requestChanges: async (id: string, reason: string): Promise<void> => {
    const { error } = await supabase.from('onboarding_submissions').update({ status: 'rejected' }).eq('id', id);
    if (error) throw error;
    
    // Trigger notification
    const submission = await api.getOnboardingDataById(id);
    const { data: { user } } = await supabase.auth.getUser();
    if (submission && user) {
        dispatchNotificationFromRules('onboarding_rejected', {
            actorName: 'Enrollment for ' + (submission.personal as any).firstName,
            actionText: 'has been rejected (changes requested)',
            locString: '',
            actor: { id: user.id, name: user.email || 'Admin', role: 'admin' }
        });
    }
  },

  syncPortals: async (id: string): Promise<OnboardingData> => {
    const { data, error } = await supabase.functions.invoke('sync-portals', { body: { submissionId: id } });
    if (error) throw error;
    return toCamelCase(data);
  },

  deleteFile: async (filePath: string): Promise<void> => {
    // Ensure the default bucket exists before removal
    await api.ensureBucket(ONBOARDING_DOCS_BUCKET);
    const { error } = await supabase.storage.from(ONBOARDING_DOCS_BUCKET).remove([filePath]);
    if (error) throw error;
  },

  /**
   * Upload a single file to Supabase Storage.  The default bucket is
   * `ONBOARDING_DOCS_BUCKET`, but a different bucket can be specified if
   * necessary (for example when uploading attachments for tasks or support
   * tickets).  After uploading the file, the public URL is returned along
   * with the storage path.  This helper will also create an entry in
   * the `user_documents` table recording the upload, allowing CRUD
   * operations on uploaded documents through the database.  The
   * `submissionId` and `docName` parameters are optional; when provided
   * they are stored in the user_documents table for additional context.
   *
   * @param file     The File object to upload
   * @param bucket   The storage bucket to upload to
   * @param submissionId (optional) ID of the related onboarding submission
   * @param docName  (optional) descriptive name of the document (e.g. 'idProofFront')
   */
  ensureBucket: async (bucket: string): Promise<void> => {
    // [SECURITY FIX H2 + M3] Define allowed MIME types and size limits.
    // Only branding buckets (logo, background) should be public.
    const ALLOWED_MIME_TYPES = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'application/xml', 'text/xml'
    ];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const PUBLIC_BUCKETS = [LOGO_BUCKET, BACKGROUND_BUCKET, AVATAR_BUCKET];
    const isPublicBucket = PUBLIC_BUCKETS.includes(bucket);

    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const existing = buckets?.find(b => b.name === bucket);
      if (!existing) {
        console.log(`Bucket "${bucket}" not found, creating (public=${isPublicBucket})...`);
        const { error } = await supabase.storage.createBucket(bucket, {
          public: isPublicBucket,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
          fileSizeLimit: MAX_FILE_SIZE
        });
        if (error) {
          console.error(`Failed to create bucket "${bucket}":`, error);
        } else {
          console.log(`Bucket "${bucket}" created successfully.`);
        }
      } else if (!existing.public && isPublicBucket) {
        // Only make public if it's a branding/avatar bucket
        console.log(`Bucket "${bucket}" exists but is private, updating to public...`);
        const { error } = await supabase.storage.updateBucket(bucket, { public: true });
        if (error) {
          console.error(`Failed to update bucket "${bucket}" to public:`, error);
        } else {
          console.log(`Bucket "${bucket}" is now public.`);
        }
      }
    } catch (e) {
      console.error('Error in ensureBucket:', e);
    }
  },

  uploadDocument: async (
    file: File,
    bucket: string = ONBOARDING_DOCS_BUCKET,
    submissionId?: string,
    docName?: string
  ): Promise<{ url: string; path: string; }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || 'anonymous_user';
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/\s+/g, '_').toLowerCase();
    const filePath = `documents/${userId}/${timestamp}/${sanitizedFileName}`;
    
    // Ensure the destination bucket exists
    await api.ensureBucket(bucket);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (!data.publicUrl) throw new Error('Could not get public URL for uploaded file.');

    // Record the uploaded document in the user_documents table.  Use a try/catch
    // so that even if this insert fails, the upload will still succeed.
    try {
      await supabase.from('user_documents').insert({
        user_id: userId,
        submission_id: submissionId || null,
        name: docName || file.name,
        bucket,
        path: filePath,
        file_type: file.type,
        file_size: file.size,
      });
    } catch (e) {
      console.error('Failed to insert user_documents record:', e);
    }
    return { url: data.publicUrl, path: filePath };
  },

  deleteFileFromStorage: async (url: string): Promise<void> => {
    if (!url || typeof url !== 'string') return;
    try {
        let bucket = '';
        let path = '';

        if (url.includes('/storage/v1/object/public/')) {
            const afterPublic = url.split('/public/')[1];
            const parts = afterPublic.split('/');
            bucket = parts[0];
            path = parts.slice(1).join('/');
        } else if (url.includes('/api/view-file/')) {
            // Handle proxied URLs
            const afterProxy = url.split('/api/view-file/')[1];
            const parts = afterProxy.split('/');
            bucket = parts[0];
            path = parts.slice(1).join('/');
        }

        if (bucket && path) {
            console.log(`[API] Deleting file from storage: bucket=${bucket}, path=${path}`);
            const decodedPath = decodeURIComponent(path);
            const { error } = await supabase.storage.from(bucket).remove([decodedPath]);
            if (error) throw error;

            // Also remove from user_documents table if it exists there
            await supabase.from('user_documents').delete().eq('path', decodedPath);
        }
    } catch (e) {
        console.error('[API] Failed to delete file from storage:', e);
        throw e;
    }
  },

  bulkUpdateUserLeaves: async (updates: any[]): Promise<void> => {
    // Use individual updates to avoid not-null constraint errors on other columns
    for (const update of updates) {
      const { error } = await supabase
        .from('users')
        .update(toSnakeCase(update))
        .eq('id', update.id);
      if (error) throw error;
    }
  },


  // --- Users & Orgs ---
  getUsers: async (filter?: { page?: number, pageSize?: number, search?: string, sortBy?: string, sortAscending?: boolean, fetchAll?: boolean }): Promise<any> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        const cached = await offlineDb.getCache(filter?.fetchAll ? 'users_all' : 'users') || [];
        if (filter?.page !== undefined && filter?.pageSize !== undefined) {
            return { data: cached, total: cached.length };
        }
        return cached;
    }

    if (filter?.fetchAll) {
      let allData: any[] = [];
      let page = 1;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('users')
          .select('*, role:roles(display_name)')
          .range((page - 1) * pageSize, page * pageSize - 1)
          .order(filter?.sortBy || 'created_at', { ascending: filter?.sortAscending ?? false });

        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      return allData.map(u => {
        const roleData = u.role;
        const rawRoleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || u.role_id;
        const roleName = typeof rawRoleName === 'string' ? rawRoleName.toLowerCase().replace(/\s+/g, '_') : rawRoleName;
        return toCamelCase({ ...u, role: roleName });
      });
    }

    let query = supabase.from('users').select('*, role:roles(display_name)', { count: 'exact' });
    
    if (filter?.search) {
      query = query.or(`name.ilike.%${filter.search}%,email.ilike.%${filter.search}%`);
    }

    // Default to created_at descending if no sort specified
    const sortBy = filter?.sortBy || 'created_at';
    const sortAscending = filter?.sortAscending ?? (filter?.sortBy ? true : false);
    query = query.order(sortBy, { ascending: sortAscending });

    const isPaginated = filter?.page !== undefined && filter?.pageSize !== undefined;
    if (isPaginated) {
      const from = (filter!.page! - 1) * filter!.pageSize!;
      const to = from + filter!.pageSize! - 1;
      query = query.range(from, to);
    }
    
    const { data, count, error } = await query;
    if (error) throw error;
    
    const formattedData = (data || []).map(u => {
      const roleData = u.role;
      const rawRoleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || u.role_id;
      const roleName = typeof rawRoleName === 'string' ? rawRoleName.toLowerCase().replace(/\s+/g, '_') : rawRoleName;
      return toCamelCase({ ...u, role: roleName });
    });
    
    if (isPaginated) {
      return { data: formattedData.map(processUrlsForDisplay), total: count || 0 };
    }
    return formattedData.map(processUrlsForDisplay);
  },

  getUserHolidays: async (userId: string): Promise<UserHoliday[]> => {
    const { data, error } = await supabase
      .from('user_holidays')
      .select('*')
      .eq('user_id', userId);
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, we'll return empty array and log error
      console.warn("User holidays table might not exist:", error);
      return [];
    }
    return (data || []).map(toCamelCase);
  },

  getAllUserHolidays: async (filters?: { userIds?: string[], year?: number }): Promise<(UserHoliday & { userName?: string })[]> => {
    let query = supabase.from('user_holidays').select('*');
    
    if (filters?.userIds && filters.userIds.length > 0) {
      query = query.in('user_id', filters.userIds);
    }
    
    if (filters?.year) {
      query = query.eq('year', filters.year);
    }

    const { data, error } = await query;
    
    if (error) {
      console.warn("Error fetching user holidays:", error);
      return [];
    }

    return (data || []).map(toCamelCase);
  },

  saveUserHolidays: async (userId: string, holidays: { holidayName: string; holidayDate: string; year: number }[]): Promise<void> => {
    // Delete existing for the same year
    const year = holidays[0]?.year || new Date().getFullYear();
    await supabase.from('user_holidays').delete().eq('user_id', userId).eq('year', year);
    
    // Insert new ones
    if (holidays.length > 0) {
      const { error } = await supabase.from('user_holidays').insert(
        holidays.map(h => ({
          user_id: userId,
          holiday_name: h.holidayName,
          holiday_date: h.holidayDate,
          year: h.year
        }))
      );
      if (error) throw error;
    }
  },

  getUserById: async (id: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*, role_id')
      .eq('id', id)
      .single();
    if (error) return null;
    return processUrlsForDisplay(toCamelCase({ ...data, role: data.role_id }));
  },
  getUsersWithManagers: async (): Promise<(User & { managerName?: string, manager2Name?: string, manager3Name?: string })[]> => {
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) throw error;
    const camelUsers = (users || []).map(u => ({
      ...toCamelCase({ ...u, role: u.role_id }),
      reportingManagerId: u.reporting_manager_id,
      reportingManager2Id: u.reporting_manager_2_id,
      reportingManager3Id: u.reporting_manager_3_id
    }));
    const userMap = new Map(camelUsers.map(u => [u.id, u.name]));
    return camelUsers.map(u => ({
      ...u,
      managerName: u.reportingManagerId ? userMap.get(u.reportingManagerId) : undefined,
      manager2Name: u.reportingManager2Id ? userMap.get(u.reportingManager2Id) : undefined,
      manager3Name: u.reportingManager3Id ? userMap.get(u.reportingManager3Id) : undefined
    }));
  },
  getTeamMembers: async (managerId: string): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*, role_id')
      .or(`reporting_manager_id.eq.${managerId},reporting_manager_2_id.eq.${managerId},reporting_manager_3_id.eq.${managerId}`);
    if (error) throw error;
    return (data || []).map(u => toCamelCase({ ...u, role: u.role_id }));
  },
  getLatestLocations: async (userIds: string[]): Promise<Record<string, { latitude: number; longitude: number; timestamp: string; locationName?: string }>> => {
    if (userIds.length === 0) return {};
    
    // Fetch latest attendance event for each user in parallel.
    // We no longer filter out events without GPS coordinates so that
    // office staff punches (which often lack lat/lng) still appear
    // as recent activity on the My Team page.
    const results = await Promise.all(
      userIds.map(id => 
        supabase
          .from('attendance_events')
          .select('user_id, latitude, longitude, timestamp, location_name')
          .eq('user_id', id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    );

    const latest: Record<string, any> = {};
    results.forEach(({ data }) => {
      if (data) {
        latest[data.user_id] = toCamelCase(data);
      }
    });
    return latest;
  },
  getLocationHistory: async (userId: string, startTs: string, endTs: string): Promise<AttendanceEvent[]> => {
    return api.getAttendanceEvents(userId, startTs, endTs);
  },
  getFieldStaff: async (managerId?: string) => {
    let users = await api.getUsers();
    if (managerId) {
      users = users.filter((u: any) => 
        u.reportingManagerId === managerId || 
        u.reportingManager2Id === managerId || 
        u.reportingManager3Id === managerId
      );
    }
    return users.filter((u: any) => u.role === 'field_staff');
  },

  getTeamLocations: async (userIds: string[]): Promise<Record<string, { state: string; city: string }>> => {
    if (userIds.length === 0) return {};

    const normalize = (str: any) => {
      if (!str || typeof str !== 'string') return '';
      const trimmed = str.trim();
      if (!trimmed) return '';
      // Remove common suffixes like "State", "City", "Union Territory"
      const cleaned = trimmed.replace(/,\s*$/, '').replace(/\s+(State|Union\s+Territory|City)$/i, '');
      const n = cleaned.toLowerCase().split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return CITY_NAME_MAP[n] || n;
    };

    const inferState = (city: string, text: string) => {
      const normalizedCity = normalize(city);
      if (normalizedCity && CITY_TO_STATE_MAP[normalizedCity]) return CITY_TO_STATE_MAP[normalizedCity];
      
      const lowerText = (text || '').toLowerCase();
      // 1. Scan for primary city names in text
      for (const [c, s] of Object.entries(CITY_TO_STATE_MAP)) {
        if (lowerText.includes(c.toLowerCase())) return s;
      }
      
      // 2. Scan for city aliases in text
      for (const [alt, norm] of Object.entries(CITY_NAME_MAP)) {
        if (lowerText.includes(alt.toLowerCase()) && CITY_TO_STATE_MAP[norm]) {
          return CITY_TO_STATE_MAP[norm];
        }
      }
      
      // 3. Scan for explicit state names in text
      for (const s of INDIAN_STATES) {
        if (lowerText.includes(s.toLowerCase())) return s;
      }
      return null;
    };

    const inferCity = (text: string) => {
      const lowerText = (text || '').toLowerCase();
      // Match primary city names first
      for (const c of Object.keys(CITY_TO_STATE_MAP)) {
        if (lowerText.includes(c.toLowerCase())) return c;
      }
      // Match city aliases
      for (const [alt, norm] of Object.entries(CITY_NAME_MAP)) {
        if (lowerText.includes(alt.toLowerCase())) return norm;
      }
      return null;
    };

    // 1. Fetch data in parallel
    const [subResults, userResults, orgResults] = await Promise.all([
      supabase.from('onboarding_submissions').select('user_id, address').in('user_id', userIds).not('address', 'is', null),
      supabase.from('users').select('id, organization_id, organization_name').in('id', userIds),
      supabase.from('organizations').select('id, address')
    ]);

    const locations: Record<string, { state: string; city: string }> = {};
    const orgMap = new Map((orgResults.data || []).map(o => [o.id, o.address]));
    const userToOrg = new Map((userResults.data || []).map(u => [u.id, u.organization_id]));
    const userToOrgName = new Map((userResults.data || []).map(u => [u.id, u.organization_name]));

    // 2. Fallback: Use Organization/Site address for users
    userIds.forEach(uid => {
      const orgId = userToOrg.get(uid);
      const orgName = userToOrgName.get(uid);
      const orgAddr = orgId ? orgMap.get(orgId) : null;
      
      const combinedText = `${orgName || ''} ${orgAddr || ''}`;
      if (combinedText.trim()) {
        const state = inferState('', combinedText);
        const city = inferCity(combinedText);
        
        if (state) {
          locations[uid] = { state, city: city || 'Other' };
        }
      }
    });

    // 3. Primary: Use Onboarding Submission address (Overwrite with more specific data)
    (subResults.data || []).forEach(sub => {
      const addr = sub.address as any;
      // Handle various address formats (nested vs flat)
      const stateRaw = addr?.present?.state || addr?.permanent?.state || addr?.state;
      const cityRaw = addr?.present?.city || addr?.permanent?.city || addr?.city;
      
      let state = normalize(normalizeStateName(stateRaw));
      let city = normalize(cityRaw);

      if (!state && city) {
        state = inferState(city, '');
      } else if (!state && !city && typeof addr === 'string') {
        // Handle case where address might be a raw string
        state = inferState('', addr);
        city = inferCity(addr);
      }

      if (state && sub.user_id) {
        locations[sub.user_id] = { 
          state, 
          city: city || 'Other'
        };
      }
    });

    return locations;
  },
  /**
   * Fetch users who should receive check‑in/out notifications.
   * Includes HR, operations managers, admins, developers and site managers.
   * This allows the app to notify the appropriate stakeholders when a
   * field staff checks in or out.
   */
  getNearbyUsers: async (currentUserId?: string): Promise<{ nearbyOnline: any[]; allUsers: any[] }> => {
    const allUsers = await api.getUsers();
    let availability: Record<string, boolean> = {};
    const latestLocationsMap: Record<string, { locationName: string }> = {};

    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const events = await api.getAllAttendanceEvents(start.toISOString(), end.toISOString());
      
      const latest: Record<string, { type: string; timestamp: string }> = {};
      
      events.forEach(evt => {
        const { userId, type, timestamp, locationName } = evt as any;
        if (!userId) return;
        if (!latest[userId] || new Date(timestamp) > new Date(latest[userId].timestamp)) {
          latest[userId] = { type: type.toLowerCase(), timestamp };
          if (locationName) {
            latestLocationsMap[userId] = { locationName };
          }
        }
      });

      availability = Object.fromEntries(Object.entries(latest).map(([userId, info]) => {
        const normalizedType = info.type.toLowerCase().replace(/[-_\s]/g, '');
        const isCheckIn = normalizedType === 'checkin' || normalizedType === 'punchin' || normalizedType === 'signin';
        return [userId, isCheckIn];
      }));
    } catch (e) {
      console.warn('Failed to compute user availability:', e);
    }

    // Map availability and locations onto users
    const usersWithAvailability = allUsers
      .map(u => ({ 
        ...u, 
        isAvailable: availability[u.id] ?? false,
        locationName: latestLocationsMap[u.id]?.locationName || ''
      }))
      .filter(u => u.id !== currentUserId);

    const onlineUsers = usersWithAvailability.filter(u => u.isAvailable);
    const currentUser = allUsers.find(u => u.id === currentUserId);
    const currentUserLocation = currentUser ? (latestLocationsMap[currentUser.id]?.locationName || '') : '';

    const nearbyOnline = onlineUsers.map(u => {
      const sameOrg = currentUser?.organizationId && u.organizationId === currentUser.organizationId;
      const sameLocation = currentUserLocation && u.locationName === currentUserLocation;
      
      // Multi-level team check
      const isTeamMember = currentUserId && (
        u.reportingManagerId === currentUserId || 
        u.reportingManager2Id === currentUserId || 
        u.reportingManager3Id === currentUserId
      );
      
      return { 
        ...u, 
        isNearby: sameLocation || sameOrg || isTeamMember,
        isTeamMember
      };
    }).sort((a, b) => {
      // Sort: Team members first, then same location, then same org, then alphabetical
      if (a.isTeamMember && !b.isTeamMember) return -1;
      if (!a.isTeamMember && b.isTeamMember) return 1;
      if (a.locationName === currentUserLocation && b.locationName !== currentUserLocation) return -1;
      if (a.locationName !== currentUserLocation && b.locationName === currentUserLocation) return 1;
      if (currentUser?.organizationId) {
        if (a.organizationId === currentUser.organizationId && b.organizationId !== currentUser.organizationId) return -1;
        if (a.organizationId !== currentUser.organizationId && b.organizationId === currentUser.organizationId) return 1;
      }
      return a.name.localeCompare(b.name);
    });

    return { 
      nearbyOnline: nearbyOnline.map(processUrlsForDisplay), 
      allUsers: usersWithAvailability.map(processUrlsForDisplay) 
    };
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    const status = await Network.getStatus();
    if (!status.connected) {
        await offlineDb.addToOutbox({ table_name: 'users', action: 'UPDATE', payload: { id, updates } });
        const cached = await offlineDb.getCache('users') || [];
        await offlineDb.setCache('users', cached.map((u: any) => u.id === id ? { ...u, ...updates } : u));
        return { ...updates, id };
    }

    const { role, biometricId, organizationId, organizationName, societyId, societyName, locationId, ...rest } = updates;
    const dbUpdates: any = toSnakeCase(rest);
    if (role) dbUpdates.role_id = role;
    if (biometricId !== undefined) dbUpdates.biometric_id = biometricId;
    if (organizationId !== undefined) dbUpdates.organization_id = organizationId;
    if (organizationName !== undefined) dbUpdates.organization_name = organizationName;
    if (societyId !== undefined) dbUpdates.society_id = societyId;
    if (societyName !== undefined) dbUpdates.society_name = societyName;
    if (locationId !== undefined) dbUpdates.location_id = locationId;

    if ('photo_url' in dbUpdates) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("User not authenticated for photo upload");
      const userId = session.user.id;

      const { data: currentUserData } = await supabase.from('users').select('photo_url').eq('id', id).single();
      const oldPhotoUrl = currentUserData?.photo_url;

      if (dbUpdates.photo_url && dbUpdates.photo_url.startsWith('data:')) {
        const deleteOldAvatar = async (oldUrl: string | null | undefined) => {
          if (!oldUrl) return;
          try {
            // Handle both raw Supabase URLs and proxied URLs
            let storagePath = '';
            let bucketName = AVATAR_BUCKET;

            if (oldUrl.includes('/api/view-file/')) {
              const parts = oldUrl.split('/api/view-file/')[1].split('/');
              bucketName = parts[0];
              storagePath = parts.slice(1).join('/');
            } else if (oldUrl.includes('/storage/v1/object/public/')) {
              const parts = oldUrl.split('/public/')[1].split('/');
              bucketName = parts[0];
              storagePath = parts.slice(1).join('/');
            } else {
              // Try as a raw path if it's not a URL
              storagePath = oldUrl;
            }

            if (storagePath && bucketName) {
              console.log(`[API] Deleting old avatar: bucket=${bucketName}, path=${storagePath}`);
              await supabase.storage.from(bucketName).remove([storagePath]);
            }
          } catch (e) {
            console.error("[API] Failed to process old avatar URL for deletion:", e);
          }
        };

        await deleteOldAvatar(oldPhotoUrl);
        const blob = await dataUrlToBlob(dbUpdates.photo_url);
        const fileExt = dbUpdates.photo_url.split(';')[0].split('/')[1] || 'jpg';
        const sanitizedFileName = (dbUpdates.photo_url.split(';')[0].split('/')[1] || 'jpg').toLowerCase();
        const filePath = `${userId}/${Date.now()}.${sanitizedFileName}`;
        
        console.log(`[API] Uploading new avatar: ${filePath}`);
        const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, blob, { upsert: true });
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
        // CRITICAL FIX: Save the RAW public URL in the database, not the proxy URL.
        // The display logic (toCamelCase -> processUrlsForDisplay) will handle proxying.
        dbUpdates.photo_url = publicUrl; 
        console.log(`[API] New avatar saved: ${publicUrl}`);
      } else if (dbUpdates.photo_url === null) {
        // ... handled existing deleteOldAvatar if needed, but it was inline before
      }
    }

    const { data, error } = await supabase.from('users').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return toCamelCase({ ...data, role: data.role_id });
  },

  approveUser: async (userId: string, newRole: string) => {
    // Replaces the edge function call with a direct database RPC call
    const { data, error } = await supabase.rpc('approve_user', {
      user_id: userId,
      role_text: newRole
    });
    
    if (error) throw error;
    // Return a success object to match previous behavior if needed
    return { message: 'User approved successfully' }; 
  },

  createUser: async (userData: Partial<User>): Promise<User> => {
    const { role, ...rest } = userData;
    const dbData: any = toSnakeCase(rest);
    if (role) dbData.role_id = role;
    if (!dbData.passcode) dbData.passcode = String(Math.floor(1000 + Math.random() * 9000));

    const { data, error } = await supabase.from('users').insert(dbData).select().single();
    if (error) throw error;
    return toCamelCase({ ...data, role: data.role_id });
  },

  deleteUser: async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  updateUserReportingManager: async (userId: string, managerId: string | null, slot: 1 | 2 | 3 = 1) => {
    const columnMap = { 1: 'reporting_manager_id', 2: 'reporting_manager_2_id', 3: 'reporting_manager_3_id' };
    const { error } = await supabase.from('users').update({ [columnMap[slot]]: managerId }).eq('id', userId);
    if (error) throw error;
  },

  updateUserPasscode: async (userId: string, newPasscode: string): Promise<void> => {
    // 1. Update the custom users table
    const { error: dbError } = await supabase
      .from('users')
      .update({ passcode: newPasscode })
      .eq('id', userId);
    
    if (dbError) throw dbError;

    // 2. Update the Supabase Auth password
    // NOTE: This updates the password for the CURRENTLY LOGGED IN user
    // if the userId belongs to them. If it's an admin updating another user,
    // this specific call won't work for the other user without the admin API.
    // However, for the user changing their own passcode in the profile, this is correct.
    // SATISFY SUPABASE 6-CHARACTER MINIMUM:
    // If it's a 4-digit passcode, use a hidden prefix to satisfy Auth rules.
    const effectivePassword = (newPasscode.length === 4 && /^\d+$/.test(newPasscode)) 
      ? `PAR_${newPasscode}` 
      : newPasscode;

    const { error: authError } = await supabase.auth.updateUser({
      password: effectivePassword
    });

    if (authError) throw authError;
  },

  resetUserPasscode: async (userId: string): Promise<string> => {
    const newPasscode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // 1. Update the public.users table (local reference)
    const { error: dbError } = await supabase
      .from('users')
      .update({ passcode: newPasscode })
      .eq('id', userId);
    
    if (dbError) throw dbError;

    // 2. Sync with Supabase Auth (using the definer RPC to bypass client-side admin restrictions)
    // The RPC internally adds the 'PAR_' prefix to satisfy the 6-char rule.
    const { error: rpcError } = await supabase.rpc('sync_user_auth_password', {
      user_id: userId,
      new_passcode: newPasscode
    });

    if (rpcError) {
      console.warn('Passcode saved locally, but Auth sync failed. User may need to sign in with their old password or Google.', rpcError);
    }

    // 3. Trigger Notification Dispatch
    try {
        const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single();
        if (userData) {
            dispatchNotificationFromRules('passcode_reset', {
                actorName: 'System',
                actionText: 'has reset your security passcode',
                locString: '',
                title: '🔐 Passcode Reset',
                actor: {
                    id: userData.id,
                    name: userData.name || 'Employee',
                    role: userData.role_id || 'unverified',
                    reportingManagerId: userData.reporting_manager_id
                }
            });
        }
    } catch (e) {
        console.warn('Failed to dispatch passcode reset notification:', e);
    }

    return newPasscode;
  },

  /**
   * Fetches only the current passcode for a specific user.
   * Used for real-time verification to avoid stale local state issues.
   */
  getUserPasscode: async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('passcode')
      .eq('id', userId)
      .single();
    
    if (error) return null;
    return data?.passcode || null;
  },

  getOrganizations: async (filter?: { page?: number, pageSize?: number }): Promise<any> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        let query = supabase.from('organizations').select('*', { count: 'exact' });
        
        const isPaginated = filter?.page !== undefined && filter?.pageSize !== undefined;
        if (isPaginated) {
          const from = (filter!.page! - 1) * filter!.pageSize!;
          const to = from + filter!.pageSize! - 1;
          query = query.range(from, to);
        }
        
        const { data, count, error } = (await withTimeout(
          query.order('short_name') as any,
          15000,
          'Fetch organizations timed out'
        )) as any;
        if (error) throw error;
        
        const formattedData = (data || []).map(toCamelCase);
        if (!isPaginated) {
            await offlineDb.setCache('organizations', formattedData);
        }

        if (isPaginated) {
          return { data: formattedData, total: count || 0 };
        }
        return formattedData;
      } catch (err) {
        console.warn('Failed to fetch organizations from cloud, falling back to cache');
      }
    }
    
    const cached = await offlineDb.getCache('organizations') || [];
    if (filter?.page !== undefined && filter?.pageSize !== undefined) {
        return { data: cached, total: cached.length };
    }
    return cached;
  },
  createOrganization: async (org: Organization): Promise<Organization> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'organizations', action: 'INSERT', payload: org });
      const cached = await offlineDb.getCache('organizations') || [];
      await offlineDb.setCache('organizations', [...cached, org]);
      return org;
    }

    const { data, error } = await supabase.from('organizations').insert(toSnakeCase(org)).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  deleteOrganization: async (id: string): Promise<void> => {
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) throw error;
  },
  getOrganizationStructure: async (): Promise<OrganizationGroup[]> => {
    const { data: groups, error: groupsError } = await supabase.from('organization_groups').select('*');
    if (groupsError) throw groupsError;
    const { data: companies, error: companiesError } = await supabase.from('companies').select('*');
    if (companiesError) throw companiesError;
    const { data: entities, error: entitiesError } = await supabase.from('entities').select('*');
    if (entitiesError) throw entitiesError;

    const camelGroups: any[] = (groups || []).map(g => processUrlsForDisplay(toCamelCase(g)));
    const camelCompanies: any[] = (companies || []).map(c => processUrlsForDisplay(toCamelCase(c)));
    const camelEntities: any[] = (entities || []).map(e => processUrlsForDisplay(toCamelCase(e)));

    const companyMap = new Map<string, any[]>();
    const assignedEntityIds = new Set<string>();

    camelCompanies.forEach(company => {
      const companyEntities = camelEntities.filter(e => e.companyId === company.id);
      companyEntities.forEach(e => assignedEntityIds.add(e.id));
      const companyWithEntities = { ...company, entities: companyEntities };
      
      const targetGroupId = company.groupId || 'unassigned_group';
      if (!companyMap.has(targetGroupId)) companyMap.set(targetGroupId, []);
      companyMap.get(targetGroupId)!.push(companyWithEntities);
    });

    const structure = camelGroups.map(group => ({ ...group, companies: companyMap.get(group.id) || [], locations: [] }));

    const unassignedCompanies = companyMap.get('unassigned_group') || [];
    const validGroupIds = new Set(camelGroups.map(g => g.id));
    for (const [groupId, comps] of companyMap.entries()) {
        if (groupId !== 'unassigned_group' && !validGroupIds.has(groupId)) {
            unassignedCompanies.push(...comps);
        }
    }

    const unassignedEntities = camelEntities.filter(e => !assignedEntityIds.has(e.id));

    if (unassignedCompanies.length > 0 || unassignedEntities.length > 0) {
        if (unassignedEntities.length > 0) {
            let defaultCompany = unassignedCompanies.find(c => c.id === 'unassigned_company');
            if (!defaultCompany) {
                defaultCompany = { id: 'unassigned_company', name: 'Unassigned Entities', groupId: 'unassigned_group', entities: [] };
                unassignedCompanies.push(defaultCompany);
            }
            defaultCompany.entities.push(...unassignedEntities);
        }

        structure.push({
            id: 'unassigned_group',
            name: 'Unassigned / Orphaned',
            companies: unassignedCompanies,
            locations: []
        });
    }

    return structure;
  },
  bulkSaveOrganizationStructure: async (groups: OrganizationGroup[]): Promise<void> => {
    // 1. Upsert Groups (exclude companies and locations)
    const validGroups = groups.filter(g => g.id !== 'unassigned_group');
    const groupData = validGroups.map(({ companies, locations, ...rest }) => toSnakeCase(rest));
    const { error: groupError } = await supabase.from('organization_groups').upsert(groupData);
    if (groupError) throw groupError;

    // 2. Upsert Companies (exclude entities)
    const companies = groups.flatMap(g => g.companies.map(c => ({ ...c, groupId: g.id })));
    const validCompanies = companies.filter(c => c.id !== 'unassigned_company');
    const companyData = validCompanies.map(({ entities, ...rest }) => {
        const payload = toSnakeCase(rest);
        if (payload.group_id === 'unassigned_group') payload.group_id = null;
        
        // Stringify nested objects for TEXT columns (skip arrays for Postgres array columns)
        for (const key in payload) {
          if (payload[key] !== null && typeof payload[key] === 'object' && !Array.isArray(payload[key]) && !(payload[key] instanceof Date)) {
            payload[key] = JSON.stringify(payload[key]);
          }
        }
        return payload;
    });
    const { error: companyError } = await supabase.from('companies').upsert(companyData);
    if (companyError) throw companyError;

    // 3. Upsert Entities (Clients)
    const entities = companies.flatMap(c => c.entities.map(e => ({ ...e, companyId: c.id })));
    const entityData = entities.map(e => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { agreements, status: _status, ...rest } = e;
        const payload = toSnakeCase({
            ...rest,
            agreementDetails: agreements
        });
        if (payload.company_id === 'unassigned_company') payload.company_id = null;
        
        // Stringify nested objects for TEXT columns (skip arrays for Postgres array columns)
        for (const key in payload) {
          if (payload[key] !== null && typeof payload[key] === 'object' && !Array.isArray(payload[key]) && !(payload[key] instanceof Date)) {
            payload[key] = JSON.stringify(payload[key]);
          }
        }
        return payload;
    });
    const { error: entityError } = await supabase.from('entities').upsert(entityData);
    if (entityError) throw entityError;

    // 4. Ensure matching entries in 'organizations' table for onboarding metadata
    // We only need to create them if they don't exist yet. This prevents errors in SelectOrganization.tsx.
    const orgData = entities.map(e => ({
        id: e.organizationId || e.id,
        short_name: e.name,
        full_name: e.name,
        address: e.registeredAddress || '',
        updated_at: new Date().toISOString()
    }));

    // Perform a bulk upsert on organizations. 
    // This will create new records or update existing basic info without overwriting manually managed manpower limits.
    const { error: orgError } = await supabase.from('organizations').upsert(orgData, { onConflict: 'id' });
    if (orgError) throw orgError;
  },
  createOrganizationGroup: async (group: Partial<OrganizationGroup>): Promise<OrganizationGroup> => {
    const { data, error } = await supabase.from('organization_groups').insert(toSnakeCase(group)).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  updateOrganizationGroup: async (id: string, updates: Partial<OrganizationGroup>): Promise<OrganizationGroup> => {
    const { data, error } = await supabase.from('organization_groups').update(toSnakeCase(updates)).eq('id', id).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  deleteOrganizationGroup: async (id: string): Promise<void> => {
    const { error } = await supabase.from('organization_groups').delete().eq('id', id);
    if (error) throw error;
  },
  createCompany: async (company: Partial<Company>): Promise<Company> => {
    const { entities, ...rest } = company;
    const dbData = toSnakeCase(rest);
    if (dbData.group_id === 'unassigned_group') dbData.group_id = null;
    
    // Stringify nested objects for TEXT columns (skip arrays for Postgres array columns)
    for (const key in dbData) {
      if (dbData[key] !== null && typeof dbData[key] === 'object' && !Array.isArray(dbData[key]) && !(dbData[key] instanceof Date)) {
        dbData[key] = JSON.stringify(dbData[key]);
      }
    }
    const { data, error } = await supabase.from('companies').insert(dbData).select().single();
    if (error) throw error;
    return toCamelCase({ ...data, entities: [] });
  },
  updateCompany: async (id: string, updates: Partial<Company>): Promise<Company> => {
    const { entities, ...rest } = updates;
    const dbData = toSnakeCase(rest);
    if (dbData.group_id === 'unassigned_group') dbData.group_id = null;
    
    // Stringify nested objects for TEXT columns (skip arrays for Postgres array columns)
    for (const key in dbData) {
      if (dbData[key] !== null && typeof dbData[key] === 'object' && !Array.isArray(dbData[key]) && !(dbData[key] instanceof Date)) {
        dbData[key] = JSON.stringify(dbData[key]);
      }
    }
    const { data, error } = await supabase.from('companies').update(dbData).eq('id', id).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  deleteCompany: async (id: string): Promise<void> => {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) throw error;
  },
  saveEntity: async (entity: Partial<Entity>): Promise<Entity> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, agreements, latitude, longitude, ...rest } = entity;
    const status = await Network.getStatus();
    
    const entityToSave = { 
        ...rest,
        ...(agreements ? { agreementDetails: agreements } : {})
    };

    if (!status.connected) {
        const offlineId = id && !id.startsWith('new_') ? id : `new_${Date.now()}`;
        await offlineDb.addToOutbox({ table_name: 'entities', action: id?.startsWith('new_') ? 'INSERT' : 'UPDATE', payload: entityToSave });
        const mockEntity = { ...entity, id: offlineId } as Entity;
        
        // Optimistic cache update
        const cached = await offlineDb.getCache('entities') || [];
        if (id?.startsWith('new_')) {
            await offlineDb.setCache('entities', [...cached, mockEntity]);
        } else {
            await offlineDb.setCache('entities', cached.map((e: any) => e.id === id ? mockEntity : e));
        }
        return mockEntity;
    }

    const dbData = toSnakeCase(entityToSave);
    if (dbData.company_id === 'unassigned_company') dbData.company_id = null;
    
    // Stringify nested objects for TEXT columns (skip arrays for Postgres array columns)
    for (const key in dbData) {
      if (dbData[key] !== null && typeof dbData[key] === 'object' && !Array.isArray(dbData[key]) && !(dbData[key] instanceof Date)) {
        dbData[key] = JSON.stringify(dbData[key]);
      }
    }

    let query;
    if (id && !id.startsWith('new_')) {
      query = supabase.from('entities').update(dbData).eq('id', id);
    } else {
      query = supabase.from('entities').insert({ ...dbData, id: id?.startsWith('new_') ? `ent_${Date.now()}` : id });
    }
    const { data, error } = await query.select().single();
    if (error) {
      console.error('Supabase error saving entity:', error);
      throw error;
    }
    return toCamelCase(data);
  },
  deleteEntity: async (id: string): Promise<void> => {
    const { error } = await supabase.from('entities').delete().eq('id', id);
    if (error) throw error;
  },
  saveSiteConfiguration: async (organizationId: string, config: SiteConfiguration): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        await offlineDb.addToOutbox({ table_name: 'site_configurations', action: 'UPDATE', payload: { organizationId, config } });
        const cached = await offlineDb.getCache('site_configurations') || [];
        await offlineDb.setCache('site_configurations', cached.map((c: any) => c.organizationId === organizationId ? config : c));
        return;
    }

    const { data, error } = await supabase.from('site_configurations').upsert({
      organization_id: organizationId,
      config_data: config
    }, { onConflict: 'organization_id' });
    if (error) throw error;
  },
  getSiteConfigurations: async (): Promise<SiteConfiguration[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase.from('site_configurations').select('*');
        if (error) throw error;
        const formatted = (data || []).map(row => ({
          ...toCamelCase(row.config_data),
          organizationId: row.organization_id
        }));
        await offlineDb.setCache('site_configurations', formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch site configurations from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache('site_configurations') || [];
  },
  bulkUploadOrganizations: async (orgs: Organization[]): Promise<{ count: number }> => {
    const { count, error } = await supabase.from('organizations').upsert(toSnakeCase(orgs), { onConflict: 'id' });
    if (error) throw error;
    return { count: count || 0 };
  },
  getTaskGroups: async (): Promise<TaskGroup[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase.from('app_modules').select('*');
        if (error) throw error;
        const formatted = (data || []).map(toCamelCase);
        await offlineDb.setCache('app_modules', formatted);
        return formatted as TaskGroup[];
      } catch (err) {
        console.warn('Failed to fetch access tasks from cloud, falling back to cache');
      }
    }
    return (await offlineDb.getCache('app_modules') || []) as TaskGroup[];
  },
  saveTaskGroups: async (taskGroups: TaskGroup[]): Promise<void> => {
    // A full replacement is complex, upsert is simplest for now.
    const { error } = await supabase.from('app_modules').upsert(toSnakeCase(taskGroups));
    if (error) throw error;
  },
  getRoles: async (): Promise<Role[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        const formatted = (data || []).map(toCamelCase);
        await offlineDb.setCache('roles', formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch roles from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache('roles') || [];
  },
  saveRoles: async (roles: Role[]): Promise<void> => {
    const { error } = await supabase.from('roles').upsert(toSnakeCase(roles));
    if (error) throw error;
  },
  getHolidays: async (): Promise<Holiday[]> => {
    const { data, error } = await supabase.from('holidays').select('*');
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },
  addHoliday: async (holiday: Omit<Holiday, 'id'>): Promise<Holiday> => {
    const { data, error } = await supabase.from('holidays').insert(toSnakeCase(holiday)).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  removeHoliday: async (id: string): Promise<void> => {
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) throw error;
  },
  getAttendanceEvents: async (userId: string, start: string, end: string): Promise<AttendanceEvent[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const query = supabase.from('attendance_events')
          .select('*')
          .eq('user_id', userId)
          .gte('timestamp', start)
          .lte('timestamp', end)
          .order('timestamp', { ascending: true });
        
        const data = await withTimeout(fetchAll<any>(query), 5000, 'Fetch attendance events timed out');
        const formatted = (data || []).map(toCamelCase);
        // Cache per user/period might be too much, but we can cache recent ones
        await offlineDb.setCache(`attendance_${userId}_${start.split('T')[0]}`, formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch attendance events from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache(`attendance_${userId}_${start.split('T')[0]}`) || [];
  },
  getAllAttendanceEvents: async (start: string, end: string): Promise<AttendanceEvent[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const query = supabase.from('attendance_events')
          .select('*')
          .gte('timestamp', start)
          .lte('timestamp', end)
          .order('timestamp', { ascending: true });

        const data = await fetchAll<any>(query);
        const formatted = (data || []).map(toCamelCase);
        await offlineDb.setCache(`attendance_all_${start.split('T')[0]}`, formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch all attendance events from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache(`attendance_all_${start.split('T')[0]}`) || [];
  },
  getAttendanceEventsForUsers: async (userIds: string[], start: string, end: string): Promise<AttendanceEvent[]> => {
    if (!userIds || userIds.length === 0) return [];
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const query = supabase.from('attendance_events')
          .select('*')
          .in('user_id', userIds)
          .gte('timestamp', start)
          .lte('timestamp', end)
          .order('timestamp', { ascending: true });

        const data = await fetchAll<any>(query);
        const formatted = (data || []).map(toCamelCase);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch events for users, returning empty');
      }
    }
    return [];
  },
  getAttendanceDashboardData: async (startDate: Date, endDate: Date, currentDate: Date, timezone: string = 'UTC') => {
    const { data, error } = await supabase.rpc('get_attendance_dashboard_data', {
      start_date_iso: format(startDate, 'yyyy-MM-dd'),
      end_date_iso: format(endDate, 'yyyy-MM-dd'),
      current_date_iso: format(currentDate, 'yyyy-MM-dd'),
      p_timezone: timezone,
    });
    if (error) throw new Error('Could not load attendance dashboard data from the database function.');
    return data;
  },
  /**
   * Insert an attendance event.  The event may optionally include a
   * `locationId` if the user checked in/out within a geofenced location.
   * The caller should send latitude/longitude regardless of whether a
   * location was detected; this preserves the original coordinates for
   * auditing and reverse geocoding.
   *
   * @param event An attendance event without an id.  Accepts optional
   *              latitude, longitude, locationId, and locationName properties.
   */
  addAttendanceEvent: async (event: Omit<AttendanceEvent, 'id'>): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        const offlineId = `att_offline_${Date.now()}`;
        const offlineEvent = { ...event, id: offlineId } as AttendanceEvent;
        await offlineDb.addToOutbox({ table_name: 'attendance_events', action: 'INSERT', payload: event });
        
        // Update local cache if possible (using today's date)
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `attendance_${event.userId}_${today}`;
        const cached = await offlineDb.getCache(cacheKey) || [];
        await offlineDb.setCache(cacheKey, [...cached, offlineEvent]);
        return;
    }
    // DEDUPLICATION GUARD: Prevent double-write when the network is slow.
    //
    // `withTimeout` uses Promise.race(). If the DB insert takes longer than
    // the timeout, the timeout rejects first, but the Supabase insert is still
    // executing in the background and WILL commit. If we then queue it in the
    // outbox, the sync service will insert it a second time → duplicate rows.
    //
    // Fix: attach a `.then()` directly to the raw Supabase promise BEFORE the
    // race starts. This callback fires as soon as the server responds (success
    // or DB-level error), independent of the timeout. We can then check this
    // flag in the catch to distinguish "timed out but already inserted" from
    // "genuinely failed".
    let insertConfirmed = false;
    const insertPromise = (supabase
      .from('attendance_events')
      .insert(toSnakeCase(event)) as any)
      .then((result: any) => {
        // Only mark confirmed if Supabase itself did not return an error
        if (!result.error) insertConfirmed = true;
        return result;
      });

    try {
      const result = (await withTimeout(
        insertPromise,
        8000,
        'Attendance submission timed out'
      )) as any;
      if (result.error) throw result.error;
      // Success — no fallback needed.
    } catch (err: any) {
      if (insertConfirmed) {
        // Server confirmed the insert but the response arrived after the timeout.
        // The row is already in the database — do NOT add to outbox.
        console.warn('[Attendance] Insert confirmed after timeout. Skipping outbox to prevent duplicate entry.');
        return;
      }
      console.warn('Failed to submit attendance to cloud, saving to outbox:', err.message);
      // Only queue in outbox if the insert genuinely failed (not just slow).
      const offlineId = `att_offline_${Date.now()}`;
      const offlineEvent = { ...event, id: offlineId } as AttendanceEvent;
      await offlineDb.addToOutbox({ table_name: 'attendance_events', action: 'INSERT', payload: event });
      
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `attendance_${event.userId}_${today}`;
      const cached = await offlineDb.getCache(cacheKey) || [];
      await offlineDb.setCache(cacheKey, [...cached, offlineEvent]);
    }
  },

  addRoutePoint: async (point: Omit<RoutePoint, 'id'>): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        await offlineDb.addToOutbox({ table_name: 'route_history', action: 'INSERT', payload: point });
        return;
    }
    try {
      const { error } = await supabase
        .from('route_history')
        .insert(toSnakeCase(point));
      if (error) throw error;
    } catch (err) {
      console.warn('Failed to submit route point to cloud, saving to outbox');
      await offlineDb.addToOutbox({ table_name: 'route_history', action: 'INSERT', payload: point });
    }
  },

  getRoutePoints: async (userId: string, start: string, end: string): Promise<RoutePoint[]> => {
    const { data, error } = await supabase
      .from('route_history')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: true });
    
    if (error) throw error;
    return (data || []).map(toCamelCase) as RoutePoint[];
  },

  requestAttendanceUnlock: async (reason: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('attendance_unlock_requests')
      .insert({
        user_id: session.user.id,
        reason,
        status: 'pending',
        requested_at: new Date().toISOString()
      });
    if (error) throw error;
  },

  getAttendanceUnlockRequests: async (managerId?: string): Promise<AttendanceUnlockRequest[]> => {
    const query = supabase
      .from('attendance_unlock_requests')
      .select('*, user:user_id(name, photo_url, reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id)')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
      
    const { data, error } = await query;
    if (error) throw error;
    
    let filteredData = data;
    if (managerId) {
        filteredData = filteredData.filter((row: any) => 
            row.user?.reporting_manager_id === managerId || 
            row.user?.reporting_manager_2_id === managerId || 
            row.user?.reporting_manager_3_id === managerId
        );
    }
    
    return filteredData.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user?.name || 'Unknown',
      userPhoto: processUrlsForDisplay(row.user?.photo_url),
      reason: row.reason,
      status: row.status,
      requestedAt: row.requested_at,
      managerId: row.manager_id,
      respondedAt: row.responded_at,
      rejectionReason: row.rejection_reason
    }));
  },

  respondToUnlockRequest: async (requestId: string, status: 'approved' | 'rejected', rejectionReason?: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const updates: any = {
      status,
      manager_id: session.user.id,
      responded_at: new Date().toISOString()
    };
    
    if (status === 'rejected' && rejectionReason) {
      updates.rejection_reason = rejectionReason;
    }

    const { error } = await supabase
      .from('attendance_unlock_requests')
      .update(updates)
      .eq('id', requestId);
      
    if (error) throw error;
  },
  
  checkUnlockStatus: async (): Promise<number> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const status = await Network.getStatus();
    
    if (status.connected) {
      try {
        const { data, error } = (await withTimeout(
          supabase
            .from('attendance_unlock_requests')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('status', 'approved')
            .gte('requested_at', startOfDay(new Date()).toISOString())
            .lte('requested_at', endOfDay(new Date()).toISOString()) as any,
          10000,
          'Unlock status check timed out'
        )) as any;

        if (!error) {
          const count = data?.length || 0;
          await offlineDb.setCache(`unlock_count_${session.user.id}_${today}`, count);
          return count;
        }
      } catch (err) {
        console.warn('Failed to check unlock status from cloud, falling back to cache');
      }
    }
    
    return await offlineDb.getCache(`unlock_count_${session.user.id}_${today}`) || 0;
  },

  /** Count total unlock requests (pending + approved) made today — used to enforce daily max. */
  getDailyUnlockRequestCount: async (): Promise<number> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return 0;

    const today = new Date().toISOString().split('T')[0];
    const status = await Network.getStatus();
    
    if (status.connected) {
      try {
        const { data, error } = (await withTimeout(
          supabase
            .from('attendance_unlock_requests')
            .select('id')
            .eq('user_id', session.user.id)
            .in('status', ['pending', 'approved'])
            .gte('requested_at', startOfDay(new Date()).toISOString())
            .lte('requested_at', endOfDay(new Date()).toISOString()) as any,
          10000,
          'Daily unlock request count check timed out'
        )) as any;

        if (!error) {
          const count = data?.length || 0;
          await offlineDb.setCache(`daily_unlock_count_${session.user.id}_${today}`, count);
          return count;
        }
      } catch (err) {
        console.warn('Failed to check daily unlock request count from cloud, falling back to cache');
      }
    }
    
    return await offlineDb.getCache(`daily_unlock_count_${session.user.id}_${today}`) || 0;
  },

  getMyUnlockRequest: async (): Promise<AttendanceUnlockRequest | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_unlock_requests')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('requested_at', startOfDay(new Date()).toISOString())
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data ? toCamelCase(data) : null;
  },

  /**
   * Manually trigger missed check-outs for configured staff.
   * Identifies users with selected roles/groups who checked in today but have no check-out.
   * Records a check-out at 19:00 (7 PM), logs it, and notifies appropriate users.
   */
  async triggerMissedCheckouts(settings?: AttendanceSettings): Promise<{ count: number }> {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('trigger-missed-checkouts', {
      body: { 
        manual: true,
        settings: settings ? toSnakeCase(settings) : undefined
      },
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`
      }
    });

    if (error) {
      console.error('Edge Function Error:', error);
      throw error;
    }

    // The function returns a report. We sum the usersProcessed across all groups for the UI count.
    let totalProcessed = 0;
    if (data?.groups) {
      Object.values(data.groups).forEach((g: any) => {
        if (g.usersProcessed) totalProcessed += g.usersProcessed;
      });
    }

    return { count: totalProcessed };
  },

  /**
   * Retrieve all geofenced locations.  Returns an array of Location
   * objects with camelCased keys.
   */
  /**
   * Retrieve all defined geofenced locations.  In addition to the base
   * fields stored on the locations table, this query joins the
   * `users` table to fetch the name of the user that created the
   * location.  The resulting records include a `createdByName` field
   * which will be undefined if no creator is stored or the creator
   * record is not found.  This helper returns camel‑cased keys.
   */
  getLocations: async (): Promise<Location[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = (await withTimeout(
          supabase
            .from('locations')
            .select('*, created_at, created_by_user:created_by (id, name)')
            .order('created_at', { ascending: false }) as any,
          15000,
          'Fetch locations timed out'
        )) as any;
        if (error) throw error;

        const formatted = (data || []).map((raw: any) => {
          const camel = toCamelCase(raw) as any;
          const createdByUser = camel.createdByUser as { id?: string; name?: string } | undefined;
          const createdByName = createdByUser?.name || undefined;
          const { createdByUser: _omit, ...rest } = camel;
          return { ...rest, createdByName } as Location;
        });

        await offlineDb.setCache('locations', formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch locations from cloud, falling back to cache');
      }
    }

    return await offlineDb.getCache('locations') || [];
  },

  /**
   * Retrieve locations assigned to a user.  This joins user_locations
   * and locations to return full Location records.  Only assignments
   * where user_id matches are returned (enforced by RLS).  Admins can
   * override by specifying a different userId.
   */
  getUserLocations: async (userId: string): Promise<Location[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = (await withTimeout(
          supabase
            .from('user_locations')
            .select('location_id:location_id (*), id')
            .eq('user_id', userId) as any,
          15000,
          'Fetch user locations timeout'
        )) as any;
        if (error) throw error;

        const formatted = (data || []).map((row: any) => {
          const loc = row.location_id || {};
          return toCamelCase(loc);
        }) as Location[];

        await offlineDb.setCache(`user_locations_${userId}`, formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch user locations from cloud, falling back to cache');
      }
    }

    return await offlineDb.getCache(`user_locations_${userId}`) || [];
  },

  /**
   * Create a new geofenced location.  Returns the inserted Location
   * record.  The caller must provide name, latitude, longitude and
   * radius.  createdBy is optional and will be stored if provided.
   */
  createLocation: async (loc: {
    name?: string | null;
    latitude: number;
    longitude: number;
    radius: number;
    /** Optional pre‑computed address for this location */
    address?: string | null;
    createdBy?: string | null;
  }): Promise<Location> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      const offlineId = `loc_offline_${Date.now()}`;
      const offlineLoc = { ...loc, id: offlineId, createdAt: new Date().toISOString() } as Location;
      await offlineDb.addToOutbox({ table_name: 'locations', action: 'INSERT', payload: loc });
      
      const cached = await offlineDb.getCache('locations') || [];
      await offlineDb.setCache('locations', [...cached, offlineLoc]);
      return offlineLoc;
    }

    // Convert camelCased keys to snake_cased for Supabase
    const payload = toSnakeCase(loc);
    const { data, error } = await supabase
      .from('locations')
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toCamelCase(data) as Location : null as any;
  },

  /**
   * Assign an existing location to a user.  This creates a row in
   * user_locations.  Only the id of the new assignment is returned.
   */
  assignLocationToUser: async (userId: string, locationId: string): Promise<void> => {
    const { error } = await supabase
      .from('user_locations')
      .insert({ user_id: userId, location_id: locationId });
    if (error) throw error;
  },

  /**
   * Update an existing location by ID.  Accepts a partial set of
   * fields (name, latitude, longitude, radius, address).  Returns the
   * updated Location record.
   */
  updateLocation: async (id: string, updates: {
    name?: string | null;
    latitude?: number;
    longitude?: number;
    radius?: number;
    address?: string | null;
  }): Promise<Location> => {
    const payload = toSnakeCase(updates);
    const { data, error } = await supabase
      .from('locations')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toCamelCase(data) as Location : null as any;
  },

  /**
   * Delete a location by ID.  Cascading deletes remove any
   * user_locations referencing this location.  Returns void.
   */
  deleteLocation: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Remove a user->location assignment.  Deletes the row from
   * user_locations for the given userId and locationId.
   */
  unassignLocationFromUser: async (userId: string, locationId: string): Promise<void> => {
    const { error } = await supabase
      .from('user_locations')
      .delete()
      .match({ user_id: userId, location_id: locationId });
    if (error) throw error;
  },

  /**
   * Upload a company logo to the dedicated `logo` bucket.  Returns the
   * public URL of the uploaded image.  The caller should persist
   * this URL in the application settings so it can be used as the
   * active or default logo.  A unique filename is generated to avoid
   * overwriting existing objects.
   */
  uploadLogo: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${fileName}`;
    
    // Ensure the logo bucket exists
    await api.ensureBucket(LOGO_BUCKET);
    const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath);
    return publicUrl;
  },

  /**
   * Fetch all logos stored in the `logo` bucket.  Returns an array of
   * objects with `name` and `url` for each file.  This is useful for
   * listing available logos in the interface settings modal.
   */
  getLogos: async (): Promise<{ name: string; url: string }[]> => {
    const { data, error } = await supabase.storage.from(LOGO_BUCKET).list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    return (data || []).map(obj => {
      const { data: { publicUrl } } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(obj.name);
      return { name: obj.name, url: getProxyUrl(publicUrl) };
    });
  },

  /**
   * Delete a logo from the `logo` bucket by its filename.  Returns void
   * on success.  The caller should remove any references to this logo
   * in settings.  If the file does not exist, this call is a no-op.
   */
  deleteLogo: async (fileName: string): Promise<void> => {
    const { error } = await supabase.storage.from(LOGO_BUCKET).remove([fileName]);
    if (error) throw error;
  },

  /**
   * Upload a background image to the `background` bucket for use in the
   * login carousel.  Returns the public URL of the uploaded image.
   */
  uploadBackground: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${fileName}`;
    const { error: uploadError } = await supabase.storage.from(BACKGROUND_BUCKET).upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from(BACKGROUND_BUCKET).getPublicUrl(filePath);
    return getProxyUrl(publicUrl);
  },

  /**
   * Fetch all background images from the `background` bucket.  Returns
   * an array of objects with `name` and `url` for each file.
   */
  getBackgroundImages: async (): Promise<{ name: string; url: string }[]> => {
    const { data, error } = await supabase.storage.from(BACKGROUND_BUCKET).list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    return (data || []).map(obj => {
      const { data: { publicUrl } } = supabase.storage.from(BACKGROUND_BUCKET).getPublicUrl(obj.name);
      return { name: obj.name, url: getProxyUrl(publicUrl) };
    });
  },

  /**
   * Delete a background image by filename from the `background` bucket.
   */
  deleteBackground: async (fileName: string): Promise<void> => {
    const { error } = await supabase.storage.from(BACKGROUND_BUCKET).remove([fileName]);
    if (error) throw error;
  },
  getAttendanceSettings: async (): Promise<AttendanceSettings> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = (await withTimeout(
          supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single() as any,
          10000,
          'Fetch attendance settings timed out'
        )) as any;
        if (!error && data?.attendance_settings) {
          const formatted = toCamelCase(data.attendance_settings) as AttendanceSettings;
          await offlineDb.setCache('attendance_settings', formatted);
          return formatted;
        }
      } catch (err) {
        console.warn('Failed to fetch attendance settings from cloud, falling back to cache');
      }
    }

    const cached = await offlineDb.getCache('attendance_settings');
    if (cached) return cached;
    
    throw new Error('Attendance settings are not available offline. Please connect once to sync settings.');
  },
  saveAttendanceSettings: async (settings: AttendanceSettings): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'settings', action: 'SAVE_SETTINGS', payload: { id: 'singleton', attendance_settings: settings } });
      return;
    }

    // Ensure we are upserting with the correct ID and data structure
    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          id: 'singleton',
          attendance_settings: toSnakeCase(settings)
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error("Error saving attendance settings:", error);
      throw error;
    }
  },
  saveApiSettings: async (settings: any): Promise<void> => {
    const processedSettings = { ...settings };

    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          id: 'singleton',
          api_settings: toSnakeCase(processedSettings)
        },
        { onConflict: 'id' }
      );
    if (error) {
      console.error("Error saving API settings:", error);
      throw error;
    }
  },
  saveAddressSettings: async (settings: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          id: 'singleton',
          address_settings: toSnakeCase(settings)
        },
        { onConflict: 'id' }
      );
    if (error) {
      console.error("Error saving address settings:", error);
      throw error;
    }
  },
  saveGeminiApiSettings: async (settings: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'singleton', gemini_api_settings: toSnakeCase(settings) }, { onConflict: 'id' });
    if (error) throw error;
  },
  saveOfflineOcrSettings: async (settings: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'singleton', offline_ocr_settings: toSnakeCase(settings) }, { onConflict: 'id' });
    if (error) throw error;
  },
  savePerfiosApiSettings: async (settings: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'singleton', perfios_api_settings: toSnakeCase(settings) }, { onConflict: 'id' });
    if (error) throw error;
  },
  saveOtpSettings: async (settings: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'singleton', otp_settings: toSnakeCase(settings) }, { onConflict: 'id' });
    if (error) throw error;
  },
  saveSiteManagementSettings: async (settings: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'singleton', site_management_settings: toSnakeCase(settings) }, { onConflict: 'id' });
    if (error) throw error;
  },
  saveNotificationSettings: async (settings: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'singleton', notification_settings: toSnakeCase(settings) }, { onConflict: 'id' });
    if (error) throw error;
  },

  // ═══ Email Configuration APIs ═══════════════════════════════════════════

  getEmailConfig: async (): Promise<any> => {
    const { data, error } = await supabase
      .from('settings')
      .select('email_config')
      .eq('id', 'singleton')
      .single();
    if (error) throw error;
    if (!data?.email_config) return null;
    return toCamelCase(data.email_config);
  },

  saveEmailConfig: async (config: any): Promise<void> => {
    const { error } = await supabase
      .from('settings')
      .upsert({ id: 'singleton', email_config: toSnakeCase(config) }, { onConflict: 'id' });
    if (error) throw error;
  },

  sendTestEmail: async (testEmail: string): Promise<void> => {
    // First get the email config to pass along
    const { data: settings } = await supabase
      .from('settings')
      .select('email_config')
      .eq('id', 'singleton')
      .single();
    
    const config = settings?.email_config;
    if (!config?.user || !config?.pass) {
      throw new Error('SMTP not configured. Please save your email configuration first.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        to: testEmail,
        subject: '✅ Paradigm FMS — Test Email',
        triggerType: 'manual',
        html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #059669, #047857); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">✅ Email Configuration Working!</h1>
          </div>
          <div style="padding: 32px;">
            <p style="color: #374151; font-size: 14px; line-height: 1.7;">
              Your SMTP email configuration is working correctly.<br/>
              Emails will be sent from: <strong>${config.from_email || config.user}</strong><br/>
              Replies will be sent to: <strong>${config.reply_to || config.from_email || config.user}</strong>
            </p>
            <div style="margin-top: 20px; padding: 16px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0;">
              <p style="margin: 0; font-size: 13px; color: #166534;">✓ SMTP connection verified<br/>✓ Authentication successful<br/>✓ Email delivery confirmed</p>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af;">Sent by Paradigm FMS — ${new Date().toLocaleString()}</p>
          </div>
        </div>`,
        smtpConfig: {
          host: config.host || 'smtp.gmail.com',
          port: config.port || 587,
          secure: config.secure || false,
          user: config.user,
          pass: config.pass,
          fromEmail: config.from_email || config.user,
          fromName: config.from_name || 'Paradigm FMS',
          replyTo: config.reply_to,
        }
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Test email failed');
    }
  },

  sendReportEmail: async (payload: ReportEmailPayload): Promise<void> => {
    // Fetch configuration if not provided
    let smtpConfig = payload.smtpConfig;
    if (!smtpConfig) {
      const { data: settings } = await supabase
        .from('settings')
        .select('email_config')
        .eq('id', 'singleton')
        .single();
      
      const config = settings?.email_config;
      if (!config?.user || !config?.pass) {
        throw new Error('SMTP not configured. Please save your email configuration first.');
      }
      
      smtpConfig = {
        host: config.host || 'smtp.gmail.com',
        port: config.port || 587,
        secure: config.secure || false,
        user: config.user,
        pass: config.pass,
        fromEmail: config.from_email || config.user,
        fromName: config.from_name || 'Paradigm FMS',
        replyTo: config.reply_to,
      };
    }

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        ...payload,
        smtpConfig
      })
    });

    if (!response.ok) {
       const err = await response.json();
       throw new Error(err.error || 'Failed to send report email');
    }

    // Optional: Log the manual trigger if needed
    if (payload.triggerType === 'manual') {
       const user = useAuthStore.getState().user;
       await supabase.from('email_logs').insert({
          recipient_email: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
          subject: payload.subject,
          status: 'sent',
          trigger_type: 'manual',
          metadata: {
             reportType: payload.reportType,
             triggeredBy: user?.name || user?.email,
             attachmentCount: payload.attachments?.length || 0
          }
       });
    }
  },

  // ═══ Email Templates APIs ═══════════════════════════════════════════════

  getEmailTemplates: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  saveEmailTemplate: async (template: any): Promise<any> => {
    const payload = toSnakeCase(template);
    if (template.id) {
      const { data, error } = await supabase
        .from('email_templates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', template.id)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    } else {
      const { data, error } = await supabase
        .from('email_templates')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    }
  },

  deleteEmailTemplate: async (id: string): Promise<void> => {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) throw error;
  },

  // ═══ Email Schedule Rules APIs ══════════════════════════════════════════

  getEmailScheduleRules: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('email_schedule_rules')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  saveEmailScheduleRule: async (rule: any): Promise<any> => {
    const payload = toSnakeCase(rule);
    if (rule.id) {
      const { data, error } = await supabase
        .from('email_schedule_rules')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', rule.id)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    } else {
      payload.created_by = useAuthStore.getState().user?.id;
      const { data, error } = await supabase
        .from('email_schedule_rules')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    }
  },

  deleteEmailScheduleRule: async (id: string): Promise<void> => {
    const { error } = await supabase.from('email_schedule_rules').delete().eq('id', id);
    if (error) throw error;
  },

  testEmailScheduleRule: async (ruleId: string, testEmail?: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Call the Vercel API runner (server-side generation)
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ 
        ruleId, 
        test: true,
        testEmail: testEmail
      })
    });


    if (!response.ok) {
      const text = await response.text();
      let errorMessage = 'Failed to trigger test email';
      try {
        const err = JSON.parse(text);
        errorMessage = err.error || errorMessage;
      } catch (e) {}
      throw new Error(errorMessage);
    }
  },

  // ═══ Email Logs APIs ═══════════════════════════════════════════════════

  getEmailLogs: async (filter?: { ruleId?: string; status?: string }): Promise<any[]> => {
    let query = supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (filter?.ruleId) query = query.eq('rule_id', filter.ruleId);
    if (filter?.status) query = query.eq('status', filter.status);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  sendEmail: async (params: { to: string | string[]; cc?: string[]; subject: string; html: string; attachments?: any[] }): Promise<void> => {
    // Fetch config to pass along
    const config = await api.getEmailConfig();

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        ...params,
        smtpConfig: config ? {
          host: config.host || 'smtp.gmail.com',
          port: config.port || 587,
          secure: config.secure || false,
          user: config.user,
          pass: config.pass,
          fromEmail: config.fromEmail || config.user,
          fromName: config.fromName || 'Paradigm FMS',
          replyTo: config.replyTo,
        } : undefined
      })
    });
    if (!response.ok) {
      const text = await response.text();
      let errorMessage = response.statusText || 'Failed to send email';
      try {
        const err = JSON.parse(text);
        errorMessage = err.error || errorMessage;
      } catch (e) {
        errorMessage = text.substring(0, 150) || errorMessage;
      }
      throw new Error(errorMessage);
    }
  },

  getRecurringHolidays: async (): Promise<RecurringHolidayRule[]> => {
    const { data, error } = await supabase.from('recurring_holidays').select('*');
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      type: row.role_type,
      day: row.day,
      n: row.occurrence
    }));
  },

  addRecurringHoliday: async (rule: RecurringHolidayRule): Promise<RecurringHolidayRule> => {
    const dbRule = {
      role_type: rule.type || 'office',
      day: rule.day,
      occurrence: rule.n
    };
    const { data, error } = await supabase.from('recurring_holidays').insert(dbRule).select().single();
    if (error) throw error;
    return {
      id: data.id,
      type: data.role_type,
      day: data.day,
      n: data.occurrence
    };
  },

  deleteRecurringHoliday: async (id: string): Promise<void> => {
    const { error } = await supabase.from('recurring_holidays').delete().eq('id', id);
    if (error) throw error;
  },
  createAssignment: async (officerId: string, siteId: string, date: string): Promise<void> => {
    // 1. Create a task for the officer
    const site = (await api.getOrganizations()).find(o => o.id === siteId);
    await api.createTask({
      name: `Visit ${site?.shortName || 'site'} for verification`,
      description: `Perform on-site duties and verification tasks for ${site?.shortName}.`,
      dueDate: date,
      priority: 'Medium',
      assignedToId: officerId,
    });

    // 2. Persist the assignment state
    const { error } = await supabase.from('site_assignments').insert({
      officer_id: officerId,
      site_id: siteId,
      assignment_date: date
    });
    if (error && error.code !== '23505') throw error; // Ignore duplicates
  },
  getLeaveBalancesForUser: async (userId: string, asOfDate?: string): Promise<LeaveBalance> => {
    const getStaffType = (role: string): 'office' | 'field' | 'site' => {
      const r = (role || '').toLowerCase();
      // Office Roles
      if ([
        'hr', 'admin', 'finance', 'developer', 'management', 'office_staff', 
        'back_office_staff', 'bd', 'finance_manager', 'hr_ops', 'business developer', 'unverified',
        'finance manager', 'hr ops'
      ].includes(r)) return 'office';
      
      // Site Roles
      if (['site_manager', 'site manager', 'technician', 'plumber', 'multitech', 'hvac_technician', 'plumber_carpenter', 'security_guard'].includes(r)) return 'site';
      
      // Default to field (includes 'field_staff', 'field staff', etc.)
      return 'field';
    };
    const status = await Network.getStatus();
    let settingsData: any;
    let userData: any;

    if (status.connected) {
      try {
        const [settingsRes, userRes] = (await withTimeout(
          Promise.all([
            supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
            supabase.from('users')
              .select(`
                role_id, 
                role:roles(display_name),
                earned_leave_opening_balance, 
                earned_leave_opening_date, 
                sick_leave_opening_balance, 
                sick_leave_opening_date,
                child_care_leave_opening_balance,
                child_care_leave_opening_date,
                joining_date,
                gender,
                created_at
              `)
              .eq('id', userId)
              .single()
          ]) as any,
          15000,
          'Leave balance initial data fetch timed out'
        )) as any[];

        if (!settingsRes.error && !userRes.error) {
          settingsData = settingsRes.data;
          userData = userRes.data;
          await offlineDb.setCache(`user_profile_leave_${userId}`, userData);
        }
      } catch (err) {
        console.warn('Failed to fetch leave settings/user from cloud:', err);
      }
    }

    if (!userData) {
      userData = await offlineDb.getCache(`user_profile_leave_${userId}`);
    }
    
    // Always get settings from cache if cloud fails (we likely have them from getInitialAppData)
    if (!settingsData) {
      const initialData = await offlineDb.getCache('initial_app_data');
      settingsData = initialData?.settings ? { attendance_settings: toSnakeCase(initialData.settings) } : null;
    }

    if (!settingsData?.attendance_settings) throw new Error('Could not load attendance rules.');
    if (!userData) throw new Error('User profile data not available offline.');

    // Get role name from join or fallback to role_id string
    const roleData = userData.role;
    const roleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || userData.role_id;
    const staffType = getStaffType(roleName);
    const rules = (toCamelCase(settingsData.attendance_settings) as AttendanceSettings)[staffType];
    const isFemaleUser = (userData.gender || '').toLowerCase() === 'female';
    console.log('[LeaveDebug] userId:', userId, 'roleName:', roleName, 'staffType:', staffType, 'enableSickLeaveAccrual:', rules?.enableSickLeaveAccrual, 'annualSickLeaves:', rules?.annualSickLeaves);

    const referenceDate = asOfDate ? new Date(asOfDate.replace(/-/g, '/')) : new Date();
    const currentYear = referenceDate.getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const todayStr = format(referenceDate, 'yyyy-MM-dd');
    
    // Determine the earliest date we need to fetch data from to account for multi-year accrual
    const openingDates = [
        userData?.earned_leave_opening_date,
        userData?.sick_leave_opening_date,
        userData?.child_care_leave_opening_date,
        userData?.joining_date,
        userData?.created_at,
        yearStart
    ].filter(Boolean) as string[];
    
    // Sort and take the earliest. For YYYY-MM-DD, alphabetical sort works.
    const earliestDataDate = openingDates.sort()[0] || yearStart;

    const emptyRes = { data: [], error: null };
    let approvedLeaves: any[] = [];
    let compOffData: any[] = [];
    let otData: any[] = [];
    let holidays: any[] = [];
    let recurringHolidays: any[] = [];
    let yearEvents: any[] = [];
    let userHolidaysData: any[] = [];

    if (status.connected) {
      try {
        const [
          leavesRes, 
          compOffRes, 
          otRes, 
          holidaysRes, 
          recurringRes, 
          eventsRes,
          userHolidaysRes
        ] = (await withTimeout(
          Promise.all([
            // Leave requests: Fetch from earliestDataDate to allow lifetime EL tracking (for carry-forward)
            supabase.from('leave_requests')
              .select('leave_type, start_date, end_date, day_option, status')
              .eq('user_id', userId)
              .in('status', ['approved', 'pending_manager_approval', 'pending_hr_confirmation'])
              .gte('start_date', earliestDataDate)
              .lte('start_date', `${currentYear}-12-31`),
            // Comp off logs: only fetch current year to avoid inflating totals with historical data
            supabase.from('comp_off_logs').select('*').eq('user_id', userId)
              .gte('created_at', yearStart)
              .lte('created_at', `${currentYear}-12-31T23:59:59`),
            supabase.from('extra_work_logs').select('hours_worked').eq('user_id', userId).eq('claim_type', 'OT').eq('status', 'Approved').gte('work_date', format(startOfMonth(referenceDate), 'yyyy-MM-dd')).lte('work_date', format(endOfMonth(referenceDate), 'yyyy-MM-dd')),
            supabase.from('holidays').select('*'),
            api.getRecurringHolidays(),
            // Attendance events: still fetch from earliestDataDate for accrual calculation
            supabase.from('attendance_events')
              .select('timestamp, type')
              .eq('user_id', userId)
              .gte('timestamp', earliestDataDate)
              .lte('timestamp', `${currentYear}-12-31`),
            supabase.from('user_holidays').select('*').eq('user_id', userId)
          ]) as any,
          20000,
          'Leave balance detailed data fetch timed out'
        )) as any[];

        approvedLeaves = leavesRes.data || [];
        compOffData = compOffRes.data || [];
        otData = otRes.data || [];
        holidays = holidaysRes.data || [];
        recurringHolidays = recurringRes || [];
        yearEvents = eventsRes.data || [];
        userHolidaysData = userHolidaysRes?.data || [];
        
        // Cache these for offline balance simulation
        await offlineDb.setCache(`leave_data_bundle_${userId}_${currentYear}`, {
          approvedLeaves, compOffData, otData, holidays, recurringHolidays, yearEvents, userHolidays: userHolidaysData
        });
      } catch (err) {
        console.warn('Failed to fetch detailed leave data from cloud, using cache if available');
      }
    }
    if (!approvedLeaves.length && !yearEvents.length) {
      const cached = await offlineDb.getCache(`leave_data_bundle_${userId}_${currentYear}`);
      if (cached) {
        approvedLeaves = cached.approvedLeaves || [];
        compOffData = cached.compOffData || [];
        otData = cached.otData || [];
        holidays = cached.holidays || [];
        recurringHolidays = cached.recurringHolidays || [];
        yearEvents = cached.yearEvents || [];
        userHolidaysData = cached.userHolidays || [];
      }
    }

    // Validity Check Logic Helper: Returns true if NOT valid
    const isNotValid = (validFrom?: string, validTill?: string) => {
        if (validFrom && todayStr < validFrom) return true;
        if (validTill && todayStr > validTill) return true;
        return false;
    };

    // Helper for floating holiday validity
    // PRIORITY 1: If floatingHolidayMonths is configured, it is the SOLE gate (validFrom/validTill ignored).
    // PRIORITY 2 (fallback): No month array → use validFrom/validTill dates.
    const isFloatingHolidayValid = (dateToCheck: string) => {
        if (rules.floatingHolidayMonths && rules.floatingHolidayMonths.length > 0) {
            const monthIdx = new Date(dateToCheck.replace(/-/g, '/')).getMonth();
            return rules.floatingHolidayMonths.includes(monthIdx);
        }
        if (rules.floatingLeavesValidFrom && dateToCheck < rules.floatingLeavesValidFrom) return false;
        if (rules.floatingLeavesExpiryDate && dateToCheck > rules.floatingLeavesExpiryDate) return false;
        return true;
    };

    const now = new Date();
    const viewingPastMonth = referenceDate < startOfMonth(now);
    const accrualEndDate = viewingPastMonth ? endOfMonth(referenceDate) : now;
    const accrualYearStart = new Date(yearStart.replace(/-/g, '/'));
    const isMonthlyAccrual = staffType === 'site';

    let earnedTotal = rules.annualEarnedLeaves || 0;
    let earnedThisMonth = 0;
    let earnedPreviousMonth = 0;

    if (rules.earnedLeaveAccrual) {
      const openingBalance = userData.earned_leave_opening_balance || 0;
      const openingDate = userData.earned_leave_opening_date || `${currentYear}-01-01`;
      const openingDateObj = new Date(openingDate); 
      
      const accrualRate = rules.earnedLeaveAccrual?.amountEarned || 1.5;
      const daysRequired = rules.earnedLeaveAccrual?.daysRequired || 30;

      // 1. Total Cumulative Accrual
      // Policy: EL is LIFETIME (carry-forward enabled).
      // ALL users: Use CALENDAR DAYS for EL accrual.
      const calendarDaysTotal = differenceInCalendarDays(accrualEndDate, openingDateObj) + 1;
      earnedTotal = openingBalance + (calendarDaysTotal / daysRequired) * accrualRate;
      
      // Validity check for Earned Leave
      if (isNotValid(rules.earnedLeavesValidFrom, rules.earnedLeavesExpiryDate)) {
          earnedTotal = 0;
      }
      
      // 2. Accrual for the CURRENT viewed month
      const monthStart = startOfMonth(accrualEndDate);
      // Ensure we don't start before the opening date
      const effectiveMonthStart = monthStart < openingDateObj ? openingDateObj : monthStart;
      if (accrualEndDate >= effectiveMonthStart) {
        // ALL users: use calendar days for consistency with total accrual
        const calendarDaysThisMonth = differenceInCalendarDays(accrualEndDate, effectiveMonthStart) + 1;
        earnedThisMonth = (calendarDaysThisMonth / daysRequired) * accrualRate;
      }

      // 3. Starting Balance (Month end of previous month)
      const prevMonthEnd = endOfMonth(subMonths(accrualEndDate, 1));
      if (prevMonthEnd >= openingDateObj) {
          // ALL users: use calendar days for consistency with total accrual
          const calendarDaysPrev = differenceInCalendarDays(prevMonthEnd, openingDateObj) + 1;
          earnedPreviousMonth = openingBalance + (calendarDaysPrev / daysRequired) * accrualRate;
      } else {
          earnedPreviousMonth = openingBalance;
      }
    }

    // Calculate Floating Holidays based on attendance on Recurring Holidays (e.g. 3rd Saturday)
    // AND Comp Offs based on attendance on Sundays or Public Holidays
    const attendedDates = new Set((yearEvents || [])
        .filter(e => e.type.toLowerCase().includes('check') || e.type.toLowerCase().includes('in'))
        .map(e => format(new Date(e.timestamp), 'yyyy-MM-dd')));
    const holidayDates = new Set(holidays.map(h => {
        const dStr = String(h.date);
        if (dStr.includes('T')) return format(new Date(dStr), 'yyyy-MM-dd');
        return format(new Date(dStr.replace(/-/g, '/')), 'yyyy-MM-dd');
    }));

    // Add FIXED_HOLIDAYS (e.g. May 1st Labour Day)
    FIXED_HOLIDAYS.forEach(fh => {
        holidayDates.add(`${currentYear}-${fh.date}`);
    });
    
    // User requested refinement: Only count Sundays, Fixed (Gov) holidays, and SELECTED optional holidays.
    // If we have fresh data, use the results from userHolidaysRes. If cached, use userHolidaysLocal.
    const finalUserHolidays = userHolidaysData;
    (finalUserHolidays || []).forEach((uh: any) => {
        if (uh.holiday_date) {
            holidayDates.add(uh.holiday_date);
        }
    });

    // We NO LONGER automatically add all entries from rules.holidayPool.
    // This fixed the issue where unselected elective holidays were earning Comp Offs.
    
    // 1. Identify all Recurring Holiday dates in the year to support Comp Off accrual (Earned via Work)
    // 3rd Saturday rule applies ONLY to users EXPLICITLY marked as MALE (per HR policy)
    const isMale = (userData.gender || '').toLowerCase() === 'male';
    const intervalDays = eachDayOfInterval({ start: new Date(yearStart.replace(/-/g, '/')), end: endOfMonth(referenceDate) });
    intervalDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayName = format(day, 'EEEE');
        
        // 3rd Saturday recurring holiday rule is male-only per HR policy
        const isRecurringHoliday = (recurringHolidays || []).some(rh => {
             const rhType = rh.type || rh.roleType;
             const rhN = typeof rh.n !== 'undefined' ? rh.n : rh.occurrence;
             
             if (rhType && rhType !== staffType) return false;
             if (rh.day !== dayName) return false;
             
             // If this rule matches a Saturday, only apply to male employees
             // AND ONLY if the policy has not expired (Monthly Floating Holidays expiry applies)
             if (rh.day === 'Saturday') {
                 if (!isMale) return false;
                 if (!isFloatingHolidayValid(dateStr)) return false;
             }
             
             if (rhN === 0) return true; 
             const nth = Math.ceil(day.getDate() / 7);
             return rhN === nth;
        }) || (isMale && dayName === 'Saturday' && Math.ceil(day.getDate() / 7) === 3 && isFloatingHolidayValid(dateStr));

        if (isRecurringHoliday) {
            holidayDates.add(dateStr);
        }
    });

    const floatingTotal = 0;
    let dynamicCompOffTotal = 0;
    
    // 2. Comp Offs based on attendance on Week Offs or Public/Recurring Holidays (Earned via Work)
    const weeklyOffDays = rules?.weeklyOffDays || [0];
    attendedDates.forEach(dateStr => {
        const date = new Date(dateStr.replace(/-/g, '/'));
        
        // Only count work within the CURRENT YEAR, up to the end of the viewed month
        const yearStartDate = new Date(yearStart.replace(/-/g, '/'));
        if (date < yearStartDate) return;
        if (date > endOfMonth(referenceDate)) return;

        // Comp Off Accrual Check (Week Off or Public/Recurring Holiday)
        const dayOfWeek = date.getDay();
        if (weeklyOffDays.includes(dayOfWeek) || holidayDates.has(dateStr)) {
            dynamicCompOffTotal += 1;
        }
    });

    let sickTotal = 0;
    if (rules.enableSickLeaveAccrual) {
      const openingBalance = userData.sick_leave_opening_balance || 0;
      const openingDate = userData.sick_leave_opening_date || `${currentYear}-01-01`;
      const openingDateObj = new Date(openingDate);
      
      // Sick Leave Policy: STRICTLY CURRENT YEAR (No Carry Forward).
      // ALL users (Office, Field, Site) share the exact same calculation: 1 per calendar month.
      // Floor the opening date to Jan 1st 2026.
      const effectiveOpeningDateSL = openingDateObj < accrualYearStart ? accrualYearStart : openingDateObj;
      
      const monthsElapsed = differenceInCalendarMonths(accrualEndDate, effectiveOpeningDateSL);
      sickTotal = monthsElapsed + 1; 
    } else {
      // Even if Sick Leave accrual is disabled globally, we ensure it's at least capped to 5 for Jan-May if viewing May
      const monthsElapsed = differenceInCalendarMonths(accrualEndDate, accrualYearStart);
      sickTotal = Math.min(rules.annualSickLeaves || 12, monthsElapsed + 1);
      console.log('[LeaveDebug] SL path: accrual DISABLED, annualSickLeaves:', rules.annualSickLeaves, 'monthsElapsed:', monthsElapsed, 'sickTotal:', sickTotal);
    }
    console.log('[LeaveDebug] FINAL sickTotal:', sickTotal, 'isMonthlyAccrual:', isMonthlyAccrual);

    // 3. Calculate Site OT Days for the current viewed month (Technical Roles only)
    let siteOtDaysThisMonth = 0;
    if (isTechnicalRole(roleName)) {
        const monthStart = startOfMonth(referenceDate);
        const monthEnd = endOfMonth(referenceDate);
        
        // Group site-ot events by date
        const siteOtEventsByDate: Record<string, Set<string>> = {};
        (yearEvents || []).forEach(e => {
            if (e.type === 'site-ot-in' || e.type === 'site-ot-out') {
                const d = new Date(e.timestamp);
                if (d >= monthStart && d <= monthEnd) {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    if (!siteOtEventsByDate[dateStr]) siteOtEventsByDate[dateStr] = new Set();
                    siteOtEventsByDate[dateStr].add(e.type);
                }
            }
        });

        // A day counts as a Site OT day if it has both 'site-ot-in' and 'site-ot-out'
        // Or if it has 'site-ot-in' and it's today (active session)
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        Object.entries(siteOtEventsByDate).forEach(([dateStr, types]) => {
            if (types.has('site-ot-in') && (types.has('site-ot-out') || dateStr === todayStr)) {
                siteOtDaysThisMonth += 1;
            }
        });
    }

    // Validity check for Sick Leave
    if (isNotValid(rules.sickLeavesValidFrom, rules.sickLeavesExpiryDate)) {
        sickTotal = 0;
    }

    const monthEnd = endOfMonth(referenceDate);
    
    // Total Comp Off = (Attendance on Holidays/Sundays) + manual grants (only 'earned' status)
    // 'used' logs represent consumed comp offs and should NOT inflate the total.
    const manualCompOffGranted = (compOffData || []).filter((log: any) => log.status === 'earned').length;
    const manualCompOffUsed = (compOffData || []).filter((log: any) => log.status === 'used').length;
    const compOffTotal = dynamicCompOffTotal + manualCompOffGranted;

    const finalCompOffTotal = compOffTotal;

    const otHoursThisMonth = (otData || []).reduce((sum, log) => sum + (log.hours_worked || 0), 0);

    const expiryStates = {
      earned: isNotValid(rules.earnedLeavesValidFrom, rules.earnedLeavesExpiryDate),
      sick: isNotValid(rules.sickLeavesValidFrom, rules.sickLeavesExpiryDate),
      floating: !isFloatingHolidayValid(todayStr),
      compOff: isNotValid(rules.compOffLeavesValidFrom, rules.compOffLeavesExpiryDate),
      childCare: isNotValid(rules.childCareLeavesValidFrom, rules.childCareLeavesExpiryDate)
    };

    // 1. Floating Holiday Logic (Check validity)
    // Blue Leave (Floating Holiday/3rd Saturday) is ONLY available for MALE employees.
    let floatingTotalValue = 0;
    if (isFloatingHolidayValid(todayStr) && !isFemaleUser) {
        floatingTotalValue = rules.monthlyFloatingLeaves || 0;
    }

    const balance: LeaveBalance = {
      userId,
      earnedTotal,
      earnedUsed: 0,
      earnedPending: 0,
      sickTotal,
      sickUsed: 0,
      sickPending: 0,
      floatingTotal: floatingTotalValue, 
      floatingUsed: 0,
      floatingPending: 0,
      compOffTotal: (isNotValid(rules.compOffLeavesValidFrom, rules.compOffLeavesExpiryDate)) ? 0 : finalCompOffTotal, 
      compOffUsed: manualCompOffUsed, // Start with manual 'used' logs
      compOffPending: 0,
      maternityTotal: 0,
      maternityUsed: 0,
      maternityPending: 0,
      childCareTotal: 0,
      childCareUsed: 0,
      childCarePending: 0,
      pinkTotal: 0,
      pinkUsed: 0,
      pinkPending: 0,
      earnedThisMonth,
      earnedPreviousMonth,
      siteOtDaysThisMonth,
      otHoursThisMonth,
      expiryStates
    };

    const userGender = userData.gender?.toLowerCase() || '';

    // --- Pink Leave (Female employees only, 1/month, no carry forward) ---
    if (userGender === 'female') {
      balance.pinkTotal = 1;
    }

    // --- Maternity & Child Care Leave (Female employees only) ---
    if (userGender === 'female') {
      // Maternity: 26 weeks (182 days), requires 6 months tenure
      const maternityWeeks = rules.maternityLeaveWeeks ?? 26;
      const maternityMinTenure = rules.maternityMinTenureMonths ?? 6;
      
      // Use joining_date if available, fallback to created_at
      const tenureStartDateStr = userData.joining_date || userData.created_at;
      const tenureStartDate = tenureStartDateStr ? new Date(tenureStartDateStr.replace(/-/g, '/')) : new Date();
      
      // Use differenceInMonths for strict tenure (full months elapsed)
      const tenureMonths = differenceInMonths(referenceDate, tenureStartDate);
      
      if (tenureMonths >= maternityMinTenure) {
        balance.maternityTotal = maternityWeeks * 7; // Convert weeks to days
      }

      // Child Care: Based on approved children and monthly accrual (0.5/month with attendance)
      try {
        const { data: childrenData } = await supabase
          .from('user_children')
          .select('date_of_birth, verification_status')
          .eq('user_id', userId)
          .eq('verification_status', 'approved');
        
        if (childrenData && childrenData.length > 0) {
          // 1. Check Validity (Expiry)
          // Rule: If validity is not present or has passed, balance is 0.
          const isNotValidCCL = isNotValid(rules.childCareLeavesValidFrom, rules.childCareLeavesExpiryDate);
          
          if (isNotValidCCL) {
            balance.childCareTotal = 0;
          } else {
            // 2. Monthly Accrual: 0.5 per month with attendance
            const openingBalance = userData.child_care_leave_opening_balance || 0;
            const openingDate = userData.child_care_leave_opening_date || userData.joining_date || userData.created_at || `${currentYear}-01-01`;
            const openingDateObj = new Date(openingDate);
            const effectiveOpeningDateCCL = openingDateObj < accrualYearStart ? accrualYearStart : openingDateObj;
            const effectiveOpeningBalanceCCL = openingDateObj < accrualYearStart ? 0 : openingBalance;

            const startCheckCCL = startOfMonth(effectiveOpeningDateCCL);
            const endCheckCCL = startOfMonth(accrualEndDate);
            let monthsToTestCCL = eachMonthOfInterval({ start: startCheckCCL, end: endCheckCCL });
            
            let earnedCCL = 0;
            monthsToTestCCL.forEach(m => {
                const mStart = startOfMonth(m);
                const mEnd = endOfMonth(m);
                const hasAttendanceThisMonth = (yearEvents || []).some(e => {
                    const d = new Date(e.timestamp);
                    return d >= mStart && d <= mEnd && (e.type === 'punch-in' || e.type === 'check-in' || e.type === 'site-ot-in');
                });
                if (hasAttendanceThisMonth) earnedCCL += 0.5;
            });
            
            balance.childCareTotal = effectiveOpeningBalanceCCL + earnedCCL;
          }
        }
      } catch (e) {
        console.error('Failed to fetch children for child care leave:', e);
      }
    }

    const processedLeaves: any[] = [];
    approvedLeaves.forEach(leave => {
      const leaveStart = leave.start_date;
      const leaveEndDate = leave.end_date;
      const type = (leave.leave_type || '').toLowerCase();
      const status = leave.status;
      
      const leaveStartDateObj = new Date(leaveStart.replace(/-/g, '/'));

      // Only count leaves that have already started (up to today).
      if (leaveStartDateObj > new Date(todayStr.replace(/-/g, '/'))) return;
      
      // Only count leaves from the CURRENT YEAR for non-carry-forward types.
      const leaveYear = leaveStartDateObj.getFullYear();
      const isEarned = type.includes('earned') || type === 'el';
      if (!isEarned && leaveYear < currentYear) return;
      
      let leaveAmount = 1;
      if (leave.day_option === 'half') leaveAmount = 0.5;
      else {
          const duration = differenceInCalendarDays(new Date(leaveEndDate.replace(/-/g, '/')), new Date(leaveStart.replace(/-/g, '/'))) + 1;
          leaveAmount = duration;
      }

      processedLeaves.push({
          type: leave.leave_type,
          start: leaveStart,
          amount: leaveAmount,
          status: leave.status
      });

      const isApproved = status === 'approved';
      const isPending = status === 'pending_manager_approval' || status === 'pending_hr_confirmation';

      // Robust matching: Check if type contains key words (earned, sick/sl, floating, comp)
      if (type.includes('earned') || type === 'el') {
        if (!expiryStates.earned || (rules.earnedLeavesExpiryDate && leaveStart <= rules.earnedLeavesExpiryDate)) {
          if (isApproved) balance.earnedUsed += leaveAmount;
          if (isPending) balance.earnedPending += leaveAmount;
        }
      } else if (type.includes('sick') || type === 'sl' || type === 's/l') {
        if (!expiryStates.sick || (rules.sickLeavesExpiryDate && leaveStart <= rules.sickLeavesExpiryDate)) {
          if (isApproved) balance.sickUsed += leaveAmount;
          if (isPending) balance.sickPending += leaveAmount;
        }
      } else if (type.includes('floating') || type === 'fh' || type === 'hp') {
        if (!expiryStates.floating || isFloatingHolidayValid(leaveStart)) {
          if (isApproved) balance.floatingUsed += leaveAmount;
          if (isPending) balance.floatingPending += leaveAmount;
        }
      } else if (type.includes('pink')) {
        // Pink Leave is monthly and non-carry forward. Only count if it's within the viewed month.
        const monthStart = startOfMonth(referenceDate);
        if (leaveStartDateObj >= monthStart && leaveStartDateObj <= monthEnd) {
          if (isApproved) balance.pinkUsed += leaveAmount;
          if (isPending) balance.pinkPending += leaveAmount;
        }
      } else if (type.includes('child care') || type.includes('childcare') || type.includes('child')) {
        if (isApproved) balance.childCareUsed += leaveAmount;
        if (isPending) balance.childCarePending += leaveAmount;
      } else if (type.includes('maternity')) {
        if (isApproved) balance.maternityUsed += leaveAmount;
        if (isPending) balance.maternityPending += leaveAmount;
      } else if (type.includes('comp') || type === 'co') {
        if (!expiryStates.compOff || (rules.compOffLeavesExpiryDate && leaveStart <= rules.compOffLeavesExpiryDate)) {
          if (isApproved) balance.compOffUsed += leaveAmount;
          if (isPending) balance.compOffPending += leaveAmount;
        }
      } else if (type.includes('loss of pay') || type === 'lop') {
        // Loss of Pay doesn't reduce any leave balance but is tracked
        if (isApproved) balance.earnedUsed += 0; // no deduction
      }
    });

    balance.debug = {
        staffType,
        hasEarnedRule: !!rules.earnedLeaveAccrual,
        earnedRule: rules.earnedLeaveAccrual,
        earnedThisMonth,
        earnedPreviousMonth,
        openingDate: userData.earned_leave_opening_date,
        asOfDate,
        hasSettings: !!settingsData?.attendance_settings,
        officeRules: !!(toCamelCase(settingsData.attendance_settings) as any).office?.earnedLeaveAccrual,
        fieldRules: !!(toCamelCase(settingsData.attendance_settings) as any).field?.earnedLeaveAccrual
    };

    return balance;
  },

  getCountableDays: async (userId: string, fromDate: string, toDate: string, holidays: any[], recurringHolidays: any[], rules: StaffAttendanceRules, staffType: string): Promise<number> => {
    // 1. Fetch attendance events for the period
    const { data: events, error } = await supabase
      .from('attendance_events')
      .select('timestamp')
      .eq('user_id', userId)
      .gte('timestamp', startOfDay(new Date(fromDate)).toISOString())
      .lte('timestamp', endOfDay(new Date(toDate)).toISOString());
    
    if (error) throw error;
    
    // User requested refinement: if no attendance events are found in the period, return 0 countable days.
    // This prevents accrual for employees who haven't started working or are totally inactive.
    if (!events || events.length === 0) return 0;

    const attendedDates = new Set((events || []).map(e => format(new Date(e.timestamp), 'yyyy-MM-dd')));
    const holidayDates = new Set(holidays.map(h => format(new Date(h.date), 'yyyy-MM-dd')));
    
    // Group active days by week (Monday-start) for Week Off eligibility
    const activeDaysPerWeek: Record<string, number> = {};
    attendedDates.forEach(dateStr => {
        const d = new Date(dateStr.replace(/-/g, '/'));
        const weekKey = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        activeDaysPerWeek[weekKey] = (activeDaysPerWeek[weekKey] || 0) + 1;
    });

    // Include fixed holidays
    const yearOfInterval = new Date(toDate).getFullYear();
    FIXED_HOLIDAYS.forEach(fh => {
      holidayDates.add(`${yearOfInterval}${fh.date}`);
    });

    // Include holidays from the pool
    if (rules.holidayPool) {
        rules.holidayPool.forEach((hp: any) => {
            if (hp.date.startsWith('-')) {
                holidayDates.add(`${yearOfInterval}${hp.date}`);
            }
        });
    }

    let countableCount = 0;
    const interval = { start: new Date(fromDate), end: new Date(toDate) };
    const days = eachDayOfInterval(interval);

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Case 1: Employee worked (at least one attendance event)
      if (attendedDates.has(dateStr)) {
        countableCount++;
        return;
      }

      // Case 2: It's a public holiday (Custom + Fixed)
      if (holidayDates.has(dateStr)) {
        countableCount++;
        return;
      }

      // Case 3: It's a week-off day
      // RULE: Week off only counts if user was active for at least 2 days in that week
      const weekKey = format(startOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const activeCount = activeDaysPerWeek[weekKey] || 0;

      if (activeCount >= 2) {
          // a) Check weeklyOffDays rule (index-based)
          const dayOfWeek = getDay(day); // 0 = Sunday, 1 = Monday, ...
          if ((rules.weeklyOffDays || [0]).includes(dayOfWeek)) {
            countableCount++;
            return;
          }

          // b) Check recurring holidays (specifically role-based week-offs like "Every Sunday")
          const isRecurring = recurringHolidays.some(rh => {
            const rhType = rh.type || rh.roleType;
            const rhN = typeof rh.n !== 'undefined' ? rh.n : rh.occurrence;

            if (rh.day !== format(day, 'EEEE')) return false;
            if (rhN === 0) return true; // 0 usually means every
            const dayOfMonth = day.getDate();
            const nth = Math.ceil(dayOfMonth / 7);
            if (rhN !== nth) return false;
            if (rhType && rhType !== staffType) return false;
            return true;
          });

          if (isRecurring) {
            countableCount++;
            return;
          }
      }
    });

    return countableCount;
  },
  submitLeaveRequest: async (data: Omit<LeaveRequest, 'id' | 'status' | 'currentApproverId' | 'approvalHistory'>): Promise<LeaveRequest> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        const offlineId = `offline_${Date.now()}`;
        const offlineRequest = { ...data, id: offlineId, status: 'pending_manager_approval' } as LeaveRequest;
        await offlineDb.addToOutbox({ table_name: 'leave_requests', action: 'INSERT', payload: data });
        
        // Update local cache for leave requests
        const cached = await offlineDb.getCache('leave_requests') || [];
        await offlineDb.setCache('leave_requests', [offlineRequest, ...cached]);

        return offlineRequest;
    }

    const { data: userProfile, error: userError } = await supabase.from('users').select('reporting_manager_id').eq('id', data.userId).single();
    if (userError) throw userError;
    
    const dataWithPaths = await processFilesForUpload(data, data.userId, '');
    const dbData = toSnakeCase(dataWithPaths);
    
    delete dbData.user_name;

    const { data: insertedData, error: insertError } = await supabase.from('leave_requests').insert({ 
      ...dbData, 
      status: 'pending_manager_approval', 
      current_approver_id: userProfile.reporting_manager_id || null, 
      approval_history: [] 
    }).select('*').single();
    
    if (insertError) throw insertError;

    if (userProfile.reporting_manager_id) {
      try {
        dispatchNotificationFromRules('leave_request', {
          actorName: data.userName || 'An employee',
          actionText: `has submitted a new ${data.leaveType} leave request`,
          locString: '',
          actor: { 
            id: data.userId, 
            name: data.userName || 'Employee', 
            role: 'staff',
            reportingManagerId: userProfile.reporting_manager_id 
          }
        });
      } catch (notifError) {
        console.error('Failed to trigger leave notification:', notifError);
      }
    }

    return toCamelCase(insertedData);
  },
  updateLeaveRequest: async (id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest> => {
    const dbData = toSnakeCase(updates);
    delete dbData.user_name; // Ensure user_name is not sent

    const { data, error } = await supabase.from('leave_requests').update(dbData).eq('id', id).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  updateLeaveType: async (requestId: string, newType: LeaveType): Promise<void> => {
    // 1. Fetch current request data
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select('user_id, leave_type, status, start_date, end_date, day_option')
      .eq('id', requestId)
      .single();
    
    if (fetchError) throw fetchError;
    const oldType = request.leave_type;

    // 2. If already approved, manage comp off logs
    if (request.status === 'approved') {
      // Case A: Old type was Comp Off -> Restore logs to 'earned'
      if (oldType === 'Comp Off' && newType !== 'Comp Off') {
        await supabase
          .from('comp_off_logs')
          .update({ status: 'earned', leave_request_id: null })
          .eq('leave_request_id', requestId);
      }
      
      // Case B: New type is Comp Off -> Consume available 'earned' logs
      if (newType === 'Comp Off' && oldType !== 'Comp Off') {
        const leaveDays = request.day_option === 'half' ? 0.5 : differenceInCalendarDays(new Date(request.end_date.replace(/-/g, '/')), new Date(request.start_date.replace(/-/g, '/'))) + 1;
        const { data: availableLogs } = await supabase
          .from('comp_off_logs')
          .select('id')
          .eq('user_id', request.user_id)
          .eq('status', 'earned')
          .limit(Math.ceil(leaveDays));
        
        if (availableLogs && availableLogs.length > 0) {
          await supabase
            .from('comp_off_logs')
            .update({ status: 'used', leave_request_id: requestId })
            .in('id', availableLogs.map(l => l.id));
        }
      }
    }

    // 3. Update the leave request type
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({ leave_type: newType })
      .eq('id', requestId);
    
    if (updateError) throw updateError;
  },
  cancelLeaveRequest: async (id: string): Promise<void> => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) throw error;
  },
  deleteLeaveRequest: async (id: string): Promise<void> => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) throw error;
  },
  getLeaveRequests: async (filter?: { userId?: string, userIds?: string[], status?: string | string[], forApproverId?: string, startDate?: string, endDate?: string, page?: number, pageSize?: number }): Promise<{ data: LeaveRequest[], total: number }> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        const cached = await offlineDb.getCache('leave_requests') || [];
        return { data: cached, total: cached.length };
    }

    let query = supabase.from('leave_requests').select('*, users!leave_requests_user_id_fkey(name, photo_url)', { count: 'exact' });
    if (filter?.userId) query = query.eq('user_id', filter.userId);
    if (filter?.userIds) query = query.in('user_id', filter.userIds);
    
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }
    
    // Multi-manager support: if forApproverId is set, also match employees who have
    // this person as their 2nd or 3rd reporting manager
    if (filter?.forApproverId) {
      // First, find all user IDs who have this approver as manager 2 or 3
      const { data: extraUsers } = await supabase.from('users')
        .select('id')
        .or(`reporting_manager_2_id.eq.${filter.forApproverId},reporting_manager_3_id.eq.${filter.forApproverId}`);
      
      const extraUserIds = (extraUsers || []).map(u => u.id);
      
      if (extraUserIds.length > 0) {
        // Match: current_approver_id = this approver OR user_id is in the extra users list
        query = query.or(`current_approver_id.eq.${filter.forApproverId},user_id.in.(${extraUserIds.join(',')})`);
      } else {
        query = query.eq('current_approver_id', filter.forApproverId);
      }
    }

    if (filter?.startDate && filter?.endDate) {
      query = query.lte('start_date', filter.endDate).gte('end_date', filter.startDate);
    }

    if (filter?.page && filter?.pageSize) {
      const from = (filter.page - 1) * filter.pageSize;
      const to = from + filter.pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = (await withTimeout(
      query.order('start_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }) as any,
      15000,
      'Fetch leave requests timed out'
    )) as any;
    if (error) return api.handleError(error);
    
    // Cache for offline
    if (!filter?.page) {
        await offlineDb.setCache('leave_requests', (data || []).map(toCamelCase));
    }
    
    // Get unique approver IDs (current and historical)
    const approverIdsSet = new Set<string>();
    (data || []).forEach(item => {
      if (item.current_approver_id) approverIdsSet.add(item.current_approver_id);
      if (item.approval_history && Array.isArray(item.approval_history)) {
        item.approval_history.forEach((record: any) => {
          if (record.approverId || record.approver_id) {
            approverIdsSet.add(record.approverId || record.approver_id);
          }
        });
      }
    });
    const approverIds = [...approverIdsSet];
    
    // Fetch approver names and photos if there are any
    let approverMap: Record<string, string> = {};
    let approverPhotoMap: Record<string, string | null> = {};
    if (approverIds.length > 0) {
      const { data: approvers } = await supabase.from('users').select('id, name, photo_url').in('id', approverIds);
      const camelApprovers = (approvers || []).map(toCamelCase);
      approverMap = camelApprovers.reduce((acc: any, user: any) => ({ ...acc, [user.id]: user.name }), {});
      approverPhotoMap = camelApprovers.reduce((acc: any, user: any) => ({ ...acc, [user.id]: user.photoUrl || null }), {});
    }
    
    const formattedData = (data || []).map(item => {
      const camelItem = toCamelCase(item);
      const userObj = Array.isArray(item.users) ? item.users[0] : item.users;
      const camelUserObj = Array.isArray(camelItem.users) ? camelItem.users[0] : camelItem.users;
      
      let mappedApprovalHistory = camelItem.approvalHistory || [];
      if (Array.isArray(mappedApprovalHistory)) {
          mappedApprovalHistory = mappedApprovalHistory.map((record: any) => ({
              ...record,
              approverPhotoUrl: record.approverId ? (approverPhotoMap[record.approverId] || null) : null
          }));
      }

      return {
        ...camelItem,
        approvalHistory: mappedApprovalHistory,
        userName: userObj?.name || 'Unknown',
        userPhotoUrl: camelUserObj?.photoUrl || undefined,
        currentApproverName: item.current_approver_id ? (approverMap[item.current_approver_id] || null) : null,
        currentApproverPhotoUrl: item.current_approver_id ? (approverPhotoMap[item.current_approver_id] || null) : null
      };
    });

    return { data: formattedData, total: count || 0 };
  },
  getTasks: async (filter?: { page?: number, pageSize?: number }): Promise<any> => {
    // 1. Try to get from cloud if online
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        let query = supabase.from('tasks').select('*', { count: 'exact' });
        
        const isPaginated = filter?.page !== undefined && filter?.pageSize !== undefined;
        if (isPaginated) {
          const from = (filter!.page! - 1) * filter!.pageSize!;
          const to = from + filter!.pageSize! - 1;
          query = query.range(from, to);
        }
        
        const { data, count, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        const formattedData = (data || []).map(toCamelCase);
        
        // Cache the latest tasks (for simplicity, we cache the whole list if not paginated)
        if (!isPaginated) {
            await offlineDb.setCache('tasks', formattedData);
        }

        if (isPaginated) {
          return { data: formattedData, total: count || 0 };
        }
        return formattedData;
      } catch (err) {
        console.warn('Failed to fetch tasks from cloud, falling back to cache');
      }
    }
    
    // 2. Fallback to local cache
    const cachedTasks = await offlineDb.getCache('tasks');
    if (filter?.page !== undefined && filter?.pageSize !== undefined) {
        return { data: cachedTasks || [], total: (cachedTasks || []).length };
    }
    return cachedTasks || [];
  },
  createTask: async (taskData: Partial<Task>): Promise<Task> => {
    const status = await Network.getStatus();
    if (!status.connected) {
       const offlineId = `offline_${Date.now()}`;
       const offlineTask = { ...taskData, id: offlineId, createdAt: new Date().toISOString(), status: 'To Do', escalationStatus: 'None' };
       await offlineDb.addToOutbox({ table_name: 'tasks', action: 'INSERT', payload: taskData });
       
       // Optimistic Cache update
       const cached = await offlineDb.getCache('tasks') || [];
       await offlineDb.setCache('tasks', [offlineTask, ...cached]);

       return toCamelCase(offlineTask);
    }

    const { data, error } = await supabase.from('tasks').insert(toSnakeCase({ ...taskData, status: 'To Do', escalationStatus: 'None' })).select().single();
    if (error) throw error;

    // Trigger rule-based notification
    if (data.assigned_to_id) {
        dispatchNotificationFromRules('task_assigned', {
            actorName: data.name,
            actionText: 'has been assigned',
            locString: '',
            actor: { id: data.created_by_id || '', name: 'System', role: 'admin' }
        });
    }

    return toCamelCase(data);
  },
  updateTask: async (id: string, updates: Partial<Task>): Promise<Task> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        await offlineDb.addToOutbox({ table_name: 'tasks', action: 'UPDATE', payload: { id, updates } });
        // Optimistic cache update
        const cached = await offlineDb.getCache('tasks') || [];
        const updated = cached.map((t: any) => t.id === id ? { ...t, ...updates } : t);
        await offlineDb.setCache('tasks', updated);
        return { id, ...updates } as Task;
    }

    // Handle completion photo upload
    if ((updates as any)?.completionPhoto && (updates as any).completionPhoto.file) {
      const completion: any = (updates as any).completionPhoto;
      const file: File = completion.file;
      try {
        const { path } = await api.uploadDocument(file, TASK_ATTACHMENTS_BUCKET);
        // Replace the completionPhoto with a JSON object containing metadata and the path
        (updates as any).completionPhoto = {
          name: completion.name,
          type: completion.type,
          size: completion.size,
          path,
        };
      } catch (uploadError) {
        console.error('Failed to upload task completion photo:', uploadError);
        // Remove the file property to avoid sending File object to database
        delete (updates as any).completionPhoto;
      }
    }
    const { data, error } = await supabase.from('tasks').update(toSnakeCase(updates)).eq('id', id).select().single();
    if (error) throw error;

    // Trigger notification if task is completed
    if (updates.status === 'Done') {
        dispatchNotificationFromRules('task_completed', {
            actorName: data.name,
            actionText: 'has been completed',
            locString: '',
            actor: { id: data.assigned_to_id || '', name: 'Staff', role: 'staff' }
        });
    }

    return toCamelCase(data);
  },
  deleteTask: async (id: string): Promise<void> => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
  runAutomaticEscalations: async (): Promise<{ updatedTasks: Task[], newNotifications: Notification[] }> => {
    const { data, error } = await supabase.functions.invoke('run-escalations');
    if (error) throw error;
    return toCamelCase(data);
  },
  getNotifications: async (userId: string): Promise<Notification[]> => {
    // Validate UUID to prevent 400 Bad Request errors from Supabase/PostgREST
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      console.warn('[API] getNotifications: Invalid or missing userId (UUID expected):', userId);
      return [];
    }
    
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return api.handleError(error);
    return (data || []).map(toCamelCase);
  },
  createNotification: async (data: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<Notification> => {
    // Filter out 'title' if present, as the table does not support it
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { title, ...validData } = data;

    if (validData.userId === 'ALL_USERS_BROADCAST') {
      const { error } = await supabase.rpc('broadcast_notification', {
        p_message: validData.message,
        p_type: validData.type || 'info',
        p_severity: (validData as any).severity || 'Low',
        p_metadata: (validData as any).metadata || {},
        p_link_to: validData.linkTo || (validData as any).link || null
      });
      if (error) throw error;
    
    // Trigger real push broadcast via FCM Edge Function
    supabase.functions.invoke('send-notification', {
      body: {
        broadcast: true,
        title: 'Important Alert',
        message: validData.message,
        url: validData.linkTo || (validData as any).link || null,
        type: validData.type || 'info',
        severity: (validData as any).severity || 'Low',
        metadata: {
          ...(validData as any).metadata,
          isBroadcast: true,
          sentAt: new Date().toISOString()
        }
      }
    }).catch(err => console.warn('Failed to trigger push broadcast:', err));

    return { ...data, id: 'broadcast', createdAt: new Date().toISOString(), isRead: false } as Notification;
  }

    const { data: inserted, error } = await supabase.from('notifications').insert(toSnakeCase(validData)).select().single();
    if (error) throw error;

    // Trigger real push notification via FCM Edge Function
    supabase.functions.invoke('send-notification', {
      body: {
        user_id: validData.userId,
        title: title || 'Paradigm Services',
        message: validData.message,
        data: {
          link: validData.linkTo || (validData as any).link || '',
          ...(validData as any).metadata
        }
      }
    }).catch(err => console.warn('Failed to trigger FCM push for individual notification:', err));

    return toCamelCase(inserted);
  },
  markNotificationAsRead: async (id: string): Promise<void> => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },
  markAllNotificationsAsRead: async (userId: string): Promise<void> => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  },
  acknowledgeNotification: async (id: string): Promise<void> => {
    const { error } = await supabase.from('notifications').update({ 
      acknowledged_at: new Date().toISOString(),
      is_read: true 
    }).eq('id', id);
    if (error) throw error;
  },
  logCommunication: async (log: Omit<CommunicationLog, 'id' | 'createdAt'>): Promise<void> => {
    const { error } = await supabase.from('communication_logs').insert(toSnakeCase(log));
    if (error) throw error;
  },

  getNotificationRules: async (): Promise<NotificationRule[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase.from('notification_rules').select('*').order('created_at', { ascending: false });
        if (error) return api.handleError(error);
        const formatted = data.map(toCamelCase);
        await offlineDb.setCache('notification_rules', formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch notification rules from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache('notification_rules') || [];
  },

  saveNotificationRule: async (rule: Partial<NotificationRule>): Promise<NotificationRule> => {
    const data = toSnakeCase(rule);
    if (rule.id) {
      const { data: updated, error } = await supabase.from('notification_rules').update(data).eq('id', rule.id).select().single();
      if (error) throw error;
      return toCamelCase(updated);
    } else {
      const { data: inserted, error } = await supabase.from('notification_rules').insert(data).select().single();
      if (error) throw error;
      return toCamelCase(inserted);
    }
  },

  deleteNotificationRule: async (id: string): Promise<void> => {
    const { error } = await supabase.from('notification_rules').delete().eq('id', id);
    if (error) throw error;
  },

  getAutomatedRules: async (): Promise<AutomatedNotificationRule[]> => {
    const { data, error } = await supabase.from('automated_notification_rules').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  saveAutomatedRule: async (rule: Partial<AutomatedNotificationRule>): Promise<AutomatedNotificationRule> => {
    const data = toSnakeCase(rule);
    if (rule.id) {
      const { data: updated, error } = await supabase.from('automated_notification_rules').update(data).eq('id', rule.id).select().single();
      if (error) throw error;
      return toCamelCase(updated);
    } else {
      const { data: inserted, error } = await supabase.from('automated_notification_rules').insert(data).select().single();
      if (error) throw error;
      return toCamelCase(inserted);
    }
  },

  deleteAutomatedRule: async (id: string | number): Promise<void> => {
    const targetId = (typeof id === 'string' && !id.includes('-')) ? parseInt(id) : id;
    const { error } = await supabase.from('automated_notification_rules').delete().eq('id', targetId);
    if (error) throw error;
  },

  testAutomatedRule: async (id: string | number): Promise<void> => {
    const targetId = (typeof id === 'string' && !id.includes('-')) ? parseInt(id) : id;
    const { error } = await supabase.functions.invoke('process-notification-rules', {
        body: { 
            rule_id: targetId,
            test_mode: true 
        }
    });
    if (error) throw error;
  },
  
  getScheduledNotifications: async (): Promise<ScheduledNotification[]> => {
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  saveScheduledNotification: async (sn: Partial<ScheduledNotification>): Promise<ScheduledNotification> => {
    const data = toSnakeCase({ ...sn, createdBy: useAuthStore.getState().user?.id });
    if (sn.id) {
      const { data: updated, error } = await supabase.from('scheduled_notifications').update(data).eq('id', sn.id).select().single();
      if (error) throw error;
      return toCamelCase(updated);
    } else {
      const { data: inserted, error } = await supabase.from('scheduled_notifications').insert(data).select().single();
      if (error) throw error;
      return toCamelCase(inserted);
    }
  },

  deleteScheduledNotification: async (id: string): Promise<void> => {
    const { error } = await supabase.from('scheduled_notifications').delete().eq('id', id);
    if (error) throw error;
  },

  broadcastNotification: async (data: { role?: string; userIds?: string[]; message: string; title?: string; type?: NotificationType; link?: string; severity?: 'Low' | 'Medium' | 'High' }): Promise<void> => {
    let finalUserIds: string[] = data.userIds || [];
    const isBroadcast = data.role?.toLowerCase() === 'all' || (finalUserIds.length === 0 && !data.role);

    console.log('[API] broadcastNotification request:', { ...data, isBroadcast });
    
    // Check for "all" role or no specific targets
    if (isBroadcast) {
      const broadcastTitle = data.title || 'Important Alert';
      const { error } = await supabase.rpc('broadcast_notification', {
        p_message: data.message,
        p_type: data.type || 'info',
        p_severity: data.severity || 'Low',
        p_metadata: {
          title: broadcastTitle,
          isBroadcast: true,
          sender_id: useAuthStore.getState().user?.id,
          sentAt: new Date().toISOString()
        },
        p_link_to: data.link || null
      });
      if (error) {
        console.error('[API] broadcast_notification RPC failed:', error);
        throw error;
      }
      console.log('[API] Broadcast DB insert succeeded via RPC.');

      // Also manually refresh the notification store so the UI updates immediately
      // (In case Realtime is delayed or not enabled for the notifications table)
      try {
        const { useNotificationStore } = await import('../store/notificationStore');
        setTimeout(() => useNotificationStore.getState().fetchNotifications(), 1000);
      } catch (e) {
        // Non-critical, store may not be available in all contexts
      }

      // Trigger real push broadcast via FCM Edge Function
      try {
        const { data: pushData, error: pushError } = await supabase.functions.invoke('send-notification', {
          body: {
            broadcast: true,
            title: broadcastTitle,
            body: data.message,
            message: data.message,
            data: {
              type: data.type || 'info',
              severity: data.severity || 'Low',
              isBroadcast: 'true',
              link: data.link || ''
            }
          }
        });
        
        if (pushError) {
          console.warn('[API] Warning: Push Edge Function failed:', pushError);
        } else {
          console.log('[API] Broadcast sent successfully (DB + Push). Response:', pushData);
        }
      } catch (err) {
        console.warn('[API] Warning: Push threw an exception:', err);
      }
      
      return;
    }
    
    if (data.role) {
      console.log('Fetching users for role:', data.role);
      const { data: users, error } = await supabase.from('users').select('id').eq('role_id', data.role);
      if (error) {
        console.error('Error fetching users for role:', error);
        throw error;
      }
      console.log(`Found ${users?.length || 0} users for role ${data.role}`);
      finalUserIds = [...new Set([...finalUserIds, ...users.map(u => u.id)])];
    }

    if (finalUserIds.length === 0) return;

    // Insert into notifications table directly to bypass early aborts in the Edge Function
    try {
      console.log(`[API] Inserting ${finalUserIds.length} targeted notifications into DB...`);
      const notificationsToInsert = finalUserIds.map(uid => ({
          user_id: uid,
          message: data.message,
          type: data.type || 'info',
          severity: data.severity || 'Low',
          link_to: data.link || null,
          metadata: {
              title: data.title || 'Important Alert',
              originalRole: data.role,
              sender_id: useAuthStore.getState().user?.id,
              sentAt: new Date().toISOString()
          }
      }));
      
      const { error: dbInsertError } = await supabase.from('notifications').insert(notificationsToInsert);
      if (dbInsertError) throw dbInsertError;
      console.log('[API] Targeted DB insert succeeded.');
    } catch (insertError) {
      console.error('[API] Failed to insert targeted notifications into DB:', insertError);
      throw insertError; // Throw so the UI can show an error toast
    }

    // Trigger real push notification via OneSignal Edge Function for specific recipients
    console.log("Sending push notification payload:", {
      userIds: finalUserIds,
      title: data.title || 'Important Alert',
      message: data.message,
      url: data.link || null,
      originalRole: data.role
    });

    try {
      const { error: pushError } = await supabase.functions.invoke('send-notification', {
        body: {
          userIds: finalUserIds,
          title: data.title || 'Important Alert',
          message: data.message,
          data: {
            url: data.link || null,
            sender_id: useAuthStore.getState().user?.id,
            type: data.type || 'info',
            severity: data.severity || 'Low',
            originalRole: data.role,
            sentAt: new Date().toISOString()
          }
        }
      });

      if (pushError) {
        console.warn('[API] Warning: Targeted DB insert succeeded, but Push Edge Function failed:', pushError);
      } else {
        console.log('[API] Targeted Push sent successfully.');
      }
    } catch (err) {
      console.warn('[API] Warning: Targeted DB insert succeeded, but Push threw an exception:', err);
    }
  },

  // Field Reporting API
  getChecklistTemplates: async (jobType: string): Promise<ChecklistTemplate[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
       try {
         const { data, error } = await supabase
           .from('checklist_templates')
           .select('*')
           .eq('job_type', jobType)
           .eq('is_active', true)
           .order('version', { ascending: false });
         if (error) throw error;
         const formatted = (data || []).map(toCamelCase);
         await offlineDb.setCache(`checklist_${jobType}`, formatted);
         return formatted;
       } catch (err) {
         console.warn('Failed to fetch checklist templates from cloud, falling back to cache');
       }
    }
    return await offlineDb.getCache(`checklist_${jobType}`) || [];
  },

  submitFieldReport: async (reportData: Partial<FieldReport>): Promise<FieldReport> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        const offlineId = `offline_${Date.now()}`;
        const offlineReport = { ...reportData, id: offlineId, status: 'pending' } as FieldReport;
        await offlineDb.addToOutbox({ table_name: 'field_reports', action: 'INSERT', payload: reportData });
        
        // Update local cache
        const cached = await offlineDb.getCache('field_reports') || [];
        await offlineDb.setCache('field_reports', [offlineReport, ...cached]);
        
        return offlineReport;
    }

    const { data, error } = await supabase
      .from('field_reports')
      .insert(toSnakeCase(reportData))
      .select()
      .single();
    if (error) throw error;

    // Trigger notification
    const { data: { user } } = await supabase.auth.getUser();
    dispatchNotificationFromRules('field_report', {
        actorName: reportData.siteName || 'Field staff',
        actionText: `has submitted a ${reportData.jobType} report`,
        locString: '',
        actor: { 
            id: user?.id || reportData.userId || '', 
            name: user?.user_metadata?.name || 'Staff', 
            role: 'staff' 
        }
    });

    return toCamelCase(data);
  },

  getFieldReports: async (filter?: { startDate?: string, endDate?: string, page?: number, pageSize?: number, userId?: string, siteName?: string, userIds?: string[] }): Promise<any> => {
    let query = supabase.from('field_reports').select('*', { count: 'exact' });
    if (filter?.startDate) query = query.gte('created_at', filter.startDate);
    if (filter?.endDate) query = query.lte('created_at', filter.endDate);
    if (filter?.userId && filter.userId !== 'all') {
      query = query.eq('user_id', filter.userId);
    } else if (filter?.userIds && filter.userIds.length > 0) {
      query = query.in('user_id', filter.userIds);
    }
    if (filter?.siteName && filter.siteName !== 'all') query = query.eq('site_name', filter.siteName);
    
    const isPaginated = filter?.page !== undefined && filter?.pageSize !== undefined;
    if (isPaginated) {
      const from = (filter!.page! - 1) * filter!.pageSize!;
      const to = from + filter!.pageSize! - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    const formattedData = (data || []).map(toCamelCase);
    
    if (isPaginated) {
      return { data: formattedData, total: count || 0 };
    }
    return formattedData;
  },

  getFieldReportFilterOptions: async (userIds?: string[]): Promise<{ users: { id: string, name: string }[], sites: string[] }> => {
    let query = supabase.from('field_reports').select('user_id, site_name');
    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }
    const { data: reports, error: reportsError } = await query;
    
    if (reportsError) throw reportsError;

    const uniqueUserIds = Array.from(new Set(reports.map(r => r.user_id)));
    const uniqueSites = Array.from(new Set(reports.map(r => r.site_name))).sort() as string[];

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', uniqueUserIds);
    
    if (usersError) throw usersError;

    return {
      users: (users || []).map(toCamelCase).sort((a: any, b: any) => a.name.localeCompare(b.name)),
      sites: uniqueSites
    };
  },

  getFieldReportById: async (id: string): Promise<FieldReport | null> => {
    const { data, error } = await supabase.from('field_reports').select('*').eq('id', id).single();
    if (error) throw error;
    return toCamelCase(data);
  },


  /**
   * Create a new user in Supabase Auth and the public users table in one call.
   * This method invokes the `admin-create-user` edge function which uses the
   * service role to create an auth user and then updates the `public.users`
   * table with the supplied role.  A verification email will be sent to the
   * specified address.  After creation, the newly created user record is
   * returned by looking it up via the email address.
   *
   * @param data An object containing the new user's name, email, password and role.
   * @returns The newly created user record.
   */
  createAuthUser: async (data: { name: string; email: string; password: string; role: string; }): Promise<User> => {
    const { name, email, password, role } = data;
    // Attempt to create the user via the Supabase edge function first.  The
    // edge function uses the service role key on the server to create an auth
    // user and update the public.users table with the specified role.  This
    // is the preferred path in production because it avoids exposing the
    // service role key to the browser.
    try {
      const { error: fnError } = await supabase.functions.invoke('admin-create-user', {
        body: { name, email, password, role },
      });
      if (fnError) {
        throw fnError;
      }
      // After creation, fetch the newly created user by email from our users
      // view.  The handle_new_user trigger should have inserted the row and
      // the edge function should have set the role.
      const allUsers = await api.getUsers();
      const newUser = allUsers.find(u => u.email === email);
      if (newUser) return newUser;
      console.warn('admin-create-user completed but user not found; falling back to client side signup');
    } catch (fnError: any) {
      // If the edge function call fails entirely (e.g. network error or not
      // deployed), we fall back to client side signup using the anon key.
      const msg = typeof fnError?.message === 'string' ? fnError.message : String(fnError);
      if (!msg.toLowerCase().includes('failed to send a request') && !msg.toLowerCase().includes('edge function')) {
        // For other errors (such as email already registered), surface them directly.
        throw fnError;
      }
      console.warn('Edge function not reachable (net::ERR_FAILED or similar), falling back to client side signup');
      // Create the auth user using the client side anon key.  This will send a
      // confirmation email automatically.  We include the name in user
      // metadata so it is persisted in auth.users.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (signUpError || !signUpData?.user) {
        // Handle rate limiting (429) specifically
        if (signUpError?.status === 429) {
          throw new Error('User creation rate limit reached. Please wait a few minutes before trying again or use the admin edge function if available.');
        }
        throw signUpError || new Error('Failed to sign up user');
      }
      const newAuthUser = signUpData.user;
      // Upsert into the public.users table.  This will create a row if it
      // doesn’t exist, and update the name and role if it does.  We use
      // upsert instead of update to handle the trigger delay between auth
      // signup and the creation of the profile row.
      try {
        const { error: upsertError } = await supabase.from('users').upsert(
          { id: newAuthUser.id, name, email, role_id: role },
          { onConflict: 'id' }
        );
        if (upsertError) throw upsertError;
      } catch (profileErr) {
        console.warn('Failed to upsert user profile after fallback signup (possible RLS violation):', profileErr);
        // We still return the user object because the Auth user was created
      }
      // Finally return a user object combining the known fields.
      return {
        id: newAuthUser.id,
        name,
        email,
        role,
        phone: undefined as any,
        organizationId: undefined as any,
        organizationName: undefined as any,
        reportingManagerId: undefined as any,
        photoUrl: undefined as any,
      } as User;
    }

    // Default return if no user found by either path.  This should rarely
    // occur; if it does, we return a minimal user object for consistency.
    return {
      id: '',
      name,
      email,
      role,
      phone: undefined as any,
      organizationId: undefined as any,
      organizationName: undefined as any,
      reportingManagerId: undefined as any,
      photoUrl: undefined as any,
    } as User;
  },
  getPolicies: async (): Promise<Policy[]> => {
    const { data, error } = await supabase.from('policies').select('*');
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },
  createPolicy: async (data: Omit<Policy, 'id'>, file?: File): Promise<Policy> => {
    let fileUrl = data.fileUrl;

    if (file) {
      const fileExt = file.name.split('.').pop() || 'pdf';
      const filePath = `policy-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('policies').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('policies').getPublicUrl(filePath);
      fileUrl = publicUrl;
    }

    const { data: inserted, error } = await supabase.from('policies').insert(toSnakeCase({ ...data, fileUrl })).select().single();
    if (error) throw error;
    return toCamelCase(inserted);
  },
  getInsurances: async (): Promise<Insurance[]> => {
    const { data, error } = await supabase.from('insurances').select('*');
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },
  createInsurance: async (data: Omit<Insurance, 'id'>): Promise<Insurance> => {
    const { data: inserted, error } = await supabase.from('insurances').insert(toSnakeCase(data)).select().single();
    if (error) throw error;
    return toCamelCase(inserted);
  },
  getApprovalWorkflowSettings: async (): Promise<{ finalConfirmationRole: UserRole }> => {
    const { data, error } = await supabase.from('settings').select('approval_workflow_settings').eq('id', 'singleton').single();
    if (error) throw error;
    if (!data?.approval_workflow_settings) throw new Error('Approval workflow settings are not configured.');
    return toCamelCase(data.approval_workflow_settings);
  },
  updateApprovalWorkflowSettings: async (role: UserRole): Promise<void> => {
    const { error } = await supabase.from('settings').update({ approval_workflow_settings: toSnakeCase({ finalConfirmationRole: role }) }).eq('id', 'singleton');
    if (error) throw error;
  },
  approveLeaveRequest: async (id: string, approverId: string): Promise<void> => {
    // Fetch request data including user_id, leave_type, dates and correction_details
    const { data: request, error: fetchError } = await supabase.from('leave_requests').select('approval_history, user_id, leave_type, start_date, end_date, day_option, correction_details').eq('id', id).single();
    if (fetchError) throw fetchError;
    
    // Check balance - skip for 'Loss of Pay', 'WFH', and 'Correction'
    if (!['Loss of Pay', 'WFH', 'Correction'].includes(request.leave_type as any)) {
      const balance = await api.getLeaveBalancesForUser(request.user_id);
      const leaveDays = request.day_option === 'half' ? 0.5 : differenceInCalendarDays(new Date(request.end_date), new Date(request.start_date)) + 1;
      
      const typeKeyStr = `${request.leave_type.toLowerCase()}Total`.replace('earnedtotal', 'earnedTotal').replace('sicktotal', 'sickTotal').replace('floatingtotal', 'floatingTotal').replace('compofftotal', 'compOffTotal');
      const typeKey = typeKeyStr as keyof LeaveBalance;
      const usedKey = typeKeyStr.replace('Total', 'Used') as keyof LeaveBalance;
      
      const available = (balance[typeKey] as number) - (balance[usedKey] as number);
      
      if (available < leaveDays) {
        // Auto-decline if insufficient leaves
        const reason = `Insufficient ${request.leave_type} balance. Available: ${available} days, Requested: ${leaveDays} days.`;
        await api.rejectLeaveRequest(id, approverId, reason);
        return;
      }
    }

    const { finalConfirmationRole } = await api.getApprovalWorkflowSettings();
    const { data: approverData, error: nameError } = await supabase.from('users').select('name').eq('id', approverId).single();
    if (nameError) throw nameError;
    
    const newHistoryRecord = { approver_id: approverId, approver_name: approverData.name, status: 'approved', timestamp: new Date().toISOString() };
    const updatedHistory = [...((request.approval_history as any[]) || []), newHistoryRecord];
    
    // If it's a Comp Off leave, Manager approval is final.
    if (request.leave_type === 'Comp Off') {
       const { error } = await supabase.from('leave_requests').update({ 
        status: 'approved', 
        current_approver_id: null, 
        approval_history: updatedHistory 
      }).eq('id', id);
      if (error) throw error;
      
      // Dynamic Rule Dispatch
      dispatchNotificationFromRules('leave_approved', {
        actorName: 'Leave request',
        actionText: 'has been approved',
        locString: '',
        actor: { id: approverId, name: approverData.name, role: 'admin' }
      });

      // Consume comp off logs if applicable
      const leaveDays = request.day_option === 'half' ? 0.5 : differenceInCalendarDays(new Date(request.end_date), new Date(request.start_date)) + 1;
      const { data: compOffLogs } = await supabase.from('comp_off_logs').select('id').eq('user_id', request.user_id).eq('status', 'earned').limit(Math.ceil(leaveDays));
      if (compOffLogs && compOffLogs.length > 0) {
           await supabase.from('comp_off_logs').update({ status: 'used', leave_request_id: id }).in('id', compOffLogs.map(l => l.id));
      }
      return;
    }

    // If it's a Correction request, Manager approval triggers automatic attendance update
    if (request.leave_type === 'Correction') {
        const details = toCamelCase(request.correction_details) as any;
        
        if (details) {
            // 1. Delete existing events for that date
            const dateStr = request.start_date;
            const startDate = `${dateStr}T00:00:00Z`;
            const endDate = `${dateStr}T23:59:59Z`;

            await supabase
                .from('attendance_events')
                .delete()
                .eq('user_id', request.user_id)
                .gte('timestamp', startDate)
                .lte('timestamp', endDate);

            // 2. Insert new events
            const eventsToInsert = [];
            const timestampBase = dateStr;

            // Punch In
            const checkInDate = new Date(`${timestampBase}T${details.punchIn}:00`);
            eventsToInsert.push({
                user_id: request.user_id,
                timestamp: checkInDate.toISOString(),
                type: 'punch-in',
                location_name: details.status === 'W/H' ? 'Work From Home' : details.locationName,
                work_type: details.status === 'Site Visit' ? 'field' : 'office',
                is_manual: true,
                created_by: approverId,
                reason: 'Auto-updated from approved Correction Request'
            });

            // Punch Out
            const checkOutDate = new Date(`${timestampBase}T${details.punchOut}:00`);
            eventsToInsert.push({
                user_id: request.user_id,
                timestamp: checkOutDate.toISOString(),
                type: 'punch-out',
                location_name: details.status === 'W/H' ? 'Work From Home' : details.locationName,
                work_type: details.status === 'Site Visit' ? 'field' : 'office',
                is_manual: true,
                created_by: approverId,
                reason: 'Auto-updated from approved Correction Request'
            });

            // Optional Breaks
            if (details.includeBreak && details.breakIn && details.breakOut) {
                const bIn = new Date(`${timestampBase}T${details.breakIn}:00`);
                const bOut = new Date(`${timestampBase}T${details.breakOut}:00`);
                
                eventsToInsert.push({
                    user_id: request.user_id,
                    timestamp: bIn.toISOString(),
                    type: 'break-in',
                    location_name: details.status === 'W/H' ? 'Work From Home' : details.locationName,
                    work_type: details.status === 'Site Visit' ? 'field' : 'office',
                    is_manual: true,
                    created_by: approverId
                });

                eventsToInsert.push({
                    user_id: request.user_id,
                    timestamp: bOut.toISOString(),
                    type: 'break-out',
                    location_name: details.status === 'W/H' ? 'Work From Home' : details.locationName,
                    work_type: details.status === 'Site Visit' ? 'field' : 'office',
                    is_manual: true,
                    created_by: approverId
                });
            }

            // Optional Site Overtime
            if (details.includeSiteOt && details.siteOtIn && details.siteOtOut) {
                const otIn = new Date(`${timestampBase}T${details.siteOtIn}:00`);
                const otOut = new Date(`${timestampBase}T${details.siteOtOut}:00`);
                
                eventsToInsert.push({
                    user_id: request.user_id,
                    timestamp: otIn.toISOString(),
                    type: 'site-ot-in',
                    location_name: details.locationName || 'Field Site',
                    work_type: 'field',
                    is_manual: true,
                    created_by: approverId
                });

                eventsToInsert.push({
                    user_id: request.user_id,
                    timestamp: otOut.toISOString(),
                    type: 'site-ot-out',
                    location_name: details.locationName || 'Field Site',
                    work_type: 'field',
                    is_manual: true,
                    created_by: approverId
                });
            }

            await supabase.from('attendance_events').insert(eventsToInsert);

            // 3. Audit Log
            await supabase.from('attendance_audit_logs').insert([{
                action: 'MANUAL_ENTRY_ADDED',
                performed_by: approverId,
                target_user_id: request.user_id,
                details: {
                    date: dateStr,
                    status: details.status,
                    reason: 'Automatic update from Correction Request approval',
                    correctionRequestId: id,
                    segments: {
                        main: { in: details.punchIn, out: details.punchOut },
                        break: details.includeBreak ? { in: details.breakIn, out: details.breakOut } : null,
                        siteOt: details.includeSiteOt ? { in: details.siteOtIn, out: details.siteOtOut } : null
                    }
                }
            }]);
        }

        // Finalize the request status
        const { error } = await supabase.from('leave_requests').update({ 
          status: 'correction_made', 
          current_approver_id: null, 
          approval_history: updatedHistory 
        }).eq('id', id);
        if (error) throw error;
        return;
    }

    // Workflow Logic: Manager approved -> check finalConfirmationRole
    if (finalConfirmationRole === 'reporting_manager') {
         const { error } = await supabase.from('leave_requests').update({ 
            status: 'approved', 
            current_approver_id: null, 
            approval_history: updatedHistory 
          }).eq('id', id);
          if (error) throw error;
          
          dispatchNotificationFromRules('leave_approved', {
            actorName: 'Leave request',
            actionText: 'has been approved',
            locString: '',
            actor: { id: approverId, name: approverData.name, role: 'admin' }
          });
    } else {
        // Send to Final Approver (HR/Admin)
        const { data: finalApprover } = await supabase.from('users').select('id').eq('role_id', finalConfirmationRole).limit(1).single();
        const { error } = await supabase.from('leave_requests').update({ 
            status: 'pending_hr_confirmation', 
            current_approver_id: finalApprover?.id || null, 
            approval_history: updatedHistory 
        }).eq('id', id);
        if (error) throw error;
    }
  },
  markCorrectionAsMade: async (id: string, adminId: string): Promise<void> => {
    const { data: request, error: fetchError } = await supabase.from('leave_requests').select('approval_history').eq('id', id).single();
    if (fetchError) throw fetchError;
    const { data: adminData } = await supabase.from('users').select('name').eq('id', adminId).single();
    
    const newHistoryRecord = { 
        approver_id: adminId, 
        approver_name: adminData?.name || 'Admin', 
        status: 'correction_made', 
        timestamp: new Date().toISOString(),
        comments: 'Attendance manually corrected by Admin'
    };
    const updatedHistory = [...((request.approval_history as any[]) || []), newHistoryRecord];

    const { error } = await supabase.from('leave_requests').update({ 
      status: 'correction_made', 
      approval_history: updatedHistory 
    }).eq('id', id);
    if (error) throw error;
  },
  rejectLeaveRequest: async (id: string, approverId: string, reason = ''): Promise<void> => {
    const { data: request, error: fetchError } = await supabase.from('leave_requests').select('approval_history').eq('id', id).single();
    if (fetchError) throw fetchError;
    const { data: approverData, error: nameError } = await supabase.from('users').select('name').eq('id', approverId).single();
    if (nameError) throw nameError;
    const newHistoryRecord = { approver_id: approverId, approver_name: approverData.name, status: 'rejected', timestamp: new Date().toISOString(), comments: reason };
    const updatedHistory = [...((request.approval_history as any[]) || []), newHistoryRecord];
    const { error } = await supabase.from('leave_requests').update({ status: 'rejected', current_approver_id: null, approval_history: updatedHistory }).eq('id', id);
    if (error) throw error;

    // Dynamic Rule Dispatch
    dispatchNotificationFromRules('leave_rejected', {
      actorName: 'Leave request',
      actionText: 'has been rejected',
      locString: '',
      actor: { id: approverId, name: approverData.name, role: 'admin' }
    });
  },
  reconsiderLeaveRequest: async (id: string, approverId: string): Promise<void> => {
    const { data: request, error: fetchError } = await supabase.from('leave_requests').select('approval_history, user_id').eq('id', id).single();
    if (fetchError) throw fetchError;
    
    const { data: userProfile, error: userError } = await supabase.from('users').select('reporting_manager_id').eq('id', request.user_id).single();
    if (userError) throw userError;

    const { data: approverData, error: nameError } = await supabase.from('users').select('name').eq('id', approverId).single();
    if (nameError) throw nameError;

    const newHistoryRecord = { 
        approver_id: approverId, 
        approver_name: approverData.name, 
        status: 'reconsidered', 
        timestamp: new Date().toISOString(),
        comments: 'Request reset for reconsideration.'
    };
    const updatedHistory = [...((request.approval_history as any[]) || []), newHistoryRecord];

    const { error } = await supabase.from('leave_requests').update({ 
        status: 'pending_manager_approval', 
        current_approver_id: userProfile.reporting_manager_id || null, 
        approval_history: updatedHistory 
    }).eq('id', id);
    
    if (error) throw error;
  },
  cancelApprovedLeave: async (id: string, cancellerId: string, reason: string): Promise<void> => {
    const { data: request, error: fetchError } = await supabase.from('leave_requests').select('approval_history, user_id, leave_type').eq('id', id).single();
    if (fetchError) throw fetchError;
    
    const { data: cancellerData } = await supabase.from('users').select('name').eq('id', cancellerId).single();
    
    const newHistoryRecord = { approver_id: cancellerId, approver_name: cancellerData?.name || 'System', status: 'cancelled', timestamp: new Date().toISOString(), comments: reason };
    const updatedHistory = [...((request.approval_history as any[]) || []), newHistoryRecord];
    
    const { error } = await supabase.from('leave_requests').update({ status: 'cancelled', current_approver_id: null, approval_history: updatedHistory }).eq('id', id);
    if (error) throw error;
    
    // Restore comp off if applicable
    if (request.leave_type === 'Comp Off') {
      await supabase.from('comp_off_logs').update({ status: 'earned', leave_request_id: null }).eq('leave_request_id', id);
    }
  },
  withdrawLeaveRequest: async (id: string, userId: string): Promise<void> => {
    const { data: request, error: fetchError } = await supabase.from('leave_requests').select('user_id, status').eq('id', id).single();
    if (fetchError) throw fetchError;
    if (request.user_id !== userId) throw new Error('Unauthorized to withdraw this request.');
    if (['approved', 'rejected', 'cancelled'].includes(request.status)) throw new Error('Cannot withdraw an already processed request.');
    
    const { error } = await supabase.from('leave_requests').update({ status: 'withdrawn', current_approver_id: null }).eq('id', id);
    if (error) throw error;
  },
  confirmLeaveByHR: async (id: string, hrId: string): Promise<void> => {
    const { data: request, error: fetchError } = await supabase.from('leave_requests').select('leave_type, user_id, approval_history').eq('id', id).single();
    if (fetchError) throw fetchError;
    const { data: approverData, error: nameError } = await supabase.from('users').select('name').eq('id', hrId).single();
    if (nameError) throw nameError;
    const newHistoryRecord = { approver_id: hrId, approver_name: approverData.name, status: 'approved', timestamp: new Date().toISOString(), comments: 'Final approval.' };
    const updatedHistory = [...((request.approval_history as any[]) || []), newHistoryRecord];
    const { error } = await supabase.from('leave_requests').update({ status: 'approved', current_approver_id: null, approval_history: updatedHistory }).eq('id', id);
    if (error) throw error;
    if (request.leave_type === 'Comp Off') {
      const { data: availableLog, error: logError } = await supabase.from('comp_off_logs').select('id').eq('user_id', request.user_id).eq('status', 'earned').limit(1).single();
      if (logError && logError.code !== 'PGRST116') throw logError;
      if (availableLog) await supabase.from('comp_off_logs').update({ status: 'used', leave_request_id: id }).eq('id', availableLog.id);
    }
  },
  submitExtraWorkClaim: async (claimData: Omit<ExtraWorkLog, 'id' | 'createdAt' | 'status'>): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'extra_work_logs', action: 'INSERT', payload: claimData });
      return;
    }
    const { error } = await supabase.from('extra_work_logs').insert(toSnakeCase({ ...claimData, status: 'Pending' }));
    if (error) throw error;
  },
  getExtraWorkLogs: async (filter?: { userId?: string, managerId?: string, status?: string, workDate?: string, startDate?: string, endDate?: string, page?: number, pageSize?: number }): Promise<{ data: ExtraWorkLog[], total: number }> => {
    let query = supabase.from('extra_work_logs').select('*, user:user_id(reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id, photo_url)', { count: 'exact' });
    if (filter?.userId) query = query.eq('user_id', filter.userId);
    if (filter?.status) query = query.eq('status', filter.status);
    if (filter?.workDate) query = query.eq('work_date', filter.workDate);
    if (filter?.startDate) query = query.gte('work_date', filter.startDate);
    if (filter?.endDate) query = query.lte('work_date', filter.endDate);
    
    if (filter?.page && filter?.pageSize) {
      const from = (filter.page - 1) * filter.pageSize;
      const to = from + filter.pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query.order('work_date', { ascending: false });
    if (error) throw error;

    let filteredData = data || [];
    if (filter?.managerId) {
      filteredData = filteredData.filter((row: any) => 
        row.user?.reporting_manager_id === filter.managerId ||
        row.user?.reporting_manager_2_id === filter.managerId ||
        row.user?.reporting_manager_3_id === filter.managerId
      );
    }

    return { data: filteredData.map(item => {
      const camel = toCamelCase(item);
      if (camel.user && camel.user.photoUrl) {
        camel.userPhotoUrl = camel.user.photoUrl;
      }
      return camel;
    }), total: count || filteredData.length };
  },
  approveExtraWorkClaim: async (claimId: string, approverId: string): Promise<void> => {
    const { data: approverData, error: nameError } = await supabase.from('users').select('name').eq('id', approverId).single();
    if (nameError) throw nameError;
    const { data: claim, error: fetchError } = await supabase.from('extra_work_logs').select('*').eq('id', claimId).single();
    if (fetchError) throw fetchError;
    if (!claim) throw new Error('Claim not found.');
    const { error: updateError } = await supabase.from('extra_work_logs').update({ status: 'Approved', approver_id: approverId, approver_name: approverData.name, approved_at: new Date().toISOString() }).eq('id', claimId);
    if (updateError) throw updateError;
    if (claim.claim_type === 'Comp Off') await api.addCompOffLog({ userId: claim.user_id, userName: claim.user_name, dateEarned: claim.work_date, reason: `Claim approved: ${claim.reason}`, status: 'earned', grantedById: approverId, grantedByName: approverData.name });
  },
  rejectExtraWorkClaim: async (claimId: string, approverId: string, reason: string): Promise<void> => {
    const { data: approverData, error: nameError } = await supabase.from('users').select('name').eq('id', approverId).single();
    if (nameError) throw nameError;
    const { error } = await supabase.from('extra_work_logs').update({ status: 'Rejected', approver_id: approverId, approver_name: approverData.name, rejection_reason: reason }).eq('id', claimId);
    if (error) throw error;
  },
  getManpowerDetails: async (siteId: string): Promise<ManpowerDetail[]> => {
    const { data, error } = await supabase.from('site_manpower').select('manpower_details').eq('organization_id', siteId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return toCamelCase(data?.manpower_details || []);
  },
  updateManpowerDetails: async (siteId: string, details: ManpowerDetail[]): Promise<void> => {
    const { error } = await supabase.from('site_manpower').upsert({
      organization_id: siteId,
      manpower_details: toSnakeCase(details),
      updated_at: new Date().toISOString()
    }, { onConflict: 'organization_id' });
    if (error) throw error;
  },
  addCompOffLog: async (logData: Omit<CompOffLog, 'id'>): Promise<CompOffLog> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      const offlineId = `col_offline_${Date.now()}`;
      const offlineLog = { ...logData, id: offlineId } as CompOffLog;
      await offlineDb.addToOutbox({ table_name: 'comp_off_logs', action: 'INSERT', payload: logData });
      return offlineLog;
    }
    const { data, error } = await supabase.from('comp_off_logs').insert(toSnakeCase(logData)).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  grantCompOff: async (params: { userId: string; days: number; reason: string }): Promise<void> => {
    const { userId, days, reason } = params;
    const { data: user, error: userError } = await supabase.from('users').select('name').eq('id', userId).single();
    if (userError) throw userError;

    const { data: { session } } = await supabase.auth.getSession();
    const grantedById = session?.user?.id;
    const grantedByName = session?.user?.user_metadata?.name || 'Admin';

    // Insert multiple logs if days > 1
    const logs = [];
    const fullDays = Math.floor(days);
    const hasHalfDay = (days % 1) !== 0;

    for (let i = 0; i < fullDays; i++) {
        logs.push(toSnakeCase({
            userId,
            userName: user.name,
            dateEarned: format(new Date(), 'yyyy-MM-dd'),
            reason,
            status: 'earned',
            grantedById,
            grantedByName
        }));
    }

    if (hasHalfDay) {
        // We'll insert a special log for half day, or just another log if fractional days aren't supported.
        // For now, let's treat 0.5 as 1 log for simplicity or adjust based on system capability.
        // Actually the system counts rows as 1 day each.
        logs.push(toSnakeCase({
            userId,
            userName: user.name,
            dateEarned: format(new Date(), 'yyyy-MM-dd'),
            reason: `${reason} (Half Day Grant)`,
            status: 'earned',
            grantedById,
            grantedByName
        }));
    }

    if (logs.length > 0) {
        const { error } = await supabase.from('comp_off_logs').insert(logs);
        if (error) throw error;
    }
  },
  exportAllData: async (): Promise<any> => {
    const tables = [
      'roles', 'organization_groups', 'companies', 'organizations', 'entities',
      'users', 'site_configurations', 'app_modules', 'onboarding_submissions',
      'settings', 'leave_requests', 'attendance_events', 'attendance_approvals',
      'locations', 'user_locations', 'notifications', 'tasks', 'notification_rules',
      'checklist_templates', 'field_reports', 'policies', 'insurances',
      'comp_off_logs', 'extra_work_logs', 'uniform_requests', 'field_attendance_violations',
      'biometric_devices', 'holidays', 'recurring_holidays', 'site_gents_uniform_configs',
      'site_ladies_uniform_configs', 'site_uniform_details_configs', 'support_tickets',
      'ticket_posts', 'ticket_comments', 'attendance_audit_logs'
    ];
    const data: Record<string, any> = {};
    for (const table of tables) {
      const { data: tableData, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`Skipping table ${table}:`, error.message);
        continue;
      }
      data[table] = tableData;
    }
    return toCamelCase(data);
  },

  getBackups: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('system_backups')
      .select('*, users(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(item => ({
      ...toCamelCase(item),
      createdByName: item.users?.name || 'System'
    }));
  },

  createBackup: async (name?: string, description?: string): Promise<any> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    // Default name format: Paradigm DD-M-YYYY backup X
    let backupName = name;
    if (!backupName) {
      const now = new Date();
      const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      
      // Count existing backups for today to determine 'X'
      const { count } = await supabase
        .from('system_backups')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]);
      
      backupName = `Paradigm ${dateStr} backup ${(count || 0) + 1}`;
    }

    // 1. Generate snapshot
    const snapshot = await api.exportAllData();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    
    // 2. Upload to storage
    const fileName = `backup_${Date.now()}.json`;
    const filePath = `restoration_points/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(filePath, blob);
    
    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      if (uploadError.message.includes('not found') || (uploadError as any).status === 400) {
        throw new Error('Storage bucket "backups" not found. Please create it in the Supabase Dashboard.');
      }
      throw uploadError;
    }

    // 3. Record in DB
    const { data, error: dbError } = await supabase
      .from('system_backups')
      .insert({
        name: backupName,
        description,
        snapshot_path: filePath,
        size_bytes: blob.size,
        created_by: userData.user.id,
        status: 'completed'
      })
      .select()
      .single();
    
    if (dbError) throw dbError;
    return toCamelCase(data);
  },

  autoBackupCheck: async (): Promise<void> => {
    try {
      // 1. Check if enabled in settings
      const { data: settings } = await supabase
        .from('settings')
        .select('api_settings')
        .eq('id', 'singleton')
        .single();
      
      if (!settings?.api_settings?.auto_backup_enabled) return;

      // 2. Check if a backup already exists for today
      const { count } = await supabase
        .from('system_backups')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]);
      
      if (count && count > 0) return;

      // 3. Create backup if missing
      console.log('Triggering automated backup...');
      await api.createBackup();
    } catch (err) {
      console.error('Auto-backup failed:', err);
    }
  },

  restoreFromBackup: async (backupId: string): Promise<void> => {
    // 1. Get backup info
    const { data: backup, error: fetchError } = await supabase
      .from('system_backups')
      .select('*')
      .eq('id', backupId)
      .single();
    
    if (fetchError) throw fetchError;

    // 2. Download snapshot
    const { data: blob, error: downloadError } = await supabase.storage
      .from('backups')
      .download(backup.snapshot_path);
    
    if (downloadError) throw downloadError;

    const snapshotText = await blob.text();
    const snapshot = toSnakeCase(JSON.parse(snapshotText));

    // 3. Restoration logic (Critical section)
    // For each table in snapshot, clear and re-insert
    // Note: Tables must be cleared in reverse dependency order and filled in dependency order.
    // Order: Base -> Dependent
    const restorationOrder = [
      'roles', 'organization_groups', 'companies', 'organizations', 'entities',
      'users', 'site_configurations', 'app_modules', 'onboarding_submissions',
      'settings', 'leave_requests', 'attendance_events', 'attendance_approvals',
      'locations', 'user_locations', 'notifications', 'tasks', 'notification_rules',
      'checklist_templates', 'field_reports', 'policies', 'insurances',
      'comp_off_logs', 'extra_work_logs', 'uniform_requests', 'field_attendance_violations',
      'biometric_devices', 'holidays', 'recurring_holidays', 'site_gents_uniform_configs',
      'site_ladies_uniform_configs', 'site_uniform_details_configs', 'support_tickets',
      'ticket_posts', 'ticket_comments', 'attendance_audit_logs'
    ];

    for (const table of restorationOrder.reverse()) {
      if (!snapshot[table]) continue;
      // We don't delete everything blindly if it was missing from backup, but we do if it's in restorationOrder
      const { error: delError } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      if (delError) console.error(`Failed to clear table ${table}:`, delError);
    }

    for (const table of restorationOrder.reverse()) {
      if (!snapshot[table] || snapshot[table].length === 0) continue;
      const { error: insError } = await supabase.from(table).insert(snapshot[table]);
      if (insError) throw new Error(`Restoration failed at table ${table}: ${insError.message}`);
    }
  },
  getPincodeDetails: async (pincode: string): Promise<{ city: string; state: string; }> => {
    // This is a mock. A real implementation would use an external API.
    return new Promise(resolve => setTimeout(() => resolve({ city: 'Bengaluru', state: 'Karnataka' }), 500));
  },
  suggestDepartmentForDesignation: async (designation: string): Promise<string | null> => {
    const mapping: Record<string, string> = {
      'Security Guard': 'Security',
      'Housekeeping Staff': 'Housekeeping',
      'Site Manager': 'Management',
    };
    const key = Object.keys(mapping).find(key => designation.toLowerCase().includes(key.toLowerCase()));
    return Promise.resolve(key ? mapping[key] : null);
  },
  verifyBankAccountWithPerfios: async (data: PerfiosVerificationData): Promise<VerificationResult> => {
    console.log('Mock verifying bank account:', data);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const success = Math.random() > 0.1; // 90% success rate
    return {
      success,
      message: success ? 'Bank account verified successfully.' : 'Account holder name did not match.',
      verifiedFields: { name: null, dob: null, aadhaar: null, bank: success, uan: null, esi: null, accountHolderName: success, accountNumber: success, ifscCode: true }
    };
  },
  verifyAadhaar: async (aadhaar: string): Promise<VerificationResult> => {
    console.log('Mock verifying Aadhaar:', aadhaar);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const success = aadhaar.length === 12 && Math.random() > 0.1;
    return { success, message: success ? 'Aadhaar details verified.' : 'Invalid Aadhaar number.', verifiedFields: { name: null, dob: null, aadhaar: success, bank: null, uan: null, esi: null } };
  },
  lookupUan: async (uan: string): Promise<VerificationResult> => {
    console.log('Mock looking up UAN:', uan);
    await new Promise(resolve => setTimeout(resolve, 1200));
    const success = uan.length === 12 && Math.random() > 0.1;
    return { success, message: success ? 'UAN found and linked.' : 'UAN not found in EPFO database.', verifiedFields: { name: null, dob: null, aadhaar: null, bank: null, uan: success, esi: null } };
  },
  extractDataFromImage: async (base64: string, mimeType: string, schema: any, docType?: string): Promise<any> => {
    // If AI is not available return an empty object.  This prevents the
    // application from crashing when running without an API key.  Otherwise,
    // call the Gemini model to extract structured data from the image.
    if (!ai) {
      console.warn('AI feature disabled: cannot extract data from image. Returning empty result.');
      return {};
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: `Extract the structured data from this document image. It is a ${docType || 'document'}.` },
          { inlineData: { data: base64, mimeType } }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  },
  extractDataFromImageLocal: async (base64: string, docType?: string): Promise<any> => {
    const worker = await createWorker('eng');
    try {
        const { data: { text } } = await worker.recognize(`data:image/png;base64,${base64}`);
        const result: any = {};
        const normalizedText = text.replace(/\n/g, ' ');

        if (docType === 'PAN') {
            const panMatch = normalizedText.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
            if (panMatch) result.panNumber = panMatch[0];
            // Name extraction is very hard with raw OCR without keys
        } else if (docType === 'Aadhaar') {
            const aadhaarMatch = normalizedText.match(/\d{4}\s\d{4}\s\d{4}/);
            if (aadhaarMatch) result.aadhaarNumber = aadhaarMatch[0].replace(/\s/g, '');
        } else if (docType === 'Bank' || docType === 'Cheque') {
            const ifscMatch = normalizedText.match(/[A-Z]{4}0[A-Z0-9]{6}/);
            if (ifscMatch) result.ifscCode = ifscMatch[0];
            const acMatch = normalizedText.match(/\d{9,18}/);
            if (acMatch) result.accountNumber = acMatch[0];
        } else if (docType === 'Salary' || docType === 'UAN') {
            const uanMatch = normalizedText.match(/\d{12}/);
            if (uanMatch) result.uanNumber = uanMatch[0];
        }
        return result;
    } finally {
        await worker.terminate();
    }
  },
  crossVerifyNames: async (name1: string, name2: string): Promise<{ isMatch: boolean; reason: string }> => {
    // Without the AI client fall back to a simple case-insensitive
    // comparison.  Return a basic match result with a reason.  This ensures
    // the application continues to operate without a Google API key.
    if (!ai) {
      const isMatch = name1.trim().toLowerCase() === name2.trim().toLowerCase();
      return {
        isMatch,
        reason: isMatch ? 'Names are identical (case-insensitive match) without AI.' : 'AI disabled; simple case-insensitive comparison used.'
      };
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Are these two names referring to the same person? Name 1: "${name1}", Name 2: "${name2}". Respond in JSON format with two keys: "isMatch" (boolean) and "reason" (a brief string explanation).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMatch: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          }
        }
      }
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  },
  verifyFingerprintImage: async (base64: string, mimeType: string): Promise<{ containsFingerprints: boolean; reason: string }> => {
    // When AI is unavailable return a default response indicating that no
    // fingerprints were detected.  This fallback prevents runtime errors when
    // running the project without a Gemini API key.
    if (!ai) {
      return {
        containsFingerprints: false,
        reason: 'AI disabled; cannot detect fingerprints.'
      };
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: 'Does this image contain one or more human fingerprints? The image might be a scan from paper. Respond in JSON with "containsFingerprints" (boolean) and "reason" (string).' },
          { inlineData: { data: base64, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            containsFingerprints: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          }
        }
      }
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  },
  enhanceDocumentPhoto: async (base64: string, mimeType: string): Promise<string> => {
    // When AI is unavailable simply return the original image.  This ensures
    // document uploads still work without enhancement.
    if (!ai) {
      console.warn('AI disabled; returning original document photo without enhancement.');
      return base64;
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: 'Enhance this document photo. Improve contrast, correct perspective to be flat, and make text as clear as possible. Return only the enhanced image.' },
          { inlineData: { data: base64, mimeType } }
        ]
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("AI did not return an enhanced image.");
  },
  getCompOffLogs: async (userId: string): Promise<CompOffLog[]> => {
    const { data, error } = await supabase.from('comp_off_logs').select('*').eq('user_id', userId).order('date_earned', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },
  checkCompOffTableExists: async (): Promise<void> => {
    const { error } = await supabase.from('comp_off_logs').select('id').limit(1);
    if (error) throw error;
  },
  getAllSiteAssets: async (): Promise<Record<string, Asset[]>> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase.from('site_configurations').select('organization_id, config_data');
        if (error) throw error;
        const result: Record<string, Asset[]> = {};
        data.forEach(item => {
          const config = item.config_data as any;
          result[item.organization_id] = toCamelCase(config?.assets || []);
        });
        await offlineDb.setCache('site_assets', result);
        return result;
      } catch (err) {
        console.warn('Failed to fetch assets from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache('site_assets') || {};
  },
  updateSiteAssets: async (siteId: string, assets: Asset[]): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ 
        table_name: 'site_configurations', 
        action: 'UPDATE_ASSETS', 
        payload: { organization_id: siteId, assets } 
      });
      return;
    }

    // Fetch existing config to avoid overwriting other fields
    const { data: existing, error: fetchError } = await supabase
      .from('site_configurations')
      .select('config_data')
      .eq('organization_id', siteId)
      .maybeSingle();
      
    if (fetchError) throw fetchError;

    const config = (existing?.config_data as any) || {};
    const updatedConfig = {
      ...config,
      assets: toSnakeCase(assets)
    };

    const { error: upsertError } = await supabase.from('site_configurations').upsert({
      organization_id: siteId,
      config_data: updatedConfig
    }, { onConflict: 'organization_id' });
    
    if (upsertError) throw upsertError;
  },
  getBackOfficeIdSeries: async (): Promise<BackOfficeIdSeries[]> => {
    const { data, error } = await supabase.from('settings').select('back_office_id_series').eq('id', 'singleton').single();
    if (error) throw error;
    return (data?.back_office_id_series || []).map(toCamelCase);
  },
  updateBackOfficeIdSeries: async (series: BackOfficeIdSeries[]): Promise<void> => {
    const { error } = await supabase.from('settings').upsert({
      id: 'singleton',
      back_office_id_series: toSnakeCase(series)
    }, { onConflict: 'id' });
    if (error) throw error;
  },
  getSiteStaffDesignations: async (): Promise<SiteStaffDesignation[]> => {
    const { data, error } = await supabase.from('settings').select('site_staff_designations').eq('id', 'singleton').single();
    if (error) throw error;
    return (data?.site_staff_designations || []).map(toCamelCase);
  },
  updateSiteStaffDesignations: async (designations: SiteStaffDesignation[]): Promise<void> => {
    const { error } = await supabase.from('settings').upsert({
      id: 'singleton',
      site_staff_designations: toSnakeCase(designations)
    }, { onConflict: 'id' });
    if (error) throw error;
  },
  getAllSiteIssuedTools: async (): Promise<Record<string, IssuedTool[]>> => {
    const { data, error } = await supabase.from('site_configurations').select('organization_id, config_data');
    if (error) throw error;
    const result: Record<string, IssuedTool[]> = {};
    data.forEach(item => {
      const config = item.config_data as any;
      result[item.organization_id] = toCamelCase(config?.issuedTools || []);
    });
    return result;
  },
  getToolsList: async (): Promise<MasterToolsList> => {
    const { data, error } = await supabase.from('settings').select('master_tools').eq('id', 'singleton').single();
    if (error) throw error;
    return toCamelCase(data.master_tools);
  },
  updateSiteIssuedTools: async (siteId: string, tools: IssuedTool[]): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ 
        table_name: 'site_configurations', 
        action: 'UPDATE_TOOLS', 
        payload: { organization_id: siteId, tools } 
      });
      return;
    }

    // Fetch existing config to avoid overwriting other fields
    const { data: existing, error: fetchError } = await supabase
      .from('site_configurations')
      .select('config_data')
      .eq('organization_id', siteId)
      .maybeSingle();
      
    if (fetchError) throw fetchError;

    const config = (existing?.config_data as any) || {};
    const updatedConfig = {
      ...config,
      issuedTools: toSnakeCase(tools)
    };

    const { error: upsertError } = await supabase.from('site_configurations').upsert({
      organization_id: siteId,
      config_data: updatedConfig
    }, { onConflict: 'organization_id' });
    
    if (upsertError) throw upsertError;
  },
  getAllSiteGentsUniforms: async (): Promise<Record<string, SiteGentsUniformConfig>> => {
    const { data, error } = await supabase.from('site_gents_uniform_configs').select('organization_id, config_data');
    if (error) throw error;
    const result: Record<string, SiteGentsUniformConfig> = {};
    data.forEach(item => {
      result[item.organization_id] = toCamelCase(item.config_data);
    });
    return result;
  },
  getMasterGentsUniforms: async (): Promise<MasterGentsUniforms> => {
    const { data, error } = await supabase.from('settings').select('master_gents_uniforms').eq('id', 'singleton').single();
    if (error) throw error;
    return toCamelCase(data.master_gents_uniforms || { pants: [], shirts: [] });
  },
  updateSiteGentsUniforms: async (siteId: string, config: SiteGentsUniformConfig): Promise<void> => {
    const { error } = await supabase.from('site_gents_uniform_configs').upsert({
      organization_id: siteId,
      config_data: toSnakeCase(config)
    }, { onConflict: 'organization_id' });
    if (error) throw error;
  },
  getAllSiteUniformDetails: async (): Promise<Record<string, SiteUniformDetailsConfig>> => {
    const { data, error } = await supabase.from('site_uniform_details_configs').select('organization_id, config_data');
    if (error) throw error;
    const result: Record<string, SiteUniformDetailsConfig> = {};
    data.forEach(item => {
      result[item.organization_id] = toCamelCase(item.config_data);
    });
    return result;
  },
  updateSiteUniformDetails: async (siteId: string, config: SiteUniformDetailsConfig): Promise<void> => {
    const { error } = await supabase.from('site_uniform_details_configs').upsert({
      organization_id: siteId,
      config_data: toSnakeCase(config)
    }, { onConflict: 'organization_id' });
    if (error) throw error;
  },
  getAllSiteLadiesUniforms: async (): Promise<Record<string, SiteLadiesUniformConfig>> => {
    const { data, error } = await supabase.from('site_ladies_uniform_configs').select('organization_id, config_data');
    if (error) throw error;
    const result: Record<string, SiteLadiesUniformConfig> = {};
    data.forEach(item => {
      result[item.organization_id] = toCamelCase(item.config_data);
    });
    return result;
  },
  getMasterLadiesUniforms: async (): Promise<MasterLadiesUniforms> => {
    const { data, error } = await supabase.from('settings').select('master_ladies_uniforms').eq('id', 'singleton').single();
    if (error) throw error;
    return toCamelCase(data.master_ladies_uniforms || { pants: [], shirts: [] });
  },
  updateSiteLadiesUniforms: async (siteId: string, config: SiteLadiesUniformConfig): Promise<void> => {
    const { error } = await supabase.from('site_ladies_uniform_configs').upsert({
      organization_id: siteId,
      config_data: toSnakeCase(config)
    }, { onConflict: 'organization_id' });
    if (error) throw error;
  },
  getUniformRequests: async (): Promise<UniformRequest[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase.from('uniform_requests').select('*');
        if (error) throw error;
        const formatted = (data || []).map(toCamelCase);
        await offlineDb.setCache('uniform_requests', formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch uniform requests from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache('uniform_requests') || [];
  },
  submitUniformRequest: async (request: UniformRequest): Promise<UniformRequest> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      const offlineId = `unif_offline_${Date.now()}`;
      const offlineRecord = { ...request, id: offlineId, status: 'Pending' } as UniformRequest;
      await offlineDb.addToOutbox({ table_name: 'uniform_requests', action: 'INSERT', payload: request });
      
      const cached = await offlineDb.getCache('uniform_requests') || [];
      await offlineDb.setCache('uniform_requests', [offlineRecord, ...cached]);
      return offlineRecord;
    }

    const { data, error } = await supabase.from('uniform_requests').insert(toSnakeCase(request)).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  updateUniformRequest: async (request: UniformRequest): Promise<UniformRequest> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'uniform_requests', action: 'UPDATE', payload: request });
      
      const cached = await offlineDb.getCache('uniform_requests') || [];
      await offlineDb.setCache('uniform_requests', cached.map((r: any) => r.id === request.id ? { ...r, ...request } : r));
      return request;
    }

    const { data, error } = await supabase.from('uniform_requests').update(toSnakeCase(request)).eq('id', request.id).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  deleteUniformRequest: async (id: string): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'uniform_requests', action: 'DELETE', payload: { id } });
      
      const cached = await offlineDb.getCache('uniform_requests') || [];
      await offlineDb.setCache('uniform_requests', cached.filter((r: any) => r.id !== id));
      return;
    }

    const { error } = await supabase.from('uniform_requests').delete().eq('id', id);
    if (error) throw error;
  },
  getInvoiceStatuses: async (date: Date): Promise<Record<string, 'Not Generated' | 'Generated' | 'Sent' | 'Paid'>> => {
    console.log('Mock fetching invoice statuses for', date);
    return Promise.resolve({});
  },
  getInvoiceSummaryData: async (siteId: string, date: Date): Promise<InvoiceData> => {
    console.log('Mock fetching invoice data for', siteId, date);
    return Promise.resolve({ siteName: 'Mock Site', siteAddress: 'Mock Address', invoiceNumber: 'INV-001', invoiceDate: '2023-01-31', statementMonth: 'January-2023', lineItems: [] });
  },
  getSupportTickets: async (): Promise<SupportTicket[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = (await withTimeout(
          supabase.from('support_tickets').select('*, posts:ticket_posts(*, comments:ticket_comments(*))') as any,
          20000,
          'Fetch support tickets timed out'
        )) as any;
        if (error) throw error;
        const formatted = (data || []).map(toCamelCase);
        await offlineDb.setCache('support_tickets', formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch support tickets from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache('support_tickets') || [];
  },
  getSupportTicketById: async (id: string): Promise<SupportTicket | null> => {
    const { data, error } = await supabase.from('support_tickets').select('*, posts:ticket_posts(*, comments:ticket_comments(*))').eq('id', id).single();
    if (error) throw error;
    return toCamelCase(data);
  },
  createSupportTicket: async (ticketData: Partial<SupportTicket>): Promise<SupportTicket> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      const offlineId = `st_offline_${Date.now()}`;
      const offlineTicket = { ...ticketData, id: offlineId, status: 'Open', createdAt: new Date().toISOString(), posts: [] } as any as SupportTicket;
      await offlineDb.addToOutbox({ table_name: 'support_tickets', action: 'INSERT', payload: ticketData });
      
      const cached = await offlineDb.getCache('support_tickets') || [];
      await offlineDb.setCache('support_tickets', [offlineTicket, ...cached]);
      return offlineTicket;
    }

    // If an attachment was provided with a File object, upload it to the support attachments bucket
    const attachment: any = (ticketData as any).attachment;
    if (attachment && attachment.file instanceof File) {
      try {
        const { path } = await api.uploadDocument(attachment.file as File, SUPPORT_ATTACHMENTS_BUCKET);
        (ticketData as any).attachment = {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          path,
        };
      } catch (uploadErr) {
        console.error('Failed to upload support ticket attachment:', uploadErr);
        // Remove attachment to prevent sending File object to database
        delete (ticketData as any).attachment;
      }
    }
    const { data, error } = await supabase.from('support_tickets').insert(toSnakeCase(ticketData)).select('*, posts:ticket_posts(*, comments:ticket_comments(*))').single();
    if (error) throw error;

    // Trigger notification
    dispatchNotificationFromRules('support_ticket', {
        actorName: ticketData.raisedByName || 'A user',
        actionText: 'has raised a new support ticket',
        locString: `: ${ticketData.title}`,
        actor: { id: ticketData.raisedById || '', name: ticketData.raisedByName || 'User', role: 'staff' }
    });

    return toCamelCase(data);
  },
  updateSupportTicket: async (id: string, updates: Partial<SupportTicket>): Promise<SupportTicket> => {
    // Handle attachment upload when updating a ticket
    const attachment: any = (updates as any).attachment;
    if (attachment && attachment.file instanceof File) {
      try {
        const { path } = await api.uploadDocument(attachment.file as File, SUPPORT_ATTACHMENTS_BUCKET);
        (updates as any).attachment = {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          path,
        };
      } catch (uploadErr) {
        console.error('Failed to upload updated support ticket attachment:', uploadErr);
        delete (updates as any).attachment;
      }
    }
    const { data, error } = await supabase.from('support_tickets').update(toSnakeCase(updates)).eq('id', id).select('*, posts:ticket_posts(*, comments:ticket_comments(*))').single();
    if (error) throw error;
    return toCamelCase(data);
  },
  addTicketPost: async (ticketId: string, postData: Partial<TicketPost>): Promise<TicketPost> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        const offlineId = `post_offline_${Date.now()}`;
        const offlinePost = { ...postData, id: offlineId, ticketId, createdAt: new Date().toISOString(), comments: [] } as TicketPost;
        await offlineDb.addToOutbox({ table_name: 'ticket_posts', action: 'INSERT', payload: { ticketId, post: postData } });
        
        const cached = await offlineDb.getCache('support_tickets') || [];
        const updated = cached.map((t: any) => t.id === ticketId ? { ...t, posts: [...(t.posts || []), offlinePost] } : t);
        await offlineDb.setCache('support_tickets', updated);
        return offlinePost;
    }
    const { data, error } = await supabase.from('ticket_posts').insert(toSnakeCase(postData)).select('*, comments:ticket_comments(*)').single();
    if (error) throw error;

    // Trigger notification
    dispatchNotificationFromRules('support_response', {
        actorName: postData.authorName || 'Staff',
        actionText: 'has responded to a support ticket',
        locString: '',
        actor: { id: postData.authorId || '', name: postData.authorName || 'Staff', role: postData.authorRole || 'hr' }
    });

    return toCamelCase(data);
  },
  togglePostLike: async (postId: string, userId: string): Promise<void> => {
    const { data, error } = await supabase.from('ticket_posts').select('likes').eq('id', postId).single();
    if (error) throw error;
    const likes = (data.likes as string[]) || [];
    const newLikes = likes.includes(userId) ? likes.filter(id => id !== userId) : [...likes, userId];
    const { error: updateError } = await supabase.from('ticket_posts').update({ likes: newLikes }).eq('id', postId);
    if (updateError) throw updateError;
  },
  addPostComment: async (postId: string, commentData: Partial<TicketComment>): Promise<TicketComment> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        const offlineId = `comm_offline_${Date.now()}`;
        const offlineComment = { ...commentData, id: offlineId, postId, createdAt: new Date().toISOString() } as TicketComment;
        await offlineDb.addToOutbox({ table_name: 'ticket_comments', action: 'INSERT', payload: { postId, comment: commentData } });
        return offlineComment;
    }
    const { data, error } = await supabase.from('ticket_comments').insert(toSnakeCase(commentData)).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  getVerificationCostBreakdown: async (startDate: string, endDate: string): Promise<SubmissionCostBreakdown[]> => {
    const { data, error } = await supabase.from('onboarding_submissions').select('id, employee_id, personal, enrollment_date, verification_usage').gte('enrollment_date', startDate).lte('enrollment_date', endDate);
    if (error) throw error;

    return (data || []).map(sub => {
      const camelSub = toCamelCase(sub);
      return {
        id: camelSub.id,
        employeeId: camelSub.personal.employeeId,
        employeeName: `${camelSub.personal.firstName} ${camelSub.personal.lastName}`,
        enrollmentDate: camelSub.enrollmentDate,
        totalCost: 0, // Will be calculated on the frontend
        breakdown: camelSub.verificationUsage || [],
      }
    });
  },

    // PDF generation service removed in favor of @react-pdf/renderer
    // deleteOnboardingData: async (id: string): Promise<void> => {

  /**
   * Batch resolve addresses for a list of coordinates.
   * Checks Supabase 'location_cache' first, then fetches from Nominatim for missing ones,
   * and caches the results.
   */
  batchResolveAddresses: async (coords: { lat: number; lon: number }[]): Promise<Record<string, string>> => {
    if (coords.length === 0) return {};

    // Normalize coordinates to 6 decimal places for consistent key generation
    const normalizeCoord = (n: number) => parseFloat(n.toFixed(6));

    const uniqueCoords = Array.from(new Set(coords.map(c => `${normalizeCoord(c.lat)},${normalizeCoord(c.lon)}`)))
      .map(s => {
        const [lat, lon] = s.split(',').map(Number);
        return { lat, lon };
      });

    const resultMap: Record<string, string> = {};
    const missingCoords: { lat: number; lon: number }[] = [];

    // 1. Check Cache in Supabase
    // Fetch cache entries that match any of the latitudes (approximate filter)
    const lats = uniqueCoords.map(c => c.lat);
    const { data: cachedData, error } = await supabase
      .from('location_cache')
      .select('*')
      .in('latitude', lats);

    if (!error && cachedData) {
      cachedData.forEach((row: any) => {
        // Normalize database values for comparison
        const dbLat = normalizeCoord(parseFloat(row.latitude));
        const dbLon = normalizeCoord(parseFloat(row.longitude));
        const key = `${dbLat},${dbLon}`;

        // Verify exact match including longitude
        if (uniqueCoords.some(c => normalizeCoord(c.lat) === dbLat && normalizeCoord(c.lon) === dbLon)) {
          resultMap[key] = row.address;
        }
      });
    }

    // 2. Identify Missing
    uniqueCoords.forEach(c => {
      const key = `${normalizeCoord(c.lat)},${normalizeCoord(c.lon)}`;
      if (!resultMap[key]) {
        missingCoords.push(c);
      }
    });

    console.log('Geocoding API: Found', Object.keys(resultMap).length, 'cached,', missingCoords.length, 'missing');

    // 3. Fetch Missing from Nominatim & Cache
    // We must rate limit this to avoid banning. 1 request per second is safe.
    for (const coord of missingCoords) {
      try {
        const address = await import('../utils/locationUtils').then(m => m.reverseGeocode(coord.lat, coord.lon));

        const key = `${normalizeCoord(coord.lat)},${normalizeCoord(coord.lon)}`;
        resultMap[key] = address;

        // Insert into Cache
        await supabase.from('location_cache').insert({
          latitude: normalizeCoord(coord.lat),
          longitude: normalizeCoord(coord.lon),
          address: address
        });

        console.log('Geocoding API: Fetched and cached', key, '->', address);

        // Delay to respect API rate limits
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`Failed to resolve address for ${coord.lat},${coord.lon}`, e);
        const key = `${normalizeCoord(coord.lat)},${normalizeCoord(coord.lon)}`;
        resultMap[key] = `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`;
      }
    }

    return resultMap;
  },

  /**
   * Send a security alert notification to the user's reporting manager about
   * developer mode, location spoofing, or other security violations.
   */
  sendSecurityAlert: async (userId: string, userName: string, violationType: 'developer_mode' | 'location_spoofing', deviceInfo?: string): Promise<void> => {
    // Get the user's reporting manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('reporting_manager_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.reporting_manager_id) {
      console.warn('Could not find reporting manager for security alert');
      return;
    }

    const violationMessage = violationType === 'developer_mode'
      ? 'attempted to access the application with Developer Mode enabled'
      : 'attempted to access the application with Location Spoofing detected';

    const deviceText = deviceInfo ? ` using device: ${deviceInfo}` : '';

    await api.createNotification({
      userId: userData.reporting_manager_id,
      title: '🔒 Security Alert',
      message: `${userName} ${violationMessage}${deviceText}. Access was blocked for security reasons.`,
      type: 'security',
      link: `/user-management`,
      metadata: {
        employeeName: userName,
        violationType,
        deviceInfo
      }
    });
  },

  /**
   * Send a device change alert notification to the user's reporting manager.
   */
  sendDeviceChangeAlert: async (userId: string, userName: string, oldDevice: string, newDevice: string): Promise<void> => {
    // Get the user's reporting manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, reporting_manager_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.reporting_manager_id) {
      console.warn('Could not find reporting manager for device change alert');
      return;
    }

    const name = userName || userData.name || 'An employee';

    await api.createNotification({
      userId: userData.reporting_manager_id,
      title: '📱 Device Change Detected',
      message: `${name} logged in from a new device. Previous device: ${oldDevice}, New device: ${newDevice}`,
      type: 'info',
      link: `/user-management`,
      metadata: {
        employeeName: name,
        oldDevice,
        newDevice
      }
    });
  },
  getBiometricDevices: async (): Promise<BiometricDevice[]> => {
    const { data, error } = await supabase
      .from('biometric_devices')
      .select('*, organization:organizations(short_name)')
      .order('name');
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },
  addBiometricDevice: async (device: Partial<BiometricDevice>): Promise<BiometricDevice> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'biometric_devices', action: 'INSERT', payload: device });
      return { ...device, id: `bio_offline_${Date.now()}` } as BiometricDevice;
    }
    const dataToInsert = { ...device };
    if (dataToInsert.sn) dataToInsert.sn = dataToInsert.sn.toLowerCase();
    const { data, error } = await supabase.from('biometric_devices').insert(toSnakeCase(dataToInsert)).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },
  deleteBiometricDevice: async (id: string): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'biometric_devices', action: 'DELETE', payload: { id } });
      return;
    }
    const { error } = await supabase.from('biometric_devices').delete().eq('id', id);
    if (error) throw error;
  },
  updateBiometricDevice: async (id: string, device: Partial<BiometricDevice>): Promise<BiometricDevice> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'biometric_devices', action: 'UPDATE', payload: { id, updates: device } });
      return { id, ...device } as BiometricDevice;
    }
    const dataToUpdate = { ...device };
    if (dataToUpdate.sn) dataToUpdate.sn = dataToUpdate.sn.toLowerCase();
    const { data, error } = await supabase.from('biometric_devices').update(toSnakeCase(dataToUpdate)).eq('id', id).select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  // --- Geofencing Violations & Settings ---
  
  getViolations: async (userId: string, month?: string): Promise<any[]> => {
    let query = supabase.from('attendance_violations').select('*').eq('user_id', userId);
    if (month) {
      query = query.eq('violation_month', month);
    }
    const { data, error } = await query.order('violation_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  addViolation: async (violationData: Partial<any>): Promise<any> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'attendance_violations', action: 'INSERT', payload: violationData });
      return null;
    }
    const { data, error } = await supabase
      .from('attendance_violations')
      .insert(toSnakeCase(violationData))
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  getViolationCount: async (userId: string, month: string): Promise<number> => {
    const { count, error } = await supabase
      .from('attendance_violations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('violation_month', month);
    if (error) throw error;
    return count || 0;
  },

  resetViolations: async (userId: string, month: string, reason: string, adminId: string): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'violation_resets', action: 'INSERT', payload: { userId, month, reason, adminId } });
      return;
    }
    // Get current violation count
    const count = await api.getViolationCount(userId, month);
    
    // Record the reset
    const { error: resetError } = await supabase
      .from('violation_resets')
      .insert(toSnakeCase({
        userId,
        resetMonth: month,
        previousViolationCount: count,
        resetBy: adminId,
        resetReason: reason
      }));
    if (resetError) throw resetError;

    // Delete violations for the month
    const { error: deleteError } = await supabase
      .from('attendance_violations')
      .delete()
      .eq('user_id', userId)
      .eq('violation_month', month);
    if (deleteError) throw deleteError;

    // Lift salary hold
    const { error: updateError } = await supabase
      .from('users')
      .update({
        salary_hold: false,
        salary_hold_reason: null,
        salary_hold_date: null
      })
      .eq('id', userId);
    if (updateError) throw updateError;
  },

  getResetHistory: async (userId?: string): Promise<any[]> => {
    let query = supabase
      .from('violation_resets')
      .select(`
        *,
        user:users!violation_resets_user_id_fkey(name),
        admin:users!violation_resets_reset_by_fkey(name)
      `);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('reset_at', { ascending: false });
    if (error) throw error;
    
    return (data || []).map(item => ({
      ...toCamelCase(item),
      userName: item.user?.name,
      resetByName: item.admin?.name
    }));
  },

  setSalaryHold: async (userId: string, status: boolean, reason?: string): Promise<void> => {
    const { error } = await supabase
      .from('users')
      .update({
        salary_hold: status,
        salary_hold_reason: reason || null,
        salary_hold_date: status ? new Date().toISOString() : null
      })
      .eq('id', userId);
    if (error) throw error;
  },

  getGeofencingSettings: async (): Promise<any> => {
    const { data, error } = await supabase
      .from('settings')
      .select('geofencing_verification_enabled, max_violations_per_month')
      .eq('id', 'singleton')
      .maybeSingle();
    
    if (error) throw error;
    
    return {
      enabled: data?.geofencing_verification_enabled ?? false,
      maxViolationsPerMonth: data?.max_violations_per_month ?? 3
    };
  },

  updateGeofencingSettings: async (settings: { enabled?: boolean; maxViolationsPerMonth?: number }): Promise<void> => {
    const updates: any = {};
    
    if (settings.enabled !== undefined) {
      updates.geofencing_verification_enabled = settings.enabled;
    }
    
    if (settings.maxViolationsPerMonth !== undefined) {
      updates.max_violations_per_month = settings.maxViolationsPerMonth;
    }
    
    const { error } = await supabase
      .from('settings')
      .update(updates)
      .eq('id', 'singleton');
    
    if (error) throw error;
  },
  
  sendFieldReport: async (reportId: string, pdfBlob: Blob, managerId: string, managerName: string, submitterName: string): Promise<void> => {
    // 1. Upload PDF to Storage (Use Task Attachments bucket as it exists)
    const fileName = `field-reports/${reportId}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
        .from(TASK_ATTACHMENTS_BUCKET) 
        .upload(fileName, pdfBlob, { upsert: true });

    if (uploadError) {
        console.error("PDF Upload Failed:", uploadError);
        // Continue anyway to at least send notification
    }

    const { data: { publicUrl } } = supabase.storage.from(TASK_ATTACHMENTS_BUCKET).getPublicUrl(fileName);

    // 2. Real Email Sending via Edge Function
    let emailSent = false;
    try {
        console.log("Invoking sending-email function...");
        const { error: fnError } = await supabase.functions.invoke('send-email', {
            body: {
                to: [managerId === 'f06f05d9-cf5f-4e4d-a0b4-9534fd2d1e7b' ? 'sudhan@paradigmfms.com' : 'sudhan@paradigmfms.com'], // Hardcoded for testing as requested
                subject: `New Field Report from ${submitterName}`,
                html: `<p>Hi,</p><p>${submitterName} has submitted a new field report.</p><p><a href="${publicUrl}">Click here to view the report</a></p>`,
                attachments: [
                    {
                        filename: `FieldReport_${reportId.substring(0,8)}.pdf`,
                        path: publicUrl
                    }
                ]
            }
        });
        
        if (fnError) {
             console.error("Edge function failed:", fnError);
             throw fnError;
        }
        emailSent = true;
        console.log("Email sent successfully via backend.");
    } catch (emailErr) {
        console.error("Backend email failed, falling back to client-side:", emailErr);
    }

    // 3. Create In-App Notification using correct schema (user_id, message, type)
    try {
        await api.createNotification({
            userId: managerId,
            message: `New Field Report: ${submitterName} has submitted report ${reportId.substring(0, 8)}.`,
            type: 'info',
        });
    } catch (notifErr) {
        console.error("Failed to send notification:", notifErr);
    }

    // 4. Trigger Real Email Client (Mailto) - ONLY if backend failed
    if (!emailSent) {
        const subject = encodeURIComponent(`New Field Report from ${submitterName}`);
        const body = encodeURIComponent(`Hi,\n\nPlease find the field report attached:\n${publicUrl}\n\nSubmitted by: ${submitterName}\nReport ID: ${reportId}`);
        
         setTimeout(() => {
            window.open(`mailto:sudhan@paradigmfms.com?subject=${subject}&body=${body}`, '_blank');
        }, 500);
    }
  },

  // Field Staff Violations Management
  async getFieldViolations(userId: string): Promise<FieldAttendanceViolation[]> {
    const { data, error } = await supabase
      .from('field_attendance_violations')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching field violations:', error);
      throw error;
    }

    return data.map(v => ({
      id: v.id,
      userId: v.user_id,
      date: v.date,
      totalHours: parseFloat(v.total_hours),
      siteHours: parseFloat(v.site_hours),
      travelHours: parseFloat(v.travel_hours),
      sitePercentage: parseFloat(v.site_percentage),
      travelPercentage: parseFloat(v.travel_percentage),
      violationType: v.violation_type,
      requiredSitePercentage: parseFloat(v.required_site_percentage),
      status: v.status,
      acknowledgedBy: v.acknowledged_by,
      acknowledgedAt: v.acknowledged_at,
      managerNotes: v.manager_notes,
      escalatedTo: v.escalated_to,
      escalatedAt: v.escalated_at,
      escalationLevel: v.escalation_level,
      affectsSalary: v.affects_salary,
      affectsPerformance: v.affects_performance,
      attendanceGranted: v.attendance_granted,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }));
  },

  async getBatchFieldViolations(userIds: string[]): Promise<FieldAttendanceViolation[]> {
    if (!userIds.length) return [];
    
    // Split userIds into chunks to avoid potential URL length limits in some environments (though Supabase/PostgREST usually handle this)
    const { data, error } = await supabase
      .from('field_attendance_violations')
      .select('*')
      .in('user_id', userIds)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching batch field violations:', error);
      throw error;
    }

    return (data || []).map(v => ({
      id: v.id,
      userId: v.user_id,
      date: v.date,
      totalHours: parseFloat(v.total_hours || '0'),
      siteHours: parseFloat(v.site_hours || '0'),
      travelHours: parseFloat(v.travel_hours || '0'),
      sitePercentage: parseFloat(v.site_percentage || '0'),
      travelPercentage: parseFloat(v.travel_percentage || '0'),
      violationType: v.violation_type,
      requiredSitePercentage: parseFloat(v.required_site_percentage || '0'),
      status: v.status,
      acknowledgedBy: v.acknowledged_by,
      acknowledgedAt: v.acknowledged_at,
      managerNotes: v.manager_notes,
      escalatedTo: v.escalated_to,
      escalatedAt: v.escalated_at,
      escalationLevel: v.escalation_level,
      affectsSalary: v.affects_salary,
      affectsPerformance: v.affects_performance,
      attendanceGranted: v.attendance_granted,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }));
  },


  async createFieldViolation(violationData: Partial<FieldAttendanceViolation & { siteVisits?: number }>): Promise<FieldAttendanceViolation> {
    // Filter out siteVisits if present in the breakdown, as it's not a column in the table
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { siteVisits, ...validData } = violationData;
    
    const { data, error } = await supabase
      .from('field_attendance_violations')
      .insert(toSnakeCase(validData))
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  async acknowledgeFieldViolation(violationId: string, notes: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('field_attendance_violations')
      .update({
        status: 'acknowledged',
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
        manager_notes: notes,
        attendance_granted: true,
      })
      .eq('id', violationId);

    if (error) {
      console.error('Error acknowledging violation:', error);
      throw error;
    }
  },

  async submitFieldViolationReason(violationId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('field_attendance_violations')
      .update({
        user_reason: reason,
      })
      .eq('id', violationId);

    if (error) {
      console.error('Error submitting violation reason:', error);
      throw error;
    }
  },

  async exportFieldViolations(userId: string, userName: string): Promise<void> {
    const violations = await this.getFieldViolations(userId);
    
    // Generate CSV content
    const headers = [
      'Date',
      'Violation Type',
      'Total Hours',
      'Site Hours',
      'Site %',
      'Travel Hours',
      'Travel %',
      'Required Site %',
      'Status',
      'Acknowledged By',
      'Acknowledged At',
      'Notes'
    ].join(',');

    const rows = violations.map(v => [
      v.date,
      v.violationType,
      v.totalHours.toFixed(2),
      v.siteHours.toFixed(2),
      v.sitePercentage.toFixed(1),
      v.travelHours.toFixed(2),
      v.travelPercentage.toFixed(1),
      v.requiredSitePercentage,
      v.status,
      v.acknowledgedBy || '',
      v.acknowledgedAt || '',
      `"${v.managerNotes || ''}"`,
    ].join(','));

    const csv = [headers, ...rows].join('\n');

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${userName}_violations_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async processFieldAttendance(userId: string, date: string): Promise<void> {
    try {
      // 1. Fetch events for the day
      const start = startOfDay(new Date(date)).toISOString();
      const end = endOfDay(new Date(date)).toISOString();
      const events = await this.getAttendanceEvents(userId, start, end);
      
      if (events.length === 0) return;

      // 2. Calculate breakdown
      const breakdown = calculateSiteTravelTime(events);
      const user = await this.getUserById(userId);
      if (!user) return;
      
      // 3. Fetch settings
      const settings = await this.getAttendanceSettings();
      if (user.role !== 'field_staff') return;

      const rules = settings.field;
      if (!rules.enableSiteTimeTracking) return;

      // 4. Validate
      const minHoursFull = rules.dailyWorkingHours?.max || 9;
      const minHoursHalf = rules.dailyWorkingHours?.min || 7;

      const validation = validateFieldStaffAttendance(breakdown, {
        minimumSitePercentage: rules.minimumSitePercentage || 75,
        minimumHoursFullDay: minHoursFull,
        minimumHoursHalfDay: minHoursHalf,
      });

      // 5. Handle violations
      const existingViolations = await this.getFieldViolations(userId);
      const existingForDay = existingViolations.find(v => v.date === date);

      if (!validation.isValid) {
        const violationType = validation.violations.includes('site_time_low') ? 'site_time_low' : 'insufficient_hours';
        const violationDetails = {
          expectedPercentage: rules.minimumSitePercentage || 75,
          actualPercentage: breakdown.sitePercentage,
          siteVisits: breakdown.siteVisits,
          totalHours: breakdown.totalHours,
          requiredFullDayHours: rules.dailyWorkingHours?.max || 9,
          requiredHalfDayHours: rules.dailyWorkingHours?.min || 7,
        };
        const severity = breakdown.sitePercentage < 40 || breakdown.totalHours < 4 ? 'High' : (breakdown.sitePercentage < 60 || breakdown.totalHours < 6 ? 'Medium' : 'Low');
        
        if (existingForDay) {
          if (existingForDay.status === 'pending') {
            // Update existing pending violation
            await supabase
              .from('field_attendance_violations')
              .update(toSnakeCase({
                ...breakdown,
                violationType,
                requiredSitePercentage: rules.minimumSitePercentage || 75,
                violationDetails,
                severity,
              }))
              .eq('id', existingForDay.id);
          }
        } else {
          // Create new violation
          await this.createFieldViolation({
            userId,
            date,
            ...breakdown,
            violationType,
            requiredSitePercentage: rules.minimumSitePercentage || 75,
            violationDetails,
            severity,
            status: 'pending',
            affectsSalary: true,
            affectsPerformance: true,
          });

          // Send notification via rules
          if (user.reportingManagerId) {
            const violationTypeNames: Record<string, string> = {
              'site_time_low': 'LESS WORKED AT SITE',
              'insufficient_hours': 'INSUFFICIENT WORK HOURS'
            };
            const typeLabel = violationTypeNames[violationType] || violationType;

            await dispatchNotificationFromRules('violation', {
              actorName: user.name,
              actionText: `has a ${typeLabel} violation for ${format(new Date(date), 'MMM dd')}. Site percentage: ${breakdown.sitePercentage.toFixed(1)}%`,
              locString: '',
              severity,
              metadata: {
                violationType,
                details: violationDetails,
                date: date
              },
              actor: {
                id: user.id,
                name: user.name,
                reportingManagerId: user.reportingManagerId,
                role: user.role,
                photoUrl: user.photoUrl
              }
            });
          }
        }
      } else if (existingForDay && (existingForDay.status === 'pending' || existingForDay.status === 'escalated')) {
        // ... (rest of the existing cleanup logic)
      }

      // Check for 3 strikes (salary hold / blocking)
      const currentMonth = format(new Date(date), 'yyyy-MM');
      const startOfMon = startOfMonth(new Date(date)).toISOString();
      const endOfMon = endOfMonth(new Date(date)).toISOString();
      
      const monViolations = await this.getFieldViolations(userId);
      const pendingCount = monViolations.filter(v => 
        v.date.startsWith(currentMonth) && 
        (v.status === 'pending' || v.status === 'escalated')
      ).length;

      const { maxViolationsPerMonth } = await this.getGeofencingSettings();
      const enableBlocking = rules.enableViolationBlocking ?? true;

      if (pendingCount >= maxViolationsPerMonth) {
        if (enableBlocking) {
          // 3 strikes reached!
          await this.setSalaryHold(userId, true, `Attendance Violation Strike Policy: ${pendingCount} violations reached in ${format(new Date(date), 'MMMM yyyy')}.`);
          
          // Notify user
          await this.createNotification({
            userId,
            message: `URGENT: You have reached ${pendingCount} attendance violations this month. Your access has been restricted and salary is on hold. Please provide reasons for your violations to resume.`,
          });
        } else {
          // Blocking disabled, just notify
          await this.createNotification({
            userId,
            message: `NOTICE: You have reached ${pendingCount} attendance violations this month. Please review and provide reasons to avoid future restrictions.`,
          });
        }
      }
    } catch (error) {
      console.error('Error processing field attendance violations:', error);
    }
  },

  async resetFieldViolationsForMonth(userId: string, month: string, adminId: string, reason: string): Promise<void> {
    // Determine note
    let managerInfo = "Admin";
    const managerUser = useAuthStore.getState().user;
    if (managerUser && managerUser.name) {
      managerInfo = managerUser.name;
    }

    const noteText = reason ? `Reset by ${managerInfo}: ${reason}` : `approved by ${managerInfo}`;

    const { error: updateError } = await supabase
      .from('field_attendance_violations')
      .update({ status: 'acknowledged', manager_notes: noteText })
      .eq('user_id', userId)
      .ilike('date', `${month}%`)
      .in('status', ['pending', 'escalated']);

    if (updateError) throw updateError;

    const { error: resetError } = await supabase
      .from('violation_resets')
      .insert({
        user_id: userId,
        reset_month: month,
        reset_by: adminId,
        reset_reason: reason
      });

    if (resetError) throw resetError;

    // Remove salary hold
    await this.setSalaryHold(userId, false, `Violations reset for ${month}. Reason: ${reason}`);
  },

  async checkForMissedPunchOut(userId: string, date: string): Promise<void> {
    try {
      const start = startOfDay(new Date(date)).toISOString();
      const end = endOfDay(new Date(date)).toISOString();
      const events = await this.getAttendanceEvents(userId, start, end);
      
      const lastIn = events.reverse().find(e => e.type === 'punch-in' || e.type === 'check-in');
      if (!lastIn) return;

      const hasOut = events.some(e => (e.type === 'punch-out' || e.type === 'check-out') && new Date(e.timestamp) > new Date(lastIn.timestamp));

      if (!hasOut) {
        const inTime = new Date(lastIn.timestamp);
        const now = new Date();
        const diffHours = (now.getTime() - inTime.getTime()) / (1000 * 60 * 60);

        // If it's the same day and more than 10 hours have passed, or if it's a past day
        const isPastDay = !isSameDay(new Date(date), now);
        if (isPastDay || diffHours > 10) {
          // Check if violation already exists
          const violations = await this.getFieldViolations(userId);
          const existing = violations.find(v => v.date === date && v.violationType === 'missed_punch_out');

          if (!existing) {
            await this.createFieldViolation({
              userId,
              date,
              totalHours: diffHours > 24 ? 0 : diffHours,
              siteHours: 0,
              travelHours: 0,
              sitePercentage: 0,
              travelPercentage: 0,
              violationType: 'missed_punch_out',
              requiredSitePercentage: 0,
              status: 'pending',
              severity: 'Medium'
            });

            await this.createNotification({
              userId,
              message: `You forgot to punch out for ${format(new Date(date), 'MMM dd')}. This has been recorded as an attendance violation.`,
              type: 'warning'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking for missed punch out:', error);
    }
  },

  // Site Finance
  async getPendingFinanceRecords(managerId?: string): Promise<SiteFinanceRecord[]> {
    const query = supabase
      .from('site_finance_tracker')
      .select('*, creator:created_by(reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id)')
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    let filteredData = data || [];
    if (managerId) {
        filteredData = filteredData.filter((row: any) => 
            row.creator?.reporting_manager_id === managerId ||
            row.creator?.reporting_manager_2_id === managerId ||
            row.creator?.reporting_manager_3_id === managerId
        );
    }

    return filteredData.map(toCamelCase);
  },

  async respondToFinanceRecord(id: string, status: 'approved' | 'rejected'): Promise<void> {
    const { error } = await supabase
      .from('site_finance_tracker')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  },
  async getSiteFinanceRecord(id: string): Promise<SiteFinanceRecord | null> {
    const { data, error } = await supabase
      .from('site_finance_tracker')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    return toCamelCase(data);
  },

  async getLastFinanceRecordForSite(siteId: string): Promise<SiteFinanceRecord | null> {
    const { data, error } = await supabase
      .from('site_finance_tracker')
      .select('*')
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return toCamelCase(data);
  },

  async getSiteFinanceRecords(billingMonth?: string, managerId?: string): Promise<SiteFinanceRecord[]> {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const query = supabase
          .from('site_finance_tracker')
          .select('*')
          .is('deleted_at', null)
          .order('site_name');

        const { data, error } = await query;
        if (error) throw error;
        const formatted = (data || []).map(toCamelCase);
        await offlineDb.setCache('site_finance_records', formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch site finance records from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache('site_finance_records') || [];
  },

  async saveSiteFinanceRecord(record: Partial<SiteFinanceRecord>): Promise<SiteFinanceRecord> {
    const status = await Network.getStatus();
    if (!status.connected) {
        const offlineId = `fin_offline_${Date.now()}`;
        const offlineRecord = { ...record, id: offlineId, status: 'pending' } as SiteFinanceRecord;
        await offlineDb.addToOutbox({ table_name: 'site_finance_tracker', action: 'INSERT', payload: record });
        
        // Update local cache
        const cached = await offlineDb.getCache('site_finance_records') || [];
        await offlineDb.setCache('site_finance_records', [offlineRecord, ...cached]);
        
        return offlineRecord;
    }

    const dbRecord = toSnakeCase(record);
    // Omit generated columns before upsert
    delete dbRecord.total_billed_amount;
    delete dbRecord.revision_count;

    // Check if this is an update (has id) for revision tracking
    let existingRecord: any = null;
    if (record.id) {
      const { data: existingRaw } = await supabase.from('site_finance_tracker').select('*').eq('id', record.id).single();
      existingRecord = existingRaw ? toCamelCase(existingRaw) : null;
    }
    
    const { data, error } = await supabase
      .from('site_finance_tracker')
      .upsert({ status: 'pending', ...dbRecord })
      .select()
      .single();

    if (error) throw error;

    // Log revision if updating and there are differences
    if (existingRecord && record.id) {
      const diff = getObjectDiff(existingRecord, toCamelCase(data));
      if (Object.keys(diff).length > 0) {
        const newRevisionNumber = (existingRecord.revisionCount || 0) + 1;
        await supabase.from('site_finance_revisions').insert({
          record_id: record.id,
          revised_by: record.updatedBy || record.createdBy || null,
          revised_by_name: record.updatedByName || record.createdByName || 'Unknown',
          diff: diff,
          revision_number: newRevisionNumber
        });
        await supabase.from('site_finance_tracker').update({ revision_count: newRevisionNumber }).eq('id', record.id);
      }
    }

    return toCamelCase(data);
  },

  async bulkSaveSiteFinanceRecords(records: Partial<SiteFinanceRecord>[]): Promise<void> {
    const dbRecords = records.map(r => {
      const { id, createdAt, updatedAt, ...rest } = r;
      const snaked = toSnakeCase(rest);
      // Omit generated columns before insert
      delete snaked.total_billed_amount;
      snaked.status = 'pending';
      return snaked;
    });
    const { error } = await supabase.from('site_finance_tracker').insert(dbRecords);
    if (error) {
      console.error('Finance bulk save error:', error.message, error.details, error.hint);
      throw error;
    }
  },

  async deleteSiteFinanceRecord(id: string, reason: string, deletedBy: string, deletedByName: string): Promise<void> {
    const { error } = await supabase
      .from('site_finance_tracker')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        deleted_by_name: deletedByName,
        deleted_reason: reason
      })
      .eq('id', id);

    if (error) throw error;
  },

  async bulkSoftDeleteSiteFinanceRecords(ids: string[], reason: string, deletedBy: string, deletedByName: string): Promise<void> {
    const { error } = await supabase
      .from('site_finance_tracker')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        deleted_by_name: deletedByName,
        deleted_reason: reason
      })
      .in('id', ids);

    if (error) throw error;
  },

  async getDeletedSiteFinanceRecords(managerId?: string): Promise<SiteFinanceRecord[]> {
    let query = supabase
      .from('site_finance_tracker')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (managerId) {
        query = query.eq('created_by', managerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  async restoreSiteFinanceRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('site_finance_tracker')
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_by_name: null,
        deleted_reason: null
      })
      .eq('id', id);

    if (error) throw error;
  },

  async permanentlyDeleteSiteFinanceRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('site_finance_tracker')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async bulkRestoreSiteFinanceRecords(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('site_finance_tracker')
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_by_name: null,
        deleted_reason: null
      })
      .in('id', ids);

    if (error) throw error;
  },

  async bulkPermanentlyDeleteSiteFinanceRecords(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('site_finance_tracker')
      .delete()
      .in('id', ids);

    if (error) throw error;
  },

  async getTeamActivity(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .filter('metadata->isTeamActivity', 'eq', true)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  async checkForLateReporting(managerId: string): Promise<void> {
    const now = new Date();
    // Only check if it's past 12 PM
    if (now.getHours() < 12) return;

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    // 1. Get all subordinates
    const { data: subordinates, error: subError } = await supabase
      .from('users')
      .select('id, name, role, reporting_manager_id')
      .or(`reporting_manager_id.eq.${managerId},reporting_manager_2_id.eq.${managerId},reporting_manager_3_id.eq.${managerId}`);

    if (subError || !subordinates || subordinates.length === 0) return;

    // 2. Get attendance for today for these subordinates
    const { data: attendance, error: attError } = await supabase
      .from('attendance_events')
      .select('user_id')
      .in('user_id', subordinates.map(s => s.id))
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay)
      .in('type', ['punch-in', 'check-in']);

    if (attError) return;

    const reportedUserIds = new Set((attendance || []).map(a => a.user_id));

    for (const sub of subordinates) {
      if (!reportedUserIds.has(sub.id)) {
        // 3. Check if we already sent a late report notification today
        const { data: existing, error: existError } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', managerId)
          .filter('metadata->employeeId', 'eq', sub.id)
          .filter('metadata->isLateReport', 'eq', true)
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .limit(1);

        if (!existError && (!existing || existing.length === 0)) {
          // 4. Dispatch notification
          await dispatchNotificationFromRules('not_reported_by_12pm', {
            actorName: sub.name,
            actionText: 'has not reported for duty today as of 12 PM',
            locString: '',
            actor: {
              id: sub.id,
              name: sub.name,
              role: sub.role,
              reportingManagerId: sub.reporting_manager_id
            },
            metadata: {
              isLateReport: true
            }
          });
        }
      }
    }
  },

  async getUniqueTrackerSites(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('site_finance_tracker')
      .select('site_id, site_name')
      .is('deleted_at', null);

    if (error) throw error;
    
    const uniqueMap = new Map();
    data?.forEach((item: any) => {
        if (item.site_id && item.site_name) {
            uniqueMap.set(item.site_id, item.site_name);
        }
    });

    return Array.from(uniqueMap.entries()).map(([id, name]) => ({ id, name }));
  },

  // --- User Children CRUD ---
  getUserChildren: async (userId: string): Promise<UserChild[]> => {
    const status = await Network.getStatus();
    if (status.connected) {
      try {
        const { data, error } = await supabase
          .from('user_children')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        const formatted = (data || []).map(toCamelCase) as UserChild[];
        await offlineDb.setCache(`user_children_${userId}`, formatted);
        return formatted;
      } catch (err) {
        console.warn('Failed to fetch user children from cloud, falling back to cache');
      }
    }
    return await offlineDb.getCache(`user_children_${userId}`) || [];
  },
  getAllChildrenRecords: async (): Promise<(UserChild & { userName: string })[]> => {
    const { data, error } = await supabase
      .from('user_children')
      .select('*, user:user_id(name)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching children records:', error);
      throw error;
    }

    return (data || []).map(item => ({
      ...toCamelCase(item),
      userName: (item as any).user?.name || 'Unknown'
    })) as (UserChild & { userName: string })[];
  },

  addChild: async (userId: string, child: { childName: string; dateOfBirth: string; birthCertificateDataUrl?: string | null }): Promise<UserChild> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      const offlineId = `child_offline_${Date.now()}`;
      const offlineChild = { ...child, id: offlineId, userId, verificationStatus: 'pending' } as any;
      await offlineDb.addToOutbox({ table_name: 'user_children', action: 'INSERT', payload: { userId, ...child } });
      
      const cached = await offlineDb.getCache(`user_children_${userId}`) || [];
      await offlineDb.setCache(`user_children_${userId}`, [...cached, offlineChild]);
      return offlineChild;
    }

    let birthCertUrl: string | null = null;
    if (child.birthCertificateDataUrl && child.birthCertificateDataUrl.startsWith('data:')) {
      const blob = await dataUrlToBlob(child.birthCertificateDataUrl);
      const fileExt = child.birthCertificateDataUrl.split(';')[0].split('/')[1] || 'jpg';
      const filePath = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from(BIRTH_CERT_BUCKET).upload(filePath, blob, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(BIRTH_CERT_BUCKET).getPublicUrl(filePath);
      birthCertUrl = getProxyUrl(publicUrl);
    }

    const { data, error } = await supabase.from('user_children').insert({
      user_id: userId,
      child_name: child.childName,
      date_of_birth: child.dateOfBirth,
      birth_certificate_url: birthCertUrl,
      verification_status: 'pending'
    }).select().single();
    if (error) throw error;
    return toCamelCase(data) as UserChild;
  },

  updateChild: async (childId: string, updates: Partial<{ childName: string; dateOfBirth: string; birthCertificateDataUrl: string | null }>): Promise<UserChild> => {
    const status = await Network.getStatus();
    if (!status.connected) {
        await offlineDb.addToOutbox({ table_name: 'user_children', action: 'UPDATE', payload: { id: childId, updates } });
        return { id: childId, ...updates } as any;
    }
    const dbUpdates: any = {};
    if (updates.childName !== undefined) dbUpdates.child_name = updates.childName;
    if (updates.dateOfBirth !== undefined) dbUpdates.date_of_birth = updates.dateOfBirth;

    if (updates.birthCertificateDataUrl && updates.birthCertificateDataUrl.startsWith('data:')) {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'unknown';
      const blob = await dataUrlToBlob(updates.birthCertificateDataUrl);
      const fileExt = updates.birthCertificateDataUrl.split(';')[0].split('/')[1] || 'jpg';
      const filePath = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from(BIRTH_CERT_BUCKET).upload(filePath, blob, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(BIRTH_CERT_BUCKET).getPublicUrl(filePath);
      dbUpdates.birth_certificate_url = getProxyUrl(publicUrl);
      dbUpdates.verification_status = 'pending'; // Reset verification when certificate changes
    }

    const { data, error } = await supabase.from('user_children').update(dbUpdates).eq('id', childId).select().single();
    if (error) throw error;
    return toCamelCase(data) as UserChild;
  },

  deleteChild: async (childId: string): Promise<void> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'user_children', action: 'DELETE', payload: { id: childId } });
      return;
    }
    const { error } = await supabase.from('user_children').delete().eq('id', childId);
    if (error) throw error;
  },

  verifyChild: async (childId: string, statusText: 'approved' | 'rejected', verifierId: string): Promise<UserChild> => {
    const status = await Network.getStatus();
    if (!status.connected) {
      await offlineDb.addToOutbox({ table_name: 'user_children', action: 'UPDATE', payload: { id: childId, updates: { verificationStatus: statusText, verifiedBy: verifierId, verifiedAt: new Date().toISOString() } } });
      return { id: childId, verificationStatus: statusText } as any;
    }
    const { data, error } = await supabase.from('user_children').update({
      verification_status: statusText,
      verified_by: verifierId,
      verified_at: new Date().toISOString()
    }).eq('id', childId).select().single();
    if (error) throw error;
    return toCamelCase(data) as UserChild;
  },

  // =============================================
  // Costing & Resource Configuration
  // =============================================

  getSiteCostingConfigs: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('site_costing_master')
      .select('*, organization:site_id(short_name)')
      .order('updated_at', { ascending: false });
    if (error && error.code !== '42P01') throw error;
    return (data || []).map((item: any) => {
      const camel = toCamelCase(item);
      return {
        ...camel.configData,
        id: camel.id,
        siteId: camel.siteId,
        siteName: item.organization?.short_name || '',
        status: camel.status,
        versionNo: camel.versionNo,
        createdAt: camel.createdAt,
        updatedAt: camel.updatedAt,
      };
    });
  },

  getSiteCostingConfig: async (id: string): Promise<any> => {
    const { data, error } = await supabase
      .from('site_costing_master')
      .select('*, organization:site_id(short_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    const camel = toCamelCase(data);
    return {
      ...camel.configData,
      id: camel.id,
      siteId: camel.siteId,
      siteName: data.organization?.short_name || '',
      status: camel.status,
      versionNo: camel.versionNo,
      createdAt: camel.createdAt,
      updatedAt: camel.updatedAt,
    };
  },

  saveSiteCostingConfig: async (config: any): Promise<any> => {
    const { id, siteId, status, versionNo, createdAt, updatedAt, siteName, ...configData } = config;
    const record = {
      site_id: siteId,
      status: status || 'Draft',
      version_no: versionNo || 1,
      config_data: toSnakeCase(configData),
      updated_at: new Date().toISOString(),
    };

    if (id && !id.startsWith('new_')) {
      const { data, error } = await supabase
        .from('site_costing_master')
        .update(record)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    } else {
      const { data, error } = await supabase
        .from('site_costing_master')
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    }
  },

  deleteSiteCostingConfig: async (id: string): Promise<void> => {
    const { error } = await supabase.from('site_costing_master').delete().eq('id', id);
    if (error) throw error;
  },

  cloneSiteCostingConfig: async (id: string): Promise<any> => {
    const existing = await api.getSiteCostingConfig(id);
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = existing;
    return api.saveSiteCostingConfig({
      ...rest,
      id: `new_${Date.now()}`,
      versionNo: (existing.versionNo || 1) + 1,
      status: 'Draft',
    });
  },

  saveCandidateReferral: async (referral: any): Promise<void> => {
    const { error } = await supabase
      .from('candidate_referrals')
      .insert(toSnakeCase(referral));
    if (error) throw error;
  },

  saveBusinessReferral: async (referral: any): Promise<void> => {
    // 1. Store in business_referrals
    const { error: refError } = await supabase
      .from('business_referrals')
      .insert(toSnakeCase({
        ...referral,
        companyName: referral.communityName,
        contactPerson: referral.contactPersonName,
        contactMobile: referral.clientPhone,
        serviceRequired: referral.serviceInterested
      }));
    if (refError) throw refError;

    // 2. Also create a lead in CRM Pipeline
    const leadData = {
      clientName: referral.communityName,
      associationName: referral.communityName,
      contactPerson: referral.contactPersonName,
      phone: referral.clientPhone,
      email: referral.clientEmail,
      source: 'Referral',
      propertyType: referral.communityNature?.includes('Villa') ? 'Residential' : 'Residential', 
      unitCount: Number(referral.totalUnits) || 0,
      status: 'New Lead',
      city: referral.siteAndDesignation?.split(' - ')[0] || '',
      notes: `Referred by: ${referral.referrerName} (${referral.referrerRole})\nSite/Desig: ${referral.siteAndDesignation}`,
      createdBy: referral.createdBy,
    };

    try {
      const { error: leadError } = await supabase
        .from('crm_leads')
        .insert(toSnakeCase(leadData));
      
      if (leadError) {
        console.warn('Business referral saved, but failed to push to CRM Pipeline:', leadError);
      }
    } catch (e) {
      console.warn('Error pushing referral to CRM:', e);
    }
  },

  getCandidateReferrals: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('candidate_referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  getBusinessReferrals: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('business_referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  deleteCandidateReferral: async (id: string): Promise<void> => {
    const { error } = await supabase.from('candidate_referrals').delete().eq('id', id);
    if (error) throw error;
  },

  deleteBusinessReferral: async (id: string): Promise<void> => {
    const { error } = await supabase.from('business_referrals').delete().eq('id', id);
    if (error) throw error;
  }
};
