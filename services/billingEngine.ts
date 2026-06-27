/**
 * billingEngine.ts - Site Staff Monthly Billing Engine
 *
 * Automates the billing cycle execution from the 21st of the previous month
 * to the 20th of the current month.
 *
 * Responsibilities:
 *   1. Accept a billing month (YYYY-MM), e.g., "2026-07" represents 2026-06-21 to 2026-07-20.
 *   2. Resolve all site staff profiles and their corresponding site_staff_config rules.
 *   3. Retrieve daily attendance records/marks for the period.
 *   4. Accrue WO and EL balances using standard formulas.
 *   5. Calculate Holiday (NH) billing additions (NA / Actuals / Double).
 *   6. Calculate total billable days, rate-per-day, and invoice subtotal.
 *   7. Push progress updates and upsert logs to site_invoice_tracker.
 *
 * Hard Rules:
 *   - Billing and payroll are independent pipelines - billing engine NEVER touches payroll_snapshots
 *   - All monetary values use Decimal precision / integer paise where possible
 *   - Every calculation step logged at DEBUG level
 */

import { supabase } from './supabase';
import { generateMonthlyOutput, SiteStaffConfig } from '../utils/siteStaffCalculations';

export interface BillingPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  month: string;     // YYYY-MM
}

export interface BillingEngineResult {
  processedCount: number;
  successCount: number;
  errors: string[];
  records: any[];
}

/**
 * Calculates start and end dates for the 21st-to-20th cycle of the target month.
 * Example: targetMonth = "2026-07" -> Start: 2026-06-21, End: 2026-07-20.
 */
export function getBillingPeriod(targetMonth: string): BillingPeriod {
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr); // 1-indexed (1 = Jan)

  // Previous month date
  const prevDate = new Date(year, month - 2, 21); // month - 2 is 0-indexed previous month
  const currDate = new Date(year, month - 1, 20); // month - 1 is 0-indexed target month

  const formatD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: formatD(prevDate),
    endDate: formatD(currDate),
    month: targetMonth,
  };
}

/**
 * Runs the automated billing calculations for a target month and list of users.
 */
export async function runBillingEngine(opts: {
  month: string; // YYYY-MM
  userIds?: string[];
  dryRun?: boolean;
}): Promise<BillingEngineResult> {
  const out: BillingEngineResult = {
    processedCount: 0,
    successCount: 0,
    errors: [],
    records: [],
  };

  const period = getBillingPeriod(opts.month);
  console.debug(`[billingEngine] starting execution: period=${period.startDate} to ${period.endDate}`);

  // 1. Get site staff configurations
  let query = supabase
    .from('site_staff_config')
    .select(`
      user_id, ctc_per_month, weekly_offs_per_week, earned_leaves_per_annum,
      nfh_per_annum, nh_billing_config, nh_salary_config, shift, shift_hours,
      per_day_billing_rate, rate_effective_date, per_annum_rate, billable_duties_in_year,
      users:user_id (id, name, location_id, organization_id)
    `);

  if (opts.userIds?.length) {
    query = query.in('user_id', opts.userIds);
  }

  const { data: configs, error: configError } = await query;
  if (configError) {
    out.errors.push(`config fetch: ${configError.message}`);
    return out;
  }

  if (!configs?.length) {
    console.debug(`[billingEngine] no active site staff config found`);
    return out;
  }

  // 2. Process each employee
  for (const c of configs) {
    out.processedCount++;
    const userId = c.user_id;
    const user = c.users as any;
    const userName = user?.name ?? 'Unknown Site Staff';
    const siteId = user?.location_id ?? null;

    console.debug(`[billingEngine] processing user=${userName} (id=${userId})`);

    try {
      // 2a. Fetch attendance status logs for date range
      // Map to old engine status string array
      const { data: statusLogs, error: statusErr } = await supabase
        .from('attendance_daily_status_log')
        .select('date, status_code')
        .eq('user_id', userId)
        .gte('date', period.startDate)
        .lte('date', period.endDate);

      if (statusErr) {
        throw new Error(`attendance fetch failed: ${statusErr.message}`);
      }

      // Convert daily status log to status string array
      const marks = (statusLogs ?? []).map(log => log.status_code);
      console.debug(`[billingEngine] fetched ${marks.length} daily status records for user`);

      // 2b. Count holidays in this period (normally fetched from holiday table)
      const { count: holidayCount } = await supabase
        .from('user_holidays')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('holiday_date', period.startDate)
        .lte('holiday_date', period.endDate);

      const holidaysInPeriod = holidayCount ?? 0;

      // 2c. Fetch opening balances for EL and WO
      const elOpening = 0.0;
      const woOpening = 0.0;

      // 2d. Perform calculations using utilities
      const mappedConfig: SiteStaffConfig = {
        userId,
        ctcPerMonth: Number(c.ctc_per_month),
        weeklyOffsPerWeek: Number(c.weekly_offs_per_week),
        earnedLeavesPerAnnum: Number(c.earned_leaves_per_annum),
        nfhPerAnnum: Number(c.nfh_per_annum),
        nhBillingConfig: (c.nh_billing_config as any) ?? 'NA',
        nhSalaryConfig: (c.nh_salary_config as any) ?? 'NA',
        shift: c.shift ?? 'A',
        shiftHours: Number(c.shift_hours ?? 8),
        perDayBillingRate: c.per_day_billing_rate ? Number(c.per_day_billing_rate) : undefined,
        rateEffectiveDate: c.rate_effective_date ?? undefined,
        perAnnumRate: c.per_annum_rate ? Number(c.per_annum_rate) : undefined,
        billableDutiesInYear: c.billable_duties_in_year ? Number(c.billable_duties_in_year) : undefined,
      };

      const computed = generateMonthlyOutput(
        userId,
        period.startDate,
        period.endDate,
        mappedConfig,
        marks,
        holidaysInPeriod,
        elOpening,
        woOpening,
        [] // manual adjustments can be fetched from adjust table if exists
      );

      console.debug(`[billingEngine] calculation output: daysPresent=${computed.attendance_summary.days_present} billableDays=${computed.billing.billable_days_count} invoiceSubtotal=${computed.billing.invoice_subtotal}`);
      out.records.push(computed);

      // 2e. Update site_invoice_tracker (unless dry run)
      if (!opts.dryRun && siteId) {
        // Fetch site name
        const { data: loc } = await supabase
          .from('locations')
          .select('name')
          .eq('id', siteId)
          .maybeSingle();

        const siteName = loc?.name ?? 'Site ' + siteId;

        // Upsert summary status into site_invoice_tracker
        const { error: upsertErr } = await supabase
          .from('site_invoice_tracker')
          .upsert({
            site_id: siteId,
            site_name: siteName,
            billing_cycle: `${period.startDate} to ${period.endDate}`,
            ops_remarks: `Processed ${computed.billing.billable_days_count} billable days. Per Present rate: ${computed.billing.per_day_rate}.`,
            invoice_sharing_tentative_date: new Date().toISOString().substring(0, 10),
            hr_received_date: new Date().toISOString().substring(0, 10),
          }, { onConflict: 'site_id,billing_cycle' });

        if (upsertErr) {
          console.error(`[billingEngine] tracker upsert error: ${upsertErr.message}`);
        }
      }

      out.successCount++;
    } catch (err: any) {
      console.error(`[billingEngine] error processing user=${userName}: ${err.message}`);
      out.errors.push(`${userName}: ${err.message}`);
    }
  }

  return out;
}
