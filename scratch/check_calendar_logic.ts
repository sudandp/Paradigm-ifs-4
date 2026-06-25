import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { format, getDay, isSameDay } from 'date-fns';
import { getStaffCategory, isBangaloreLocation } from '../utils/attendanceCalculations';
import { FIXED_HOLIDAYS } from '../utils/constants';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

async function inspect() {
  const { data: userData } = await supabase
    .from('users')
    .select('*, companies!users_society_id_fkey(location)')
    .ilike('name', '%Isaac Roy%')
    .single();

  const companies = userData.companies;
  const compLocation = Array.isArray(companies) ? companies[0]?.location : companies?.location;
  const user = {
    ...toCamelCase(userData),
    location: compLocation
  };

  const { data: settingsData } = await supabase
    .from('settings')
    .select('attendance_settings')
    .eq('id', 'singleton')
    .single();

  const settings = toCamelCase(settingsData?.attendance_settings || {});
  
  const { data: recurringHolidaysRes } = await supabase
    .from('recurring_holidays')
    .select('*');

  const recurringHolidays = (recurringHolidaysRes || []).map(row => ({
    id: row.id,
    type: row.role_type,
    day: row.day,
    n: row.occurrence,
    eligibleRoles: Array.isArray(row.eligible_roles) ? row.eligible_roles : []
  }));

  const { data: userHolidays } = await supabase
    .from('user_holidays')
    .select('*')
    .eq('user_id', user.id);

  const date = new Date('2026-06-20T12:00:00');
  const dateStr = '2026-06-20';

  const staffCategory = getStaffCategory(user.roleId || user.role || '', user.organizationId, settings);
  const userRules = settings[staffCategory];
  const isSunday = getDay(date) === 0;

  const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
      const [m, d] = fh.date.split('-').map(Number);
      const fixedDate = new Date(date.getFullYear(), m - 1, d);
      return isSameDay(fixedDate, date);
  });

  const isPoolHoliday = (userHolidays || []).some(uh => {
      const [y, m, d] = uh.holiday_date.split('-').map(Number);
      const poolDate = new Date(y, m - 1, d);
      return isSameDay(poolDate, date);
  });

  const isFemale = ['female', 'ladies'].includes((user.gender || '').toLowerCase());
  const isMale = !isFemale;
  const userLocationStr = user.location || user.locationName || user.organizationName || user.societyName || '';
  const isBangaloreStaff = isBangaloreLocation(userLocationStr) && (staffCategory === 'office' || staffCategory === 'field');

  const isFloatingHolidayValid = (dateToCheck: string) => {
      if (!userRules) return false;
      if (userRules.floatingHolidayMonths && userRules.floatingHolidayMonths.length > 0) {
          const monthIdx = new Date(dateToCheck.replace(/-/g, '/')).getMonth();
          return userRules.floatingHolidayMonths.includes(monthIdx);
      }
      if (userRules.floatingLeavesValidFrom && dateToCheck < userRules.floatingLeavesValidFrom) return false;
      if (userRules.floatingLeavesExpiryDate && dateToCheck > userRules.floatingLeavesExpiryDate) return false;
      return true;
  };

  const dayName = format(date, 'EEEE');
  const isRecurringHoliday = (recurringHolidays || []).some(rh => {
       const rhType = rh.type || rh.roleType;
       const rhN = typeof rh.n !== 'undefined' ? rh.n : rh.occurrence;
       
       if (rhType && rhType !== staffCategory) return false;
       if (rh.day !== dayName) return false;
       
       if (rh.day === 'Saturday' && rhN === 3) {
           if (!isBangaloreStaff) return false;
           if (!isMale) return false;
           if (!isFloatingHolidayValid(dateStr)) return false;
       }
       
       if (rhN === 0) return true; 
       const nth = Math.ceil(date.getDate() / 7);
       return rhN === nth;
  }) || (isBangaloreStaff && isMale && dayName === 'Saturday' && Math.ceil(date.getDate() / 7) === 3 && isFloatingHolidayValid(dateStr));

  console.log('Evaluation variables:', {
    staffCategory,
    userLocationStr,
    isBangaloreStaff,
    isMale,
    isSunday,
    isFixedHoliday,
    isPoolHoliday,
    isRecurringHoliday,
    recurringHolidaysCount: recurringHolidays.length
  });
}

inspect();
