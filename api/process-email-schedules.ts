import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay, isSameDay } from 'date-fns';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function getISTDateString(date: any = new Date()): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return format(new Date(), 'yyyy-MM-dd');
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  } catch {
    return format(new Date(), 'yyyy-MM-dd');
  }
}

function getISTTimeString(date: any = new Date()): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '09:00 PM';
    return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(d).replace(/\u202f/g, ' ');
  } catch {
    return '09:00 PM';
  }
}

function formatTimeIST(date: any, fallback = 'N/A'): string {
  if (!date) return fallback;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d).replace(/\u202f/g, ' ');
  } catch {
    return fallback;
  }
}

function formatTime24IST(date: any, fallback = '00:00'): string {
  if (!date) return fallback;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return fallback;
  }
}

function safeFormat(date: any, formatStr: string, fallback = '—') {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDailyTravelKm(events: any[]): number {
  if (!events || events.length === 0) return 0;
  
  // Group events by session (separated by punch-in)
  const sessions: any[][] = [];
  let curSession: any[] = [];
  
  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  sortedEvents.forEach(e => {
    if (e.type === 'punch-in') {
      if (curSession.length > 0) {
        sessions.push(curSession);
      }
      curSession = [e];
    } else {
      curSession.push(e);
    }
  });
  if (curSession.length > 0) {
    sessions.push(curSession);
  }
  
  let totalDailyKm = 0;
  
  sessions.forEach(sess => {
    // 1. Calculate device distance (Max - Min in session)
    const deviceValues = sess.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    let deviceDist = 0;
    if (deviceValues.length > 0) {
      const maxVal = Math.max(...deviceValues);
      const minVal = Math.min(...deviceValues);
      deviceDist = maxVal - minVal;
      
      // Special case: if there's only 1 reading, we treat it as starting from 0 if it's small,
      // or if it's large and we don't have a baseline, we reject it as a jump.
      if (deviceValues.length === 1) {
        deviceDist = deviceValues[0] > 50 ? 0 : deviceValues[0];
      }
    }
    
    // 2. Calculate haversine distance
    let haversineDist = 0;
    for (let i = 0; i < sess.length - 1; i++) {
      const current = sess[i];
      const next = sess[i + 1];
      if (current.latitude && current.longitude && next.latitude && next.longitude) {
        const dist = calculateDistanceMeters(
          Number(current.latitude), Number(current.longitude),
          Number(next.latitude), Number(next.longitude)
        ) / 1000;
        haversineDist += dist;
      }
    }
    
    // 3. Robust combination
    if (deviceDist > 0) {
      // If device says they traveled more than 100km but haversine is under 30km,
      // it's almost certainly a GPS coordinate background jump error on the device.
      if (deviceDist > 100 && haversineDist < 30) {
        totalDailyKm += haversineDist;
      } else {
        // Use device distance if it's larger (winding path), otherwise use haversine (stale device distance)
        totalDailyKm += Math.max(deviceDist, haversineDist);
      }
    } else {
      totalDailyKm += haversineDist;
    }
  });
  
  return Number(totalDailyKm.toFixed(2));
}



function evaluateConditionals(str: string, data: Record<string, string>) {
  if (!str) return '';
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (m, key, op, val2Str, t, f) => {
    const v1 = parseFloat(data[Object.keys(data).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

// Full Report Generators Logic (Synced with send-email.ts)
const reportGenerators = {
  attendance_daily: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    const todayStr = (filters?.dateRange?.start && filters?.dateRange?.end && filters?.dateRange?.start === filters?.dateRange?.end) 
      ? filters.dateRange.start 
      : getISTDateString(nowIST);
    const startOfTodayUTC = new Date(`${todayStr}T00:00:00+05:30`);
    const endOfTodayUTC = new Date(`${todayStr}T23:59:59.999+05:30`);
    const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle(),
      supabase.from('users').select('id, name, biometric_id, society_id, society_name, location_id, is_blocked, status, role_id, role:roles(display_name)').neq('role_id', 'unverified'),
      supabase.from('attendance_events')
        .select('user_id, type, timestamp')
        .gte('timestamp', startOfTodayUTC.toISOString())
        .lte('timestamp', endOfTodayUTC.toISOString())
        .order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id').eq('status', 'approved').lte('start_date', todayStr).gte('end_date', todayStr)
    ]);
    const configStartTime = settingsRes.data?.attendance_settings?.office?.fixedOfficeHours?.checkInTime || '09:30';
    let filteredUsers = (usersRes.data || []).filter((u: any) => {
      const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
      return roleName.toLowerCase() !== 'management';
    });

    // 1. Employee Status filter (all, active, inactive)
    if (filters?.filterEmployeeStatus === 'active') {
      filteredUsers = filteredUsers.filter((u: any) => !u.is_blocked && u.status !== 'left' && u.status !== 'blocked');
    } else if (filters?.filterEmployeeStatus === 'inactive') {
      filteredUsers = filteredUsers.filter((u: any) => u.is_blocked || u.status === 'left' || u.status === 'blocked');
    } else if (!filters?.filterEmployeeStatus) {
      filteredUsers = filteredUsers.filter((u: any) => !u.is_blocked && u.status !== 'left');
    }

    // 2. Employee Filter Options (eTimeTrackLite)
    if (filters?.filterEmployeeEnabled) {
      if (filters.filterEmployeeCode) {
        const codeQ = String(filters.filterEmployeeCode).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const bio = String(u.biometric_id || u.id || '').trim().toLowerCase();
          return filters.filterEmployeeExact ? bio === codeQ : bio.includes(codeQ);
        });
      }
      if (filters.filterEmployeeName) {
        const nameQ = String(filters.filterEmployeeName).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => (u.name || '').toLowerCase().includes(nameQ));
      }
      if (filters.filterEmployeeCategory && filters.filterEmployeeCategory !== 'All') {
        const catQ = String(filters.filterEmployeeCategory).toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const roleStr = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || u.role || '').toLowerCase();
          const staffCat = (u.staff_category || '').toLowerCase();
          if (staffCat) return staffCat === catQ;
          if (catQ === 'office') {
            return roleStr.includes('admin') || roleStr.includes('hr') || roleStr.includes('manager') || roleStr.includes('office') || roleStr.includes('account') || roleStr.includes('billing');
          }
          if (catQ === 'field') {
            return roleStr.includes('field') || roleStr.includes('area') || roleStr.includes('executive') || roleStr.includes('bdm');
          }
          if (catQ === 'site') {
            return roleStr.includes('site') || roleStr.includes('guard') || roleStr.includes('technician') || roleStr.includes('plumber') || roleStr.includes('electrician') || roleStr.includes('housekeeping') || roleStr.includes('security');
          }
          return true;
        });
      }
      if (filters.filterEmployeeDesignation && filters.filterEmployeeDesignation !== 'All') {
        const desigQ = String(filters.filterEmployeeDesignation).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const roleName = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '').toLowerCase();
          return roleName === desigQ;
        });
      }
      if (filters.filterEmployeeLocation && filters.filterEmployeeLocation !== 'All') {
        const locQ = String(filters.filterEmployeeLocation).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const loc = (u.society_name || u.location_id || '').toLowerCase();
          return loc.includes(locQ);
        });
      }
    }

    // 2b. Multi-select backoffice filters (filterEmployeeCategories / Designations / Locations)
    const matchCategoryKeywords = (roleStr: string, catQ: string) => {
      if (catQ === 'office') return roleStr.includes('admin') || roleStr.includes('hr') || roleStr.includes('manager') || roleStr.includes('office') || roleStr.includes('account') || roleStr.includes('billing');
      if (catQ === 'field') return roleStr.includes('field') || roleStr.includes('area') || roleStr.includes('executive') || roleStr.includes('bdm');
      if (catQ === 'site') return roleStr.includes('site') || roleStr.includes('guard') || roleStr.includes('technician') || roleStr.includes('plumber') || roleStr.includes('electrician') || roleStr.includes('housekeeping') || roleStr.includes('security');
      return false;
    };
    if (Array.isArray(filters?.filterEmployeeCategories) && filters.filterEmployeeCategories.length > 0) {
      const cats = filters.filterEmployeeCategories.map((c: string) => c.toLowerCase());
      filteredUsers = filteredUsers.filter((u: any) => {
        const roleStr = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '').toLowerCase();
        const staffCat = (u.staff_category || '').toLowerCase();
        return cats.some((catQ: string) => staffCat ? staffCat === catQ : matchCategoryKeywords(roleStr, catQ));
      });
    }
    if (Array.isArray(filters?.filterEmployeeDesignations) && filters.filterEmployeeDesignations.length > 0) {
      const desigs = filters.filterEmployeeDesignations.map((d: string) => d.trim().toLowerCase());
      filteredUsers = filteredUsers.filter((u: any) => {
        const roleName = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '').toLowerCase();
        return desigs.includes(roleName);
      });
    }
    if (Array.isArray(filters?.filterEmployeeLocations) && filters.filterEmployeeLocations.length > 0) {
      const locs = filters.filterEmployeeLocations.map((l: string) => l.trim().toLowerCase());
      filteredUsers = filteredUsers.filter((u: any) => {
        const loc = (u.society_name || u.location_id || '').toLowerCase();
        return locs.some((lq: string) => loc.includes(lq) || lq.includes(loc));
      });
    }

    // 3. Single Company Filter or Multi-Company Filter
    if (filters?.filterCompany && filters.filterCompany !== 'all') {
      const compQ = filters.filterCompany.trim().toLowerCase();
      filteredUsers = filteredUsers.filter((u: any) => {
        const comp = (u.society_name || u.organization_name || '').toLowerCase();
        return comp.includes(compQ);
      });
    } else if (filters?.filterCompanyEnabled && Array.isArray(filters.filterCompanies) && filters.filterCompanies.length > 0) {
      const allowedComps = filters.filterCompanies.map((c: string) => c.trim().toLowerCase());
      filteredUsers = filteredUsers.filter((u: any) => {
        const comp = (u.society_name || u.organization_name || '').toLowerCase();
        return allowedComps.some((ac: string) => comp.includes(ac) || ac.includes(comp));
      });
    }

    // 4. Single Site Filter or Multi-Department Filter
    if (filters?.filterSite && filters.filterSite !== 'all') {
      const siteQ = filters.filterSite.trim().toLowerCase();
      filteredUsers = filteredUsers.filter((u: any) => {
        const site = (u.society_name || u.location_id || u.organization_name || '').toLowerCase();
        return site.includes(siteQ);
      });
    } else if (filters?.filterDepartmentEnabled && Array.isArray(filters.filterDepartments) && filters.filterDepartments.length > 0) {
      const allowedDepts = filters.filterDepartments.map((d: string) => d.trim().toLowerCase());
      filteredUsers = filteredUsers.filter((u: any) => {
        const dept = (u.society_name || u.location_id || u.organization_name || '').toLowerCase();
        return allowedDepts.some((ad: string) => dept.includes(ad) || ad.includes(dept));
      });
    }

    // 5. Single Location Filter
    if (filters?.filterEmployeeLocation && filters.filterEmployeeLocation !== 'all' && (!Array.isArray(filters?.filterEmployeeLocations) || filters.filterEmployeeLocations.length === 0)) {
      const locQ = filters.filterEmployeeLocation.trim().toLowerCase();
      filteredUsers = filteredUsers.filter((u: any) => {
        const loc = (u.society_name || u.location_id || '').toLowerCase();
        return loc.includes(locQ);
      });
    }

    // 6. Single Employee Filter (by ID or name)
    if (filters?.filterEmployeeUserId && filters.filterEmployeeUserId !== 'all') {
      filteredUsers = filteredUsers.filter((u: any) => u.id === filters.filterEmployeeUserId);
    }

    const staffIds = new Set(filteredUsers.map((u: any) => u.id));
    const todayEvents = (eventsRes.data || []).filter((e: any) => staffIds.has(e.user_id));
    const onLeaveUserIds = new Set((leavesRes.data || []).map((l: any) => l.user_id));
    const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
    const { data: recentEvents } = await supabase.from('attendance_events').select('user_id').gte('timestamp', tenDaysAgoUTC.toISOString());
    const recentlyActiveUserIds = new Set((recentEvents || []).map((e: any) => e.user_id));
    const presentUserIds = new Set<string>();
    const userFirstPunches: Record<string, string> = {};
    todayEvents.forEach((e: any) => {
      presentUserIds.add(e.user_id);
      if ((e.type === 'punch-in' || e.type === 'check_in') && !userFirstPunches[e.user_id]) userFirstPunches[e.user_id] = e.timestamp;
    });

    // 7. Status Filter
    if (filters?.filterEmployeeStatus && filters.filterEmployeeStatus !== 'all') {
      if (filters.filterEmployeeStatus === 'active') {
        filteredUsers = filteredUsers.filter((u: any) => u.is_active !== false);
      } else if (filters.filterEmployeeStatus === 'inactive') {
        filteredUsers = filteredUsers.filter((u: any) => u.is_active === false);
      } else if (filters.filterEmployeeStatus === 'ACTIVE_USERS') {
        filteredUsers = filteredUsers.filter((u: any) => recentlyActiveUserIds.has(u.id) || presentUserIds.has(u.id));
      } else if (filters.filterEmployeeStatus === 'P') {
        filteredUsers = filteredUsers.filter((u: any) => presentUserIds.has(u.id));
      } else if (filters.filterEmployeeStatus === 'A') {
        filteredUsers = filteredUsers.filter((u: any) => !presentUserIds.has(u.id) && !onLeaveUserIds.has(u.id));
      }
    }

    // 8. Record Type Filter
    if (filters?.filterRecordType && filters.filterRecordType !== 'all') {
      filteredUsers = filteredUsers.filter((u: any) => {
        const uEvents = todayEvents.filter((e: any) => e.user_id === u.id);
        const hasIn = uEvents.some((e: any) => e.type === 'punch-in' || e.type === 'check_in');
        const hasOut = uEvents.some((e: any) => e.type === 'punch-out' || e.type === 'check_out');
        if (filters.filterRecordType === 'complete') return hasIn && hasOut;
        if (filters.filterRecordType === 'missing_checkout') return hasIn && !hasOut;
        if (filters.filterRecordType === 'missing_checkin') return !hasIn && hasOut;
        if (filters.filterRecordType === 'incomplete') return (hasIn && !hasOut) || (!hasIn && hasOut);
        return true;
      });
    }

    // 9. Show Records Limit
    if (typeof filters?.filterShowRecords === 'number' && filters.filterShowRecords > 0) {
      filteredUsers = filteredUsers.slice(0, filters.filterShowRecords);
    }
    let tableHtml = '';
    let lateCount = 0;
    filteredUsers.forEach((user: any, i: number) => {
      let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
      dept = dept.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
      if (presentUserIds.has(user.id)) {
        const inTs = userFirstPunches[user.id];
        pin = formatTimeIST(inTs, '—');
        const inTime = formatTime24IST(inTs, '00:00');
        if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; lateCount++; }
        const lastOut = todayEvents.filter((e: any) => e.user_id === user.id && (e.type === 'punch-out' || e.type === 'check_out')).pop();
        if (lastOut) {
          pout = formatTimeIST(lastOut.timestamp, '—');
          const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
          wh = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
        }
      } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
      else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
      else { status = 'Inactive'; color = '#9ca3af'; }
      tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}"><td style="border:1px solid #eee;padding:8px">${i+1}</td><td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td><td style="border:1px solid #eee;padding:8px">${dept}</td><td style="border:1px solid #eee;padding:8px">${pin}</td><td style="border:1px solid #eee;padding:8px">${pout}</td><td style="border:1px solid #eee;padding:8px">${wh}</td><td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td></tr>`;
    });
    const totalPresent = presentUserIds.size;
    const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
    const parsedTargetDate = new Date(`${todayStr}T12:00:00+05:30`);
    return {
      date: format(parsedTargetDate, 'EEEE, MMMM do, yyyy'),
      reportDate: format(parsedTargetDate, 'dd MMM yyyy'),
      generatedTime: getISTTimeString(new Date()),
      year: format(parsedTargetDate, 'yyyy'),
      totalEmployees: String(filteredUsers.length),
      activeStaff: String(filteredUsers.length),
      totalStaff: String(filteredUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(Math.max(0, filteredUsers.length - totalPresent - onLeaveCount)),
      lateCount: String(lateCount),
      attendancePercentage: filteredUsers.length > 0 ? Math.round((totalPresent/filteredUsers.length)*100).toString() : '0',
      onLeaveCount: String(onLeaveCount),
      table: tableHtml || '<tr><td colspan="7">No data</td></tr>'
    };
  },
  attendance_site_daily: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    // Site Daily Attendance — same data pipeline as attendance_daily but:
    // • Company/Entity (filterCompanyEnabled + filterCompanies) and
    // • Department/Site (filterDepartmentEnabled + filterDepartments) filters are the primary selectors
    // • Also defaults to site-category staff if no explicit category is set
    const todayStr = (filters?.dateRange?.start && filters?.dateRange?.end && filters?.dateRange?.start === filters?.dateRange?.end)
      ? filters.dateRange.start
      : getISTDateString(nowIST);
    const startOfTodayUTC = new Date(`${todayStr}T00:00:00+05:30`);
    const endOfTodayUTC = new Date(`${todayStr}T23:59:59.999+05:30`);
    const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle(),
      supabase.from('users').select('id, name, biometric_id, society_id, society_name, location_id, is_blocked, status, role_id, role:roles(display_name)').neq('role_id', 'unverified'),
      supabase.from('attendance_events')
        .select('user_id, type, timestamp')
        .gte('timestamp', startOfTodayUTC.toISOString())
        .lte('timestamp', endOfTodayUTC.toISOString())
        .order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id').eq('status', 'approved').lte('start_date', todayStr).gte('end_date', todayStr)
    ]);
    const configStartTime = settingsRes.data?.attendance_settings?.office?.fixedOfficeHours?.checkInTime || '09:30';
    let filteredUsers = (usersRes.data || []).filter((u: any) => {
      const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
      return roleName.toLowerCase() !== 'management';
    });

    // 1. Employee Status filter
    if (filters?.filterEmployeeStatus === 'active') {
      filteredUsers = filteredUsers.filter((u: any) => !u.is_blocked && u.status !== 'left' && u.status !== 'blocked');
    } else if (filters?.filterEmployeeStatus === 'inactive') {
      filteredUsers = filteredUsers.filter((u: any) => u.is_blocked || u.status === 'left' || u.status === 'blocked');
    } else if (!filters?.filterEmployeeStatus) {
      filteredUsers = filteredUsers.filter((u: any) => !u.is_blocked && u.status !== 'left');
    }

    // 2. Employee Criteria filter (code, name, category, designation, location)
    if (filters?.filterEmployeeEnabled) {
      if (filters.filterEmployeeCode) {
        const codeQ = String(filters.filterEmployeeCode).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const bio = String(u.biometric_id || u.id || '').trim().toLowerCase();
          return filters.filterEmployeeExact ? bio === codeQ : bio.includes(codeQ);
        });
      }
      if (filters.filterEmployeeName) {
        const nameQ = String(filters.filterEmployeeName).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => (u.name || '').toLowerCase().includes(nameQ));
      }
      if (filters.filterEmployeeCategory && filters.filterEmployeeCategory !== 'All') {
        const catQ = String(filters.filterEmployeeCategory).toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const roleStr = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || u.role || '').toLowerCase();
          const staffCat = (u.staff_category || '').toLowerCase();
          if (staffCat) return staffCat === catQ;
          if (catQ === 'site') {
            return roleStr.includes('site') || roleStr.includes('guard') || roleStr.includes('technician') || roleStr.includes('plumber') || roleStr.includes('electrician') || roleStr.includes('housekeeping') || roleStr.includes('security');
          }
          if (catQ === 'office') {
            return roleStr.includes('admin') || roleStr.includes('hr') || roleStr.includes('manager') || roleStr.includes('office') || roleStr.includes('account') || roleStr.includes('billing');
          }
          if (catQ === 'field') {
            return roleStr.includes('field') || roleStr.includes('area') || roleStr.includes('executive') || roleStr.includes('bdm');
          }
          return true;
        });
      }
      if (filters.filterEmployeeDesignation && filters.filterEmployeeDesignation !== 'All') {
        const desigQ = String(filters.filterEmployeeDesignation).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const roleName = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '').toLowerCase();
          return roleName === desigQ;
        });
      }
      if (filters.filterEmployeeLocation && filters.filterEmployeeLocation !== 'All') {
        const locQ = String(filters.filterEmployeeLocation).trim().toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const loc = (u.society_name || u.location_id || '').toLowerCase();
          return loc.includes(locQ);
        });
      }
    }

    // 3. Company / Entity filter (primary site filter)
    if (filters?.filterCompanyEnabled && Array.isArray(filters.filterCompanies) && filters.filterCompanies.length > 0) {
      const allowedComps = filters.filterCompanies.map((c: string) => c.trim().toLowerCase());
      filteredUsers = filteredUsers.filter((u: any) => {
        const comp = (u.society_name || u.organization_name || '').toLowerCase();
        return allowedComps.some((ac: string) => comp.includes(ac) || ac.includes(comp));
      });
    }

    // 4. Department / Site filter (primary site filter)
    if (filters?.filterDepartmentEnabled && Array.isArray(filters.filterDepartments) && filters.filterDepartments.length > 0) {
      const allowedDepts = filters.filterDepartments.map((d: string) => d.trim().toLowerCase());
      filteredUsers = filteredUsers.filter((u: any) => {
        const dept = (u.society_name || u.location_id || u.organization_name || '').toLowerCase();
        return allowedDepts.some((ad: string) => dept.includes(ad) || ad.includes(dept));
      });
    }

    const staffIds = new Set(filteredUsers.map((u: any) => u.id));
    const todayEvents = (eventsRes.data || []).filter((e: any) => staffIds.has(e.user_id));
    const onLeaveUserIds = new Set((leavesRes.data || []).map((l: any) => l.user_id));
    const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
    const { data: recentEvents } = await supabase.from('attendance_events').select('user_id').gte('timestamp', tenDaysAgoUTC.toISOString());
    const recentlyActiveUserIds = new Set((recentEvents || []).map((e: any) => e.user_id));
    const presentUserIds = new Set<string>();
    const userFirstPunches: Record<string, string> = {};
    todayEvents.forEach((e: any) => {
      presentUserIds.add(e.user_id);
      if ((e.type === 'punch-in' || e.type === 'check_in') && !userFirstPunches[e.user_id]) userFirstPunches[e.user_id] = e.timestamp;
    });
    let tableHtml = '';
    let lateCount = 0;
    filteredUsers.forEach((user: any, i: number) => {
      let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
      dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const siteName = user.society_name || user.location_id || '—';
      let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
      if (presentUserIds.has(user.id)) {
        const inTs = userFirstPunches[user.id];
        pin = formatTimeIST(inTs, '—');
        const inTime = formatTime24IST(inTs, '00:00');
        if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; lateCount++; }
        const lastOut = todayEvents.filter((e: any) => e.user_id === user.id && (e.type === 'punch-out' || e.type === 'check_out')).pop();
        if (lastOut) {
          pout = formatTimeIST(lastOut.timestamp, '—');
          const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
          wh = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
        }
      } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
      else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
      else { status = 'Inactive'; color = '#9ca3af'; }
      tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}"><td style="border:1px solid #eee;padding:8px">${i+1}</td><td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td><td style="border:1px solid #eee;padding:8px">${dept}</td><td style="border:1px solid #eee;padding:8px;color:#475569">${siteName}</td><td style="border:1px solid #eee;padding:8px">${pin}</td><td style="border:1px solid #eee;padding:8px">${pout}</td><td style="border:1px solid #eee;padding:8px">${wh}</td><td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td></tr>`;
    });
    const totalPresent = presentUserIds.size;
    const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
    const parsedTargetDate = new Date(`${todayStr}T12:00:00+05:30`);
    return {
      date: format(parsedTargetDate, 'EEEE, MMMM do, yyyy'),
      reportDate: format(parsedTargetDate, 'dd MMM yyyy'),
      generatedTime: getISTTimeString(new Date()),
      year: format(parsedTargetDate, 'yyyy'),
      totalEmployees: String(filteredUsers.length),
      activeStaff: String(filteredUsers.length),
      totalStaff: String(filteredUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(Math.max(0, filteredUsers.length - totalPresent - onLeaveCount)),
      lateCount: String(lateCount),
      attendancePercentage: filteredUsers.length > 0 ? Math.round((totalPresent/filteredUsers.length)*100).toString() : '0',
      onLeaveCount: String(onLeaveCount),
      table: tableHtml || '<tr><td colspan="8">No data</td></tr>'
    };
  },
  attendance_monthly: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    const targetDate = filters?.dateRange?.start ? new Date(filters.dateRange.start) : nowIST;
    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const monthStr = format(targetDate, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();
    const today = new Date();

    const startUtc = new Date(`${format(firstDayOfMonth, 'yyyy-MM-dd')}T00:00:00+05:30`);
    const endUtc = new Date(`${format(lastDayOfMonth, 'yyyy-MM-dd')}T23:59:59.999+05:30`);

    const [settingsRes, usersRes, snapshotsRes, eventsRes, leavesRes, holidaysRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle(),
      supabase.from('users').select('id, name, biometric_id, society_id, society_name, location_id, is_blocked, status, role_id, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
      supabase.from('attendance_month_snapshots').select('*').eq('year', targetDate.getFullYear()).eq('month', targetDate.getMonth() + 1),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', startUtc.toISOString()).lte('timestamp', endUtc.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id, start_date, end_date, leave_type, status, day_option').eq('status', 'approved').gte('end_date', getISTDateString(firstDayOfMonth)).lte('start_date', getISTDateString(lastDayOfMonth)),
      supabase.from('holidays').select('*').gte('date', getISTDateString(firstDayOfMonth)).lte('date', getISTDateString(lastDayOfMonth))
    ]);

    const users = (usersRes.data || []) as any[];
    const events = (eventsRes.data || []) as any[];
    const leaves = (leavesRes.data || []) as any[];
    const holidays = (holidaysRes.data || []) as any[];
    const snapshots = (snapshotsRes.data || []) as any[];

    let targetUsers = users;

    // 1. Employee Status filter (all, active, inactive)
    if (filters?.filterEmployeeStatus === 'active') {
      targetUsers = targetUsers.filter((u: any) => !u.is_blocked && u.status !== 'left' && u.status !== 'blocked');
    } else if (filters?.filterEmployeeStatus === 'inactive') {
      targetUsers = targetUsers.filter((u: any) => u.is_blocked || u.status === 'left' || u.status === 'blocked');
    } else if (!filters?.filterEmployeeStatus) {
      targetUsers = targetUsers.filter((u: any) => !u.is_blocked && u.status !== 'left');
    }

    // 2. Specific user or role filter
    if (filters?.user?.id) {
      targetUsers = targetUsers.filter(u => u.id === filters.user.id);
    } else if (filters?.role) {
      targetUsers = targetUsers.filter((u: any) => {
        const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
        return roleName.toLowerCase() === filters.role.toLowerCase();
      });
    }

    // 3. Employee Filter Options (eTimeTrackLite)
    if (filters?.filterEmployeeEnabled) {
      if (filters.filterEmployeeCode) {
        const codeQ = String(filters.filterEmployeeCode).trim().toLowerCase();
        targetUsers = targetUsers.filter((u: any) => {
          const bio = String(u.biometric_id || u.id || '').trim().toLowerCase();
          return filters.filterEmployeeExact ? bio === codeQ : bio.includes(codeQ);
        });
      }
      if (filters.filterEmployeeName) {
        const nameQ = String(filters.filterEmployeeName).trim().toLowerCase();
        targetUsers = targetUsers.filter((u: any) => (u.name || '').toLowerCase().includes(nameQ));
      }
      if (filters.filterEmployeeCategory && filters.filterEmployeeCategory !== 'All') {
        const catQ = String(filters.filterEmployeeCategory).toLowerCase();
        targetUsers = targetUsers.filter((u: any) => {
          const roleStr = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || u.role || '').toLowerCase();
          const staffCat = (u.staff_category || '').toLowerCase();
          if (staffCat) return staffCat === catQ;
          if (catQ === 'office') {
            return roleStr.includes('admin') || roleStr.includes('hr') || roleStr.includes('manager') || roleStr.includes('office') || roleStr.includes('account') || roleStr.includes('billing');
          }
          if (catQ === 'field') {
            return roleStr.includes('field') || roleStr.includes('area') || roleStr.includes('executive') || roleStr.includes('bdm');
          }
          if (catQ === 'site') {
            return roleStr.includes('site') || roleStr.includes('guard') || roleStr.includes('technician') || roleStr.includes('plumber') || roleStr.includes('electrician') || roleStr.includes('housekeeping') || roleStr.includes('security');
          }
          return true;
        });
      }
      if (filters.filterEmployeeDesignation && filters.filterEmployeeDesignation !== 'All') {
        const desigQ = String(filters.filterEmployeeDesignation).trim().toLowerCase();
        targetUsers = targetUsers.filter((u: any) => {
          const roleName = ((Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '').toLowerCase();
          return roleName === desigQ;
        });
      }
      if (filters.filterEmployeeLocation && filters.filterEmployeeLocation !== 'All') {
        const locQ = String(filters.filterEmployeeLocation).trim().toLowerCase();
        targetUsers = targetUsers.filter((u: any) => {
          const loc = (u.society_name || u.location_id || '').toLowerCase();
          return loc.includes(locQ);
        });
      }
    }

    // 4. Company Filter
    if (filters?.filterCompanyEnabled && Array.isArray(filters.filterCompanies) && filters.filterCompanies.length > 0) {
      const allowedComps = filters.filterCompanies.map((c: string) => c.trim().toLowerCase());
      targetUsers = targetUsers.filter((u: any) => {
        const comp = (u.society_name || u.organization_name || '').toLowerCase();
        return allowedComps.some((ac: string) => comp.includes(ac) || ac.includes(comp));
      });
    }

    // 5. Department / Site Filter
    if (filters?.filterDepartmentEnabled && Array.isArray(filters.filterDepartments) && filters.filterDepartments.length > 0) {
      const allowedDepts = filters.filterDepartments.map((d: string) => d.trim().toLowerCase());
      targetUsers = targetUsers.filter((u: any) => {
        const dept = (u.society_name || u.location_id || u.organization_name || '').toLowerCase();
        return allowedDepts.some((ad: string) => dept.includes(ad) || ad.includes(dept));
      });
    }

    let totalPresentCount = 0;
    let totalAbsentCount = 0;
    const totalLateCount = 0;

    let tableHtml = `<style>
.report-grid { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8px; border: 1px solid #e2e8f0; }
.report-grid th { border: 1px solid #e2e8f0; padding: 6px 3px; font-weight: 700; background-color: #f8fafc; color: #1e293b; }
.report-grid td { border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; color: #334155; }
.report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 120px; padding: 6px 6px; color: #0f172a; }
.report-grid td.p { color: #166534; font-weight: bold; background-color: #f0fdf4; }
.report-grid td.a { color: #991b1b; background-color: #fef2f2; }
.report-grid td.wo { color: #4b5563; background-color: #f9fafb; }
.report-grid td.h { color: #854d0e; background-color: #fffbeb; font-weight: bold; }
.report-grid td.hd { color: #92400e; background-color: #fffbeb; font-weight: bold; }
.report-grid td.ot { color: #075985; background-color: #f0f9ff; font-weight: bold; }
.report-grid td.co { color: #9d174d; background-color: #fdf2f8; font-weight: bold; }
.report-grid td.el { color: #5b21b6; background-color: #f5f3ff; font-weight: bold; }
.report-grid td.sl { color: #9f1239; background-color: #fff1f2; font-weight: bold; }
.report-grid td.tot { font-weight: 800; background-color: #ecfdf5; color: #065f46; border-left: 2px solid #10b981; }
.report-grid tr.even { background-color: #ffffff; }
.report-grid tr.odd { background-color: #f8fafc; }
</style>
<table class="report-grid">
    <thead>
      <tr style="background: #f8fafc; color: #1e293b; border-bottom: 2px solid #e2e8f0;">
        <th style="border: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; min-width: 140px; font-weight: 700;">Employee Name</th>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      tableHtml += `<th style="border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; width: 22px; font-size: 9px; font-weight: 600;">${d}</th>`;
    }
    tableHtml += `
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f0fdf4; color: #166534; width: 25px; font-weight: 700;">P</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fffbeb; color: #92400e; width: 35px; font-weight: 700;">0.5P</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f0f9ff; color: #075985; width: 25px; font-weight: 700;">OT</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fdf2f8; color: #9d174d; width: 25px; font-weight: 700;">C/O</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f5f3ff; color: #5b21b6; width: 25px; font-weight: 700;">E/L</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fff1f2; color: #9f1239; width: 25px; font-weight: 700;">S/L</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fef2f2; color: #991b1b; width: 25px; font-weight: 700;">A</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f9fafb; color: #4b5563; width: 30px; font-weight: 700;">W/O</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fffbeb; color: #854d0e; width: 25px; font-weight: 700;">H</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #ecfdf5; color: #065f46; width: 35px; font-weight: 800; border-left: 2px solid #10b981;">Pay</th>
        </tr>
    </thead>
    <tbody>`;

    targetUsers.forEach((user, idx) => {
      tableHtml += `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td class="emp-name">${user.name}</td>`;
      
      const countOT = 0;
      let countP = 0, countHalfP = 0, countCO = 0, countEL = 0, countSL = 0, countA = 0, countWO = 0, countH = 0, userPaidLeave = 0;
      let daysPresentInWeek = 0;

      const userSnapshot = snapshots.find(s => s.employee_id === user.id);

      for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), d);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const isFuture = currentDate > today;
        const isSunday = currentDate.getDay() === 0;
        const isMonday = currentDate.getDay() === 1;
        if (isMonday) daysPresentInWeek = 0;

        if (isFuture) {
          tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 2px; text-align: center; color: #ccc; font-size: 8px;">—</td>`;
          continue;
        }

        let status = '', color = '#64748b', cellBg = 'transparent';

        const snapshotDay = userSnapshot?.daily_data?.find((item: any) => 
          item.date === d || 
          String(item.date) === String(d) || 
          item.date === dateStr || 
          String(item.date).padStart(2, '0') === String(d).padStart(2, '0')
        );

        if (snapshotDay && snapshotDay.status && snapshotDay.status !== 'A') {
          status = snapshotDay.status;
          if (status === 'P') { countP++; totalPresentCount++; }
          else if (status === '0.5P' || status === '1/2P') { countHalfP++; totalPresentCount += 0.5; status = '0.5P'; }
          else if (status === 'H') countH++;
          else if (status === 'W/O' || status === 'WO') countWO++;
          else if (status.includes('SL')) { countSL += status.includes('0.5') ? 0.5 : 1; userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
          else if (status.includes('EL') || status.includes('E/L')) { countEL += status.includes('0.5') ? 0.5 : 1; userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
          else if (status.includes('CO') || status.includes('C/O')) { countCO += status.includes('0.5') ? 0.5 : 1; userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
          else if (status.includes('L')) { userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
        } else {
          const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(e.timestamp) === dateStr);
          const dayLeave = leaves.find(l => l.user_id === user.id && dateStr >= l.start_date && dateStr <= l.end_date);
          const isPublicHoliday = holidays.find(h => h.date === dateStr);
          
          const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
          const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

          if (punchIn || punchOut) {
            status = 'P'; color = '#16a34a'; cellBg = '#f0fdf4'; countP++; totalPresentCount++;
          } else if (dayLeave) {
            const isHalfDay = dayLeave.day_option === 'half';
            const leaveType = dayLeave.leave_type?.toLowerCase() || '';
            if (leaveType === 'loss of pay' || leaveType === 'lop') {
              status = isHalfDay ? '0.5A' : 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA += isHalfDay ? 0.5 : 1; totalAbsentCount += isHalfDay ? 0.5 : 1;
            } else {
              if (leaveType.includes('sick')) { status = isHalfDay ? '0.5SL' : 'S/L'; countSL += isHalfDay ? 0.5 : 1; cellBg = '#fff1f2'; }
              else if (leaveType.includes('earned') || leaveType.includes('annual')) { status = isHalfDay ? '0.5EL' : 'E/L'; countEL += isHalfDay ? 0.5 : 1; cellBg = '#f5f3ff'; }
              else if (leaveType.includes('comp') || leaveType.includes('c/o')) { status = isHalfDay ? '0.5CO' : 'C/O'; countCO += isHalfDay ? 0.5 : 1; cellBg = '#fdf2f8'; }
              else { status = isHalfDay ? '0.5L' : 'L'; cellBg = '#eff6ff'; }
              color = '#2563eb'; userPaidLeave += isHalfDay ? 0.5 : 1;
            }
          } else if (isPublicHoliday) {
            status = 'H'; color = '#854d0e'; cellBg = '#fef3c7'; countH++;
          } else if (isSunday) {
            if (daysPresentInWeek >= 3) {
              status = 'W/O'; color = '#64748b'; cellBg = '#f1f5f9'; countWO++;
            } else {
              status = 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA++; totalAbsentCount++;
            }
          } else {
            status = 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA++; totalAbsentCount++;
          }

          if (['P', '0.5P', 'L', 'EL', 'SL', 'CO', 'C/O', 'H'].some(s => status.includes(s))) daysPresentInWeek++;
        }

        let cellClass = "";
        if (status === 'P') cellClass = 'class="p"';
        else if (status === 'A') cellClass = 'class="a"';
        else if (status === 'W/O' || status === 'WO') cellClass = 'class="wo"';
        else if (status === 'H') cellClass = 'class="h"';
        else if (status.includes('0.5')) cellClass = 'class="hd"';
        else if (status.includes('SL')) cellClass = 'class="sl"';
        else if (status.includes('EL')) cellClass = 'class="el"';
        else if (status.includes('CO') || status.includes('C/O')) cellClass = 'class="co"';
        else if (status === '—') cellClass = '';
        else cellClass = `style="color: ${color}; background: ${cellBg}; font-weight: 700;"`;

        tableHtml += `<td ${cellClass}>${status || '—'}</td>`;
      }

      const payableDays = countP + (countHalfP * 0.5) + countWO + countH + userPaidLeave;
      tableHtml += `<td class="p">${countP}</td><td class="hd">${countHalfP}</td><td class="ot">${countOT}</td><td class="co">${countCO}</td><td class="el">${countEL}</td><td class="sl">${countSL}</td><td class="a">${countA}</td><td class="wo">${countWO}</td><td class="h">${countH}</td><td class="tot">${payableDays}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    
    // Add Legend
    tableHtml += `<div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; font-family: sans-serif;">
      <table style="width: 100%; border-collapse: collapse; text-align: center;">
        <tr>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #166534; font-weight: bold;">P:</span> PRESENT</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #991b1b; font-weight: bold;">A:</span> ABSENT</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #991b1b; font-weight: bold;">LOP:</span> LOSS OF PAY</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #92400e; font-weight: bold;">0.5P:</span> HALF DAY</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #155e75; font-weight: bold;">W/H:</span> WFH</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #0c4a6e; font-weight: bold;">W/P:</span> WEEK OFF WORK</td>
        </tr>
        <tr>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #475569; font-weight: bold;">W/O:</span> WEEKLY OFF</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #b45309; font-weight: bold;">H:</span> HOLIDAY</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #0369a1; font-weight: bold;">OT(P):</span> OT / EXTRAP</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #6d28d9; font-weight: bold;">S/L:</span> SICK LEAVE</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #4338ca; font-weight: bold;">E/L:</span> EARNED LEAVE</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #be185d; font-weight: bold;">C/O:</span> COMP OFF</td>
        </tr>
      </table>
      <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Paradigm Services - Monthly Status Report</div>
    </div>`;

    const totalPossible = targetUsers.length * daysInMonth;
    const attendancePercentage = totalPossible > 0 ? Math.round((totalPresentCount / totalPossible) * 100) : 0;
    const billingCycle = `01 ${safeFormat(targetDate, 'MMM yyyy')} - ${daysInMonth} ${safeFormat(targetDate, 'MMM yyyy')}`;

    return { 
      date: monthStr, 
      reportDate: safeFormat(new Date(), 'dd MMM yyyy'),
      generatedTime: getISTTimeString(new Date()),
      year: safeFormat(targetDate, 'yyyy'),
      totalEmployees: String(targetUsers.length), 
      activeStaff: String(targetUsers.length),
      totalStaff: String(targetUsers.length),
      table: tableHtml,
      attendancePercentage: String(attendancePercentage),
      totalAbsent: String(Math.round(totalAbsentCount)),
      lateCount: String(totalLateCount),
      logo: (filters?.showCompanyLogo === false) ? '' : '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
      totalPresent: String(Math.round(totalPresentCount)),
      generatedBy: filters?.triggeredBy || 'Automated Schedule',
      billingCycle: billingCycle
    };
  },
  document_expiry: async (s:any,now:any) => { return {date:format(now,'yyyy-MM-dd')}; },
  crm_bd_daily: async (supabase: SupabaseClient, nowIST: Date) => {
    const todayStr = getISTDateString(nowIST);
    const startOfTodayUTC = new Date(`${todayStr}T00:00:00+05:30`);
    const endOfTodayUTC = new Date(`${todayStr}T23:59:59.999+05:30`);
    const sevenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - 7 * 24 * 3600000);

    const { data: usersRes } = await supabase.from('users').select('id, name, role_id, role:roles(display_name)').eq('is_blocked', false);
    const bdUsers = (usersRes || []).filter((u: any) => {
      const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
      const roleId = (u.role_id || '').toLowerCase();
      const rName = roleName.toLowerCase();
      return rName === 'business developer' || rName === 'business_developer' || rName === 'bd' || roleId === 'business_developer' || roleId === 'bd';
    });

    if (bdUsers.length === 0) {
      const defaultDate = format(nowIST, 'dd MMM yyyy');
      return [{
        date: defaultDate,
        bd_name: 'All BDs',
        bdName: 'All BDs',
        report_date: defaultDate,
        reportDate: defaultDate,
        attendance_status: 'No Active BDs',
        attendanceStatus: 'No Active BDs',
        check_in_time: 'N/A',
        checkInTime: 'N/A',
        check_out_time: 'N/A',
        checkOutTime: 'N/A',
        working_hours: '0h 0m',
        workingHours: '0h 0m',
        kms_travelled: '0',
        kmsTravelled: '0',
        prospect_calls: '0',
        prospectCalls: '0',
        followup_calls: '0',
        followupCalls: '0',
        new_leads_count: '0',
        newLeadsCount: '0',
        sites_count: '0',
        sitesCount: '0',
        sites_visited: 'None',
        sitesVisited: 'None',
        new_leads_table: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
        newLeadsTable: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
        metrics_table: '<div style="padding:16px;text-align:center;color:#64748b;">No activity metrics available.</div>',
        metricsTable: '<div style="padding:16px;text-align:center;color:#64748b;">No activity metrics available.</div>',
        pipeline_snapshot: '<div style="padding:16px;text-align:center;color:#64748b;">No pipeline data available.</div>',
        pipelineSnapshot: '<div style="padding:16px;text-align:center;color:#64748b;">No pipeline data available.</div>'
      }];
    }

    const [eventsRes, leadsRes, callsRes, allLeadsRes, sevenDayFollowupsRes, sevenDayEventsRes] = await Promise.all([
      supabase.from('attendance_events').select('user_id, type, timestamp, latitude, longitude, travel_distance').gte('timestamp', startOfTodayUTC.toISOString()).lte('timestamp', endOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('crm_leads').select('id, created_by, assigned_to, company_name, client_name, association_name, contact_person, status, source, city, created_at, stage_updated_at, updated_at, next_followup_date, lost_reason').gte('created_at', startOfTodayUTC.toISOString()).lte('created_at', endOfTodayUTC.toISOString()),
      supabase.from('crm_followups').select('created_by, type, outcome, lead_id, created_at, next_followup_date').gte('created_at', startOfTodayUTC.toISOString()).lte('created_at', endOfTodayUTC.toISOString()),
      supabase.from('crm_leads').select('id, created_by, assigned_to, company_name, client_name, association_name, contact_person, status, source, city, created_at, stage_updated_at, updated_at, next_followup_date, lost_reason'),
      supabase.from('crm_followups').select('created_by, type, outcome, lead_id, created_at, next_followup_date').gte('created_at', sevenDaysAgoUTC.toISOString()),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', sevenDaysAgoUTC.toISOString()).eq('type', 'punch-in')
    ]);

    const events = eventsRes.data || [];
    const leads = leadsRes.data || [];
    const calls = callsRes.data || [];
    const allLeads = allLeadsRes.data || [];
    const sevenDayFollowups = sevenDayFollowupsRes.data || [];
    const sevenDayEvents = sevenDayEventsRes.data || [];

    const leadName = (l: any) => l.company_name || l.association_name || l.client_name || 'Unknown';
    const daysSince = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 999;
      return (nowIST.getTime() - new Date(dateStr).getTime()) / 86400000;
    };
    const stageOrder: Record<string, number> = { 'Negotiation': 1, 'Proposal Sent': 2, 'Survey Completed': 3, 'Site Visit Planned': 4, 'Contacted': 5, 'New Lead': 6, 'Onboarding Started': 1 };
    const stageColor: Record<string, string> = { 'Negotiation': '#f97316', 'Proposal Sent': '#ec4899', 'Survey Completed': '#06b6d4', 'Site Visit Planned': '#f59e0b', 'Contacted': '#8b5cf6', 'New Lead': '#3b82f6', 'Won': '#10b981', 'Lost': '#ef4444', 'Onboarding Started': '#006b3f' };

    const reports: any[] = [];

    for (const bd of bdUsers) {
      const bdEvents = [...events.filter((e: any) => e.user_id === bd.id)].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const attendance_status = bdEvents.length > 0 ? 'Present' : 'Absent';
      const firstPunchIn = bdEvents.find((e: any) => e.type === 'punch-in' || e.type === 'site-in' || e.type === 'site-ot-in' || e.type === 'check_in');
      const lastPunchOut = [...bdEvents].reverse().find((e: any) => e.type === 'punch-out' || e.type === 'site-out' || e.type === 'site-ot-out' || e.type === 'check_out');
      let check_in_time = 'N/A';
      let check_out_time = 'N/A';
      if (firstPunchIn) check_in_time = formatTimeIST(firstPunchIn.timestamp);
      if (lastPunchOut) check_out_time = formatTimeIST(lastPunchOut.timestamp);
      let working_hours = '0h 0m';
      if (firstPunchIn && lastPunchOut) {
        const totalMs = new Date(lastPunchOut.timestamp).getTime() - new Date(firstPunchIn.timestamp).getTime();
        if (totalMs > 0) {
          let breakMs = 0; let lastBreakInTs: number | null = null;
          bdEvents.forEach((e: any) => {
            if (e.type === 'break-in') { lastBreakInTs = new Date(e.timestamp).getTime(); }
            else if (e.type === 'break-out' && lastBreakInTs !== null) { breakMs += new Date(e.timestamp).getTime() - lastBreakInTs; lastBreakInTs = null; }
          });
          const netMs = Math.max(0, totalMs - breakMs);
          working_hours = `${Math.floor(netMs / 3600000)}h ${Math.floor((netMs % 3600000) / 60000)}m`;
        }
      }
      // ── Fix: use calculateDailyTravelKm() which correctly handles cumulative travel_distance values.
      // The old naive sum was adding up every GPS ping's running total instead of taking the final value.
      const kms_travelled = calculateDailyTravelKm(bdEvents).toFixed(2);

      const newLeadsToday = leads.filter((l: any) => l.created_by === bd.id || l.assigned_to === bd.id);
      const newLeadsIds = new Set(newLeadsToday.map((l: any) => l.id));
      const isCallType = (t: string) => ['call', 'phone call', 'outbound call'].includes((t || '').toLowerCase());
      const isSiteVisitType = (t: string) => ['site visit', 'sitevisit', 'site-visit'].includes((t || '').toLowerCase());

      const allBDLeads = allLeads.filter((l: any) => l.assigned_to === bd.id || l.created_by === bd.id);
      const allBDLeadIds = new Set(allBDLeads.map((l: any) => l.id));

      // Fix: also match calls by lead ownership (lead_id in BD's lead set), not just created_by.
      // This handles cases where the BD's UUID doesn't appear as created_by in crm_followups
      // (e.g. when the followup was auto-created or imported with a different creator reference).
      const bdCalls = calls.filter((c: any) =>
        c.created_by === bd.id || allBDLeadIds.has(c.lead_id)
      );
      const prospect_calls = bdCalls.filter((c: any) => isCallType(c.type) && newLeadsIds.has(c.lead_id)).length;
      const followup_calls = bdCalls.filter((c: any) => isCallType(c.type) && !newLeadsIds.has(c.lead_id)).length;
      const new_leads_count = newLeadsToday.length;
      const siteVisitsFromCRM = bdCalls.filter((c: any) => isSiteVisitType(c.type)).length;
      const siteVisitsFromAttendance = bdEvents.filter((e: any) => e.type === 'site-in').length;
      const sites_count = siteVisitsFromCRM > 0 ? siteVisitsFromCRM : siteVisitsFromAttendance;

      // ── SECTION 1: Follow-up Completion Rate ─────────────────────────────
      const todayFollowupsDone = calls.filter((c: any) => c.created_by === bd.id).length;
      const todayScheduled = sevenDayFollowups.filter((f: any) => {
        if (!f.next_followup_date) return false;
        const fDateStr = new Date(f.next_followup_date).toISOString().substring(0, 10);
        return fDateStr === todayStr && allBDLeads.some((l: any) => l.id === f.lead_id);
      }).length;
      const completionRate = todayScheduled > 0 ? Math.min(100, Math.round((todayFollowupsDone / todayScheduled) * 100)) : (todayFollowupsDone > 0 ? 100 : 0);
      const rateColor = completionRate >= 80 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444';
      const rateLabel = completionRate >= 80 ? '✅ On Track' : completionRate >= 50 ? '⚠️ Moderate' : '🔴 Needs Attention';
      const followup_completion_block = `<div style="margin-bottom:20px;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">📋 Follow-up Completion</div><div style="font-size:11px;font-weight:600;color:${rateColor};background:${rateColor}15;padding:4px 10px;border-radius:20px;">${rateLabel}</div></div><div style="display:flex;align-items:center;gap:16px;"><div style="font-size:36px;font-weight:800;color:${rateColor};">${completionRate}%</div><div><div style="font-size:12px;color:#64748b;margin-bottom:2px;">Done today: <strong style="color:#1e293b;">${todayFollowupsDone}</strong></div><div style="font-size:12px;color:#64748b;">Scheduled: <strong style="color:#1e293b;">${todayScheduled}</strong></div></div></div><div style="margin-top:12px;background:#e2e8f0;border-radius:100px;height:8px;overflow:hidden;"><div style="width:${completionRate}%;background:${rateColor};height:8px;border-radius:100px;"></div></div></div>`;

      // ── SECTION 2: Overdue/Stale Leads Alert ─────────────────────────────
      const overdueLeads = allBDLeads.filter((l: any) => {
        if (['Won', 'Lost'].includes(l.status)) return false;
        const lastActivity = l.stage_updated_at || l.updated_at || l.created_at;
        const daysStale = daysSince(lastActivity);
        const hasOverdueFollowup = l.next_followup_date && new Date(l.next_followup_date) < nowIST;
        return daysStale >= 7 || hasOverdueFollowup;
      }).sort((a: any, b: any) => daysSince(b.stage_updated_at || b.updated_at || b.created_at) - daysSince(a.stage_updated_at || a.updated_at || a.created_at));
      let overdue_leads_block = '';
      if (overdueLeads.length === 0) {
        overdue_leads_block = `<div style="padding:16px;text-align:center;color:#10b981;font-weight:600;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">✅ No stale leads — all active leads have recent activity!</div>`;
      } else {
        const criticalCount = overdueLeads.filter((l: any) => daysSince(l.stage_updated_at || l.updated_at || l.created_at) >= 14).length;
        const alertColor = criticalCount > 0 ? '#ef4444' : '#f59e0b';
        const alertBg = criticalCount > 0 ? '#fef2f2' : '#fffbeb';
        overdue_leads_block = `<div style="background:${alertBg};border:1px solid ${alertColor}30;border-left:4px solid ${alertColor};border-radius:8px;padding:12px 16px;margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:${alertColor};">${criticalCount > 0 ? '🔴' : '🟡'} ${overdueLeads.length} lead(s) need attention${criticalCount > 0 ? ` — ${criticalCount} critical (14+ days)` : ''}</div></div><table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Lead</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Stage</th><th style="padding:8px 12px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Days Stale</th><th style="padding:8px 12px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Next Action</th></tr></thead><tbody>` +
          overdueLeads.slice(0, 8).map((l: any, i: number) => {
            const days = Math.floor(daysSince(l.stage_updated_at || l.updated_at || l.created_at));
            const daysColor = days >= 14 ? '#ef4444' : days >= 7 ? '#f59e0b' : '#64748b';
            const sc = stageColor[l.status] || '#64748b';
            const nextAction = l.next_followup_date ? format(new Date(l.next_followup_date), 'dd MMM') : 'Not set';
            const overdueNote = l.next_followup_date && new Date(l.next_followup_date) < nowIST ? ' ⚠️' : '';
            return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-top:1px solid #f1f5f9;"><td style="padding:10px 12px;font-weight:600;color:#1e293b;">${leadName(l)}</td><td style="padding:10px 12px;"><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${l.status}</span></td><td style="padding:10px 12px;text-align:center;font-weight:700;color:${daysColor};">${days}d</td><td style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;">${nextAction}${overdueNote}</td></tr>`;
          }).join('') + `</tbody></table>`;
      }

      // ── SECTION 3: Top 5 Closest-to-Close ────────────────────────────────
      const activeLeads = allBDLeads.filter((l: any) => !['Won', 'Lost'].includes(l.status)).sort((a: any, b: any) => (stageOrder[a.status] || 9) - (stageOrder[b.status] || 9)).slice(0, 5);
      const top_leads_block = activeLeads.length === 0
        ? `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No active leads in pipeline.</div>`
        : `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">#</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Lead</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Stage</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">City</th><th style="padding:8px 12px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Next Followup</th></tr></thead><tbody>` +
          activeLeads.map((l: any, i: number) => {
            const sc = stageColor[l.status] || '#64748b';
            const nf = l.next_followup_date ? format(new Date(l.next_followup_date), 'dd MMM') : '—';
            return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-top:1px solid #f1f5f9;"><td style="padding:10px 12px;font-weight:700;color:#94a3b8;">${i + 1}</td><td style="padding:10px 12px;font-weight:600;color:#1e293b;">${leadName(l)}</td><td style="padding:10px 12px;"><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${l.status}</span></td><td style="padding:10px 12px;color:#64748b;">${l.city || '—'}</td><td style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;">${nf}</td></tr>`;
          }).join('') + `</tbody></table>`;

      // ── SECTION 4: Won/Lost This Week ─────────────────────────────────────
      const wonThisWeek = allBDLeads.filter((l: any) => l.status === 'Won' && daysSince(l.stage_updated_at || l.updated_at) <= 7);
      const lostThisWeek = allBDLeads.filter((l: any) => l.status === 'Lost' && daysSince(l.stage_updated_at || l.updated_at) <= 7);
      const totalDecided = wonThisWeek.length + lostThisWeek.length;
      const winRate = totalDecided > 0 ? Math.round((wonThisWeek.length / totalDecided) * 100) : 0;
      const won_lost_block = `<div style="display:table;width:100%;border-collapse:separate;border-spacing:12px;"><div style="display:table-cell;width:50%;vertical-align:top;"><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#10b981;">${wonThisWeek.length}</div><div style="font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">🏆 Won This Week</div>${wonThisWeek.slice(0, 3).map((l: any) => `<div style="font-size:11px;color:#064e3b;margin-top:4px;">• ${leadName(l)}</div>`).join('')}</div></div><div style="display:table-cell;width:50%;vertical-align:top;"><div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#ef4444;">${lostThisWeek.length}</div><div style="font-size:11px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;">❌ Lost This Week</div>${lostThisWeek.slice(0, 3).map((l: any) => `<div style="font-size:11px;color:#7f1d1d;margin-top:4px;">• ${leadName(l)}${l.lost_reason ? ` (${l.lost_reason})` : ''}</div>`).join('')}</div></div></div>${totalDecided > 0 ? `<div style="margin-top:8px;text-align:center;font-size:12px;color:#64748b;">Win Rate this week: <strong style="color:${winRate >= 50 ? '#10b981' : '#ef4444'};">${winRate}%</strong></div>` : '<div style="margin-top:8px;text-align:center;font-size:12px;color:#94a3b8;font-style:italic;">No Won/Lost decisions this week.</div>'}`;

      // ── SECTION 5: Lead Source Breakdown ─────────────────────────────────
      const sourceCounts: Record<string, number> = {};
      allBDLeads.forEach((l: any) => { const src = l.source || 'Unknown'; sourceCounts[src] = (sourceCounts[src] || 0) + 1; });
      const sourceEntries = Object.entries(sourceCounts).sort(([, a], [, b]) => b - a);
      const maxSourceCount = sourceEntries.length > 0 ? sourceEntries[0][1] : 1;
      const sourceColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
      const lead_source_block = sourceEntries.length === 0
        ? `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No lead source data available.</div>`
        : sourceEntries.map(([src, count], i) => {
          const pct = Math.round((count / maxSourceCount) * 100);
          const clr = sourceColors[i % sourceColors.length];
          return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="font-weight:500;color:#1e293b;">${src}</span><span style="font-weight:700;color:${clr};">${count} lead${count !== 1 ? 's' : ''}</span></div><div style="background:#e2e8f0;border-radius:100px;height:8px;overflow:hidden;"><div style="width:${pct}%;background:${clr};height:8px;border-radius:100px;"></div></div></div>`;
        }).join('');

      // ── SECTION 6: Today vs 7-Day Average ────────────────────────────────
      const dailyMetrics = Array.from({ length: 7 }, (_, i) => {
        const dayStr = new Date(startOfTodayUTC.getTime() - i * 86400000).toISOString().substring(0, 10);
        const dayFu = sevenDayFollowups.filter((f: any) => f.created_by === bd.id && f.created_at?.startsWith(dayStr));
        return { calls: dayFu.filter((f: any) => isCallType(f.type)).length, sites: dayFu.filter((f: any) => isSiteVisitType(f.type)).length };
      });
      const avgCalls = dailyMetrics.slice(1).reduce((a, d) => a + d.calls, 0) / 6 || 0;
      const avgSites = dailyMetrics.slice(1).reduce((a, d) => a + d.sites, 0) / 6 || 0;
      const todayTotalCalls = prospect_calls + followup_calls;
      const callsDelta = todayTotalCalls - avgCalls;
      const sitesDelta = sites_count - avgSites;
      const deltaStyle = (v: number) => v >= 0 ? 'color:#10b981;' : 'color:#ef4444;';
      const deltaSign = (v: number) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
      const seven_day_avg_block = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Metric</th><th style="padding:10px 14px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Today</th><th style="padding:10px 14px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">6-Day Avg</th><th style="padding:10px 14px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Δ Trend</th></tr></thead><tbody><tr><td style="padding:10px 14px;font-weight:500;color:#1e293b;border-top:1px solid #f1f5f9;">📞 Total Calls</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;">${todayTotalCalls}</td><td style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;">${avgCalls.toFixed(1)}</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;${deltaStyle(callsDelta)}">${deltaSign(callsDelta)}</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:500;color:#1e293b;border-top:1px solid #f1f5f9;">🏗️ Site Visits</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;">${sites_count}</td><td style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;">${avgSites.toFixed(1)}</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;${deltaStyle(sitesDelta)}">${deltaSign(sitesDelta)}</td></tr><tr><td style="padding:10px 14px;font-weight:500;color:#1e293b;border-top:1px solid #f1f5f9;">📋 New Leads</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;">${new_leads_count}</td><td style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;">—</td><td style="padding:10px 14px;text-align:center;color:#94a3b8;border-top:1px solid #f1f5f9;">—</td></tr></tbody></table>`;

      // ── SECTION 7: Proposal→Negotiation Conversion Funnel ────────────────
      const inProposal = allBDLeads.filter((l: any) => l.status === 'Proposal Sent').length;
      const inNegotiation = allBDLeads.filter((l: any) => l.status === 'Negotiation').length;
      const inWon = allBDLeads.filter((l: any) => l.status === 'Won').length;
      const totalSent = inProposal + inNegotiation + inWon;
      const propToNegRate = totalSent > 0 ? Math.round(((inNegotiation + inWon) / totalSent) * 100) : 0;
      const negToWonRate = (inNegotiation + inWon) > 0 ? Math.round((inWon / (inNegotiation + inWon)) * 100) : 0;
      const conversion_funnel_block = `<div style="display:flex;gap:0;align-items:stretch;font-size:12px;"><div style="flex:1;background:#ede9fe;border-radius:8px 0 0 8px;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#7c3aed;">${totalSent}</div><div style="font-size:10px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Proposal Sent</div></div><div style="width:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f3f0ff;font-size:14px;color:#7c3aed;font-weight:700;">→<span style="font-size:9px;color:#8b5cf6;">${propToNegRate}%</span></div><div style="flex:1;background:#fff7ed;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#f97316;">${inNegotiation + inWon}</div><div style="font-size:10px;font-weight:600;color:#ea580c;text-transform:uppercase;">Negotiation</div></div><div style="width:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fef3e2;font-size:14px;color:#f97316;font-weight:700;">→<span style="font-size:9px;color:#f97316;">${negToWonRate}%</span></div><div style="flex:1;background:#f0fdf4;border-radius:0 8px 8px 0;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#10b981;">${inWon}</div><div style="font-size:10px;font-weight:600;color:#059669;text-transform:uppercase;">Won</div></div></div>`;

      // ── SECTION 8: Call Outcomes Breakdown ───────────────────────────────
      const outcomeCounts: Record<string, number> = {};
      calls.filter((c: any) => c.created_by === bd.id && isCallType(c.type)).forEach((c: any) => { const o = c.outcome || 'Not Recorded'; outcomeCounts[o] = (outcomeCounts[o] || 0) + 1; });
      const outcomeColors: Record<string, string> = { 'Interested': '#10b981', 'Not Interested': '#ef4444', 'Callback': '#f59e0b', 'Callback Requested': '#f59e0b', 'No Answer': '#94a3b8', 'Not Recorded': '#cbd5e1' };
      const call_outcomes_block = Object.keys(outcomeCounts).length === 0
        ? `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No calls logged today.</div>`
        : `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0;">` +
          Object.entries(outcomeCounts).map(([outcome, count]) => {
            const clr = outcomeColors[outcome] || '#64748b';
            return `<div style="display:inline-flex;align-items:center;gap:6px;background:${clr}15;border:1px solid ${clr}40;border-radius:20px;padding:6px 14px;"><div style="width:8px;height:8px;border-radius:50%;background:${clr};"></div><span style="font-size:12px;font-weight:600;color:${clr};">${outcome}</span><span style="font-size:12px;font-weight:800;color:#1e293b;">${count}</span></div>`;
          }).join('') + `</div>`;

      // ── SECTION 9: Geography / City Coverage ─────────────────────────────
      const uniqueCities = [...new Set(allBDLeads.map((l: any) => l.city).filter(Boolean))] as string[];
      const todaySiteInCount = bdEvents.filter((e: any) => e.type === 'site-in').length;
      const geography_block = `<div style="margin-bottom:12px;font-size:12px;color:#64748b;">🏗️ <strong style="color:#1e293b;">${todaySiteInCount} site visit${todaySiteInCount !== 1 ? 's' : ''}</strong> today &nbsp;|&nbsp; 🗺️ Active in <strong style="color:#1e293b;">${uniqueCities.length} city/cities</strong></div><div style="display:flex;flex-wrap:wrap;gap:6px;">${uniqueCities.slice(0, 10).map(city => `<span style="background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">${city}</span>`).join('')}${uniqueCities.length > 10 ? `<span style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:20px;font-size:11px;">+${uniqueCities.length - 10} more</span>` : ''}</div>`;

      // ── SECTION 10: Motivational Streak Strip ────────────────────────────
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const dayStr = new Date(startOfTodayUTC.getTime() - i * 86400000).toISOString().substring(0, 10);
        if (sevenDayEvents.some((e: any) => e.user_id === bd.id && e.timestamp?.startsWith(dayStr))) streak++;
        else break;
      }
      const streakBadge = streak >= 7 ? '🏆 7-Day Attendance Streak!' : streak >= 5 ? '🔥 On Fire! 5+ Days!' : streak >= 3 ? '⭐ Building Momentum!' : streak >= 1 ? '💪 Keep Going!' : "📅 Let's Start Strong!";
      const streakBg = streak >= 5 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : streak >= 3 ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'linear-gradient(135deg,#64748b,#475569)';
      const streak_block = `<div style="background:${streakBg};border-radius:12px;padding:16px 20px;color:white;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-size:16px;font-weight:800;">${streakBadge}</div><div style="font-size:12px;opacity:0.85;margin-top:2px;">${streak} consecutive day${streak !== 1 ? 's' : ''} present</div></div><div style="font-size:36px;font-weight:800;opacity:0.9;">${streak}</div></div>`;

      // ── Original tables: New Leads + Metrics + Pipeline ──────────────────
      let new_leads_table = `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No new leads added today.</div>`;
      if (newLeadsToday.length > 0) {
        new_leads_table = `<table width="100%" style="border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Company</th><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Contact</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</th></tr></thead><tbody>` +
          newLeadsToday.map((lead: any, i: number) => {
            const sc = stageColor[lead.status] || '#64748b';
            return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:600;border-top:1px solid #f1f5f9;">${leadName(lead)}</td><td style="padding:12px 14px;font-size:12px;color:#475569;border-top:1px solid #f1f5f9;">${lead.contact_person || '-'}</td><td style="padding:12px 14px;text-align:center;border-top:1px solid #f1f5f9;"><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${lead.status}</span></td></tr>`;
          }).join('') + `</tbody></table>`;
      }
      const metricsData = [
        { metric: 'Outbound Calls (New Prospects)', actual: prospect_calls },
        { metric: 'Follow-up Calls', actual: followup_calls },
        { metric: 'Site Visits Conducted', actual: sites_count },
        { metric: 'New Leads Added', actual: new_leads_count },
        { metric: 'KMs Travelled', actual: kms_travelled }
      ];
      const metrics_table = `<table width="100%" style="border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Metric</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Actual</th></tr></thead><tbody>` +
        metricsData.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};"><td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;">${row.metric}</td><td style="padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:#0f172a;border-top:1px solid #f1f5f9;">${row.actual}</td></tr>`).join('') +
        `</tbody></table>`;

      const myLeads = allLeads.filter((l: any) => l.assigned_to === bd.id || l.created_by === bd.id);
      const allStages = ['New Lead', 'Contacted', 'Site Visit Planned', 'Survey Completed', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
      let activeTotal = 0;
      const pipeline_snapshot = `<table width="100%" style="border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Stage</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Count</th></tr></thead><tbody>` +
        allStages.map((stage, i) => {
          const count = myLeads.filter((l: any) => l.status === stage).length;
          if (!['Won', 'Lost'].includes(stage)) activeTotal += count;
          const sc = stageColor[stage] || '#64748b';
          return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};"><td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sc};margin-right:6px;"></span>${stage}</td><td style="padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:${sc};border-top:1px solid #f1f5f9;">${count}</td></tr>`;
        }).join('') +
        `</tbody></table><div style="margin-top:8px;text-align:right;font-size:12px;font-weight:700;color:#166534;padding:8px;background:#f0fdf4;border-top:1px solid #bbf7d0;">Total active pipeline: ${activeTotal} leads</div>`;

      reports.push({
        bd_name: bd.name, bdName: bd.name,
        report_date: format(new Date(`${todayStr}T12:00:00+05:30`), 'dd MMM yyyy'), reportDate: format(new Date(`${todayStr}T12:00:00+05:30`), 'dd MMM yyyy'),
        date: format(new Date(`${todayStr}T12:00:00+05:30`), 'EEEE, MMMM do, yyyy'),
        attendance_status, attendanceStatus: attendance_status,
        check_in_time, checkInTime: check_in_time,
        check_out_time, checkOutTime: check_out_time,
        working_hours, workingHours: working_hours,
        kms_travelled, kmsTravelled: kms_travelled,
        prospect_calls: String(prospect_calls), prospectCalls: String(prospect_calls),
        followup_calls: String(followup_calls), followupCalls: String(followup_calls),
        new_leads_count: String(new_leads_count), newLeadsCount: String(new_leads_count),
        sites_count: String(sites_count), sitesCount: String(sites_count),
        sites_visited: String(sites_count), sitesVisited: String(sites_count),
        new_leads_table, newLeadsTable: new_leads_table,
        metrics_table, metricsTable: metrics_table,
        pipeline_snapshot, pipelineSnapshot: pipeline_snapshot,
        // 10 new enhanced sections
        followup_completion_block, followupCompletionBlock: followup_completion_block,
        overdue_leads_block, overdueLeadsBlock: overdue_leads_block,
        top_leads_block, topLeadsBlock: top_leads_block,
        won_lost_block, wonLostBlock: won_lost_block,
        lead_source_block, leadSourceBlock: lead_source_block,
        seven_day_avg_block, sevenDayAvgBlock: seven_day_avg_block,
        conversion_funnel_block, conversionFunnelBlock: conversion_funnel_block,
        call_outcomes_block, callOutcomesBlock: call_outcomes_block,
        geography_block, geographyBlock: geography_block,
        streak_block, streakBlock: streak_block
      });
    }

    return reports;
  },
  bd_daily: async (supabase: SupabaseClient, nowIST: Date) => {
    return (reportGenerators as any).crm_bd_daily(supabase, nowIST);
  }
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
// [SECURITY FIX] Removed fallback to VITE_SUPABASE_ANON_KEY (matches send-email.ts fix C7)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  console.log('[process-email-schedules] Triggered AUTOMATIC sync process...');
  const timeoutLimit = 8500;
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_LIMIT_REACHED')), timeoutLimit));

  try {
    const result = await Promise.race([processSchedules(req), timeoutPromise]);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[process-email-schedules] Critical Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// ─── SMTP Pool Helpers ───────────────────────────────────────────────────────

/** Resets sent_today counters for accounts whose last_reset_at is before today (IST). */
async function resetStaleSmtpCounters(supabase: SupabaseClient) {
  const todayIST = getISTDateString(new Date());
  await supabase
    .from('smtp_accounts')
    .update({ sent_today: 0, last_reset_at: todayIST })
    .lt('last_reset_at', todayIST);
}

/** Returns the best smtp_account for a given report type, or null if none available. */
async function getSmtpForReportType(supabase: SupabaseClient, reportType: string): Promise<any | null> {
  const { data } = await supabase
    .from('smtp_accounts')
    .select('*')
    .eq('is_active', true)
    .contains('report_types', [reportType])
    .order('sent_today', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  // Check if daily limit not exhausted
  if (data.sent_today >= data.daily_limit) return null;
  return data;
}

/** Increments sent_today counter for an smtp_account. */
async function incrementSmtpCounter(supabase: SupabaseClient, accountId: string, count: number) {
  try {
    const { data: current } = await supabase
      .from('smtp_accounts')
      .select('sent_today')
      .eq('id', accountId)
      .single();
    if (current) {
      await supabase
        .from('smtp_accounts')
        .update({ sent_today: (current.sent_today || 0) + count })
        .eq('id', accountId);
    }
  } catch (err) {
    console.error('[SMTP Pool] Failed to increment sent_today:', err);
  }
}

// ─── Main Schedule Processor ─────────────────────────────────────────────────

export async function processSchedules(req: any) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Reset stale daily counters before processing
  await resetStaleSmtpCounters(supabase);

  // Fallback: global email config (used when no pool account matches)
  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').single();
  const fallbackConfig = settings?.email_config;

  // Get active rules
  const ruleId = req.query.ruleId as string;
  const force = req.query.force === 'true';
  let query = supabase.from('email_schedule_rules').select('*').eq('is_active', true);
  if (ruleId) query = query.eq('id', ruleId);
  const { data: rules } = await query;
  if (!rules || rules.length === 0) return { message: 'No active schedules', processed: 0 };

  const { data: templates } = await supabase.from('email_templates').select('*');
  const templateMap = new Map((templates || []).map(t => [t.id, t]));

  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  let totalSent = 0;

  for (const rule of rules) {
    const isForceRun = force || ruleId === rule.id;
    if (rule.trigger_type === 'scheduled' && !isForceRun) {
      const config = rule.schedule_config || {};
      const [hour, minute] = (config.time || '21:00').split(':').map(Number);
      if (nowIST.getUTCHours() < hour || (nowIST.getUTCHours() === hour && nowIST.getUTCMinutes() < minute)) continue;
      if (rule.last_sent_at) {
        const lastSentIST = new Date(new Date(rule.last_sent_at).getTime() + IST_OFFSET);
        const lastSentDateStr = getISTDateString(new Date(rule.last_sent_at));
        const currentIstDateStr = getISTDateString(now);
        const lastSentHours = String(lastSentIST.getUTCHours()).padStart(2, '0');
        const lastSentMinutes = String(lastSentIST.getUTCMinutes()).padStart(2, '0');
        const lastSentTimeStr = `${lastSentHours}:${lastSentMinutes}`;
        const targetTime = config.time || '21:00';
        if (lastSentDateStr === currentIstDateStr && lastSentTimeStr >= targetTime) continue;
      }
    }

    // ── Pick SMTP Account ─────────────────────────────────────────────────
    const reportType = rule.report_type || 'attendance_daily';
    const smtpAccount = await getSmtpForReportType(supabase, reportType);

    // Build transporter from pool account, or fall back to global config
    let emailSource: any;
    let transporter: any;

    if (smtpAccount) {
      emailSource = smtpAccount;
      transporter = nodemailer.createTransport({
        host: smtpAccount.host || 'smtp.gmail.com',
        port: smtpAccount.port || 465,
        secure: smtpAccount.secure !== false,
        auth: { user: smtpAccount.email.trim(), pass: (smtpAccount.app_password || '').replace(/\s+/g, '') },
        tls: { rejectUnauthorized: false }
      });
      console.log(`[Schedule] Using pool account "${smtpAccount.name}" (${smtpAccount.email}) for report "${reportType}"`);
    } else if (fallbackConfig?.user && fallbackConfig?.pass) {
      emailSource = fallbackConfig;
      transporter = nodemailer.createTransport({
        host: fallbackConfig.host || 'smtp.gmail.com',
        port: fallbackConfig.port || 587,
        secure: fallbackConfig.secure || false,
        auth: { user: (fallbackConfig.user || '').trim(), pass: (fallbackConfig.pass || '').replace(/\s+/g, '') },
        tls: { rejectUnauthorized: false }
      });
      console.log(`[Schedule] No pool account for "${reportType}", using fallback SMTP.`);
    } else {
      console.warn(`[Schedule] Skipping rule "${rule.name}" — no SMTP available for "${reportType}"`);
      continue;
    }

    // ── Resolve Recipients ────────────────────────────────────────────────
    let emails: string[] = [];
    if (rule.recipient_type === 'custom_emails') emails = rule.recipient_emails || [];
    else if (rule.recipient_type === 'role') {
      const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []).eq('is_blocked', false);
      emails = (users || []).map((u: any) => u.email).filter(Boolean);
      if (emails.length === 0 && Array.isArray(rule.recipient_emails)) emails = rule.recipient_emails;
    } else if (rule.recipient_type === 'users') {
      const { data: users } = await supabase.from('users').select('email').in('id', rule.recipient_user_ids || []).eq('is_blocked', false);
      emails = (users || []).map((u: any) => u.email).filter(Boolean);
      if (emails.length === 0 && Array.isArray(rule.recipient_emails)) emails = rule.recipient_emails;
    }
    if (emails.length === 0 && Array.isArray(rule.recipient_emails)) emails = rule.recipient_emails;


    if (emails.length === 0) {
      console.log(`[Schedule] Skipping "${rule.name}" - No recipients resolved.`);
      continue;
    }

    // ── Guard: check capacity before sending ─────────────────────────────
    if (smtpAccount) {
      const remaining = smtpAccount.daily_limit - smtpAccount.sent_today;
      if (emails.length > remaining) {
        console.warn(`[Schedule] "${smtpAccount.name}" only has ${remaining} quota left, need ${emails.length}. Skipping rule "${rule.name}".`);
        await supabase.from('email_logs').insert({
          rule_id: rule.id,
          recipient_email: 'system',
          subject: `[QUOTA EXCEEDED] ${rule.name}`,
          status: 'failed',
          error_message: `Pool account ${smtpAccount.email} quota exhausted (${smtpAccount.sent_today}/${smtpAccount.daily_limit})`,
          metadata: { trigger_type: 'automatic', quota_exceeded: true }
        });
        continue;
      }
    }

    // ── Generate Report Data ──────────────────────────────────────────────
    const config = rule.schedule_config || {};
    const dateRangeMode = config.dateRangeMode || (rule.report_type === 'attendance_monthly' ? 'previous_month' : 'today');
    
    const todayISTStr = getISTDateString(now);
    let targetDateStr = todayISTStr;
    let startDateStr = todayISTStr;
    let endDateStr = todayISTStr;

    if (dateRangeMode === 'yesterday') {
      const y = new Date(new Date(`${todayISTStr}T12:00:00+05:30`).getTime() - 24 * 3600 * 1000);
      targetDateStr = getISTDateString(y);
      startDateStr = targetDateStr;
      endDateStr = targetDateStr;
    } else if (dateRangeMode === 'last_3_days') {
      const s = new Date(new Date(`${todayISTStr}T12:00:00+05:30`).getTime() - 2 * 24 * 3600 * 1000);
      startDateStr = getISTDateString(s);
      endDateStr = todayISTStr;
      targetDateStr = todayISTStr;
    } else if (dateRangeMode === 'last_7_days') {
      const s = new Date(new Date(`${todayISTStr}T12:00:00+05:30`).getTime() - 6 * 24 * 3600 * 1000);
      startDateStr = getISTDateString(s);
      endDateStr = todayISTStr;
      targetDateStr = todayISTStr;
    } else if (dateRangeMode === 'previous_month') {
      const [y, m] = todayISTStr.split('-').map(Number);
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      targetDateStr = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      startDateStr = targetDateStr;
      endDateStr = new Date(prevY, prevM, 0).toISOString().split('T')[0];
    } else if (dateRangeMode === 'current_month') {
      const [y, m] = todayISTStr.split('-').map(Number);
      targetDateStr = `${y}-${String(m).padStart(2, '0')}-01`;
      startDateStr = targetDateStr;
      endDateStr = todayISTStr;
    } else if (dateRangeMode === 'last_3_months') {
      const s = new Date(new Date(`${todayISTStr}T12:00:00+05:30`).getTime() - 90 * 24 * 3600 * 1000);
      startDateStr = getISTDateString(s);
      endDateStr = todayISTStr;
      targetDateStr = todayISTStr;
    } else if (dateRangeMode === 'custom' && config.customDateStart) {
      startDateStr = config.customDateStart;
      endDateStr = config.customDateEnd || config.customDateStart;
      targetDateStr = endDateStr;
    }

    const reportFilters = {
      dateRange: { start: startDateStr, end: endDateStr },
      dateRangeMode,
      ...rule.schedule_config
    };

    const targetDateForGenerator = new Date(`${targetDateStr}T12:00:00+05:30`);
    const generator = (reportGenerators as any)[reportType] || reportGenerators.attendance_daily;
    const reportData = await generator(supabase, targetDateForGenerator, reportFilters);

    const template = templateMap.get(rule.template_id);
    const reportDataList = Array.isArray(reportData) ? reportData : [reportData];

    for (const dataItem of reportDataList) {
      let greetingMessage = `Here is your automated status update.`;

      if (reportType === 'attendance_monthly') {
        greetingMessage = `Dear Management,<br/><br/>This is the consolidated attendance summary for the period of <strong>{date}</strong>. It covers overall employee presence across all <strong>{totalEmployees}</strong> active members of the staff.<br/><br/>Please review the detailed monthly attendance grid below for any discrepancies.`;
      } else if (reportType === 'attendance_daily') {
        const periodText = dateRangeMode === 'yesterday' ? "Yesterday's" : "Today's";
        greetingMessage = `Dear Team,<br/><br/>${periodText} attendance for <strong>{date}</strong> stands at <strong>{attendancePercentage}%</strong>. A total of <strong>{totalAbsent}</strong> employees were absent, and <strong>{lateCount}</strong> reported late.<br/><br/>Attendance summary:`;
      }

      if (template?.variables) {
        const customVar = (template.variables as any[]).find(v => v.key === '_custom_message' || v.key === 'customMessage');
        if (customVar?.description?.trim()) {
          greetingMessage = evaluateConditionals(customVar.description, dataItem || {}).replace(/\n/g, '<br/>');
        }
      }

      const render = (text: string, data: any) => {
        if (!text) return '';
        return text.replace(/\{([\w]+)\}/gi, (match, key) => {
          const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
          const dataKey = Object.keys(data || {}).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
          if (dataKey && (data as any)[dataKey] !== undefined && (data as any)[dataKey] !== null) {
            return String((data as any)[dataKey]);
          }
          return match;
        });
      };

      greetingMessage = render(greetingMessage, dataItem || {});
      dataItem.greetingMessage = greetingMessage;
      dataItem.customGreeting = greetingMessage;
      dataItem.greeting_message = greetingMessage;
      dataItem.custom_greeting = greetingMessage;
      dataItem.summary = greetingMessage;

      let subject = template?.subject_template || rule.name;
      let html = template?.body_template || `<h2>Report</h2>{table}`;
      subject = render(evaluateConditionals(subject, dataItem), dataItem);
      html = render(evaluateConditionals(html, dataItem), dataItem);

      // Determine from address
      const fromEmail = smtpAccount
        ? (smtpAccount.email || '')
        : (fallbackConfig?.from_email || fallbackConfig?.user || '');
      const fromName = smtpAccount
        ? (smtpAccount.from_name || smtpAccount.name || 'Paradigm FMS')
        : (fallbackConfig?.from_name || 'Paradigm FMS');

      // ── Send individually (privacy) ───────────────────────────────────
      let sentCount = 0;
      for (const recipientEmail of emails) {
        try {
          await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: recipientEmail,
            replyTo: smtpAccount ? fromEmail : (fallbackConfig?.reply_to || fromEmail),
            subject, html
          });
          await supabase.from('email_logs').insert({
            rule_id: rule.id,
            template_id: rule.template_id,
            recipient_email: recipientEmail,
            subject,
            status: 'sent',
            metadata: {
              trigger_type: 'automatic',
              smtp_account_id: smtpAccount?.id || null,
              smtp_account_name: smtpAccount?.name || 'fallback',
            }
          });
          sentCount++;
          totalSent++;
        } catch (mailErr: any) {
          console.error(`[Schedule] Failed to send to ${recipientEmail}:`, mailErr.message);
          await supabase.from('email_logs').insert({
            rule_id: rule.id,
            recipient_email: recipientEmail,
            subject,
            status: 'failed',
            error_message: mailErr.message,
            metadata: {
              trigger_type: 'automatic',
              smtp_account_id: smtpAccount?.id || null,
            }
          });
        }
      }

      // ── Update SMTP quota counter ─────────────────────────────────────
      if (smtpAccount && sentCount > 0) {
        await incrementSmtpCounter(supabase, smtpAccount.id, sentCount);
      }
    }

    await supabase.from('email_schedule_rules').update({ last_sent_at: now.toISOString() }).eq('id', rule.id);
  }

  return { success: true, processed: totalSent };
}
