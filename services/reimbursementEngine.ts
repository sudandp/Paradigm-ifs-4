/**
 * reimbursementEngine.ts - Monthly Reimbursement Claims Rollup Engine
 *
 * Reads daily travel_logs for a user+month and creates/updates one
 * reimbursement_claims row per employee per month.
 *
 * Pipeline position: travelEngine -> reimbursementEngine -> payrollEngine
 *
 * Hard Rules:
 *   - Only reads travel_logs; does NOT recompute distances
 *   - All monetary values in PAISE internally, INR decimal strings at DB boundary
 *   - Payroll pipeline is separate - this engine only touches reimbursement_claims
 *   - Every aggregation step logged at DEBUG level
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlyReimbursementSummary {
  userId: string;
  month: string;           // YYYY-MM
  totalDaysTracked: number;
  totalRawKm: number;
  totalEffectiveKm: number;
  totalDeductionKm: number;
  totalReimbursableKm: number;
  // Paise (integer)
  totalGrossAmountPaise: number;
  totalNetAmountPaise: number;
  // INR decimal strings (for DB)
  totalGrossAmountInr: string;
  totalNetAmountInr: string;
  vehicleBreakdown: Record<string, { days: number; km: number; amountInr: string }>;
  decisionLog: string[];
}

export interface RunReimbursementEngineResult {
  processed: number;
  written: number;
  errors: string[];
  summaries: MonthlyReimbursementSummary[];
}

// ---------------------------------------------------------------------------
// Aggregator (pure)
// ---------------------------------------------------------------------------

export async function computeMonthlyReimbursement(
  userId: string,
  month: string  // YYYY-MM
): Promise<MonthlyReimbursementSummary> {
  const log: string[] = [];
  log.push(`DEBUG computeMonthlyReimbursement user=${userId} month=${month}`);

  const startDate = month + '-01';
  const endDate = month + '-31'; // DB will clamp to month end

  const { data: logs, error } = await supabase
    .from('travel_logs')
    .select('travel_date, vehicle_type, total_km, deduction_km, reimbursable_km, gross_amount, net_amount, raw_km, status')
    .eq('user_id', userId)
    .gte('travel_date', startDate)
    .lte('travel_date', endDate)
    .neq('status', 'voided');

  if (error) throw new Error(`travel_logs fetch: ${error.message}`);

  log.push(`DEBUG fetched ${logs?.length ?? 0} travel_log rows for ${month}`);

  let totalRawKm = 0;
  let totalEffectiveKm = 0;
  let totalDeductionKm = 0;
  let totalReimbursableKm = 0;
  let totalGrossAmountPaise = 0;
  let totalNetAmountPaise = 0;
  const vehicleBreakdown: Record<string, { days: number; km: number; amountPaise: number }> = {};

  for (const row of (logs ?? [])) {
    const rawKm = Number(row.raw_km ?? 0);
    const effectiveKm = Number(row.total_km ?? 0);
    const deductionKm = Number(row.deduction_km ?? 0);
    const reimbursableKm = Number(row.reimbursable_km ?? 0);
    // Convert INR strings to paise for safe accumulation
    const grossPaise = Math.round(Number(row.gross_amount ?? 0) * 100);
    const netPaise = Math.round(Number(row.net_amount ?? 0) * 100);
    const vType = row.vehicle_type ?? 'unknown';

    totalRawKm += rawKm;
    totalEffectiveKm += effectiveKm;
    totalDeductionKm += deductionKm;
    totalReimbursableKm += reimbursableKm;
    totalGrossAmountPaise += grossPaise;
    totalNetAmountPaise += netPaise;

    if (!vehicleBreakdown[vType]) vehicleBreakdown[vType] = { days: 0, km: 0, amountPaise: 0 };
    vehicleBreakdown[vType].days++;
    vehicleBreakdown[vType].km += reimbursableKm;
    vehicleBreakdown[vType].amountPaise += netPaise;

    log.push(`DEBUG row date=${row.travel_date} vehicle=${vType} reimbursable=${reimbursableKm.toFixed(3)}km net_paise=${netPaise}`);
  }

  log.push(`DEBUG totals: effective=${totalEffectiveKm.toFixed(3)}km reimbursable=${totalReimbursableKm.toFixed(3)}km net_paise=${totalNetAmountPaise}`);

  // Build vehicle breakdown with INR strings
  const vehicleBreakdownOut: Record<string, { days: number; km: number; amountInr: string }> = {};
  for (const [vt, vd] of Object.entries(vehicleBreakdown)) {
    vehicleBreakdownOut[vt] = {
      days: vd.days,
      km: +vd.km.toFixed(3),
      amountInr: (vd.amountPaise / 100).toFixed(2),
    };
  }

  return {
    userId,
    month,
    totalDaysTracked: (logs ?? []).length,
    totalRawKm: +totalRawKm.toFixed(3),
    totalEffectiveKm: +totalEffectiveKm.toFixed(3),
    totalDeductionKm: +totalDeductionKm.toFixed(3),
    totalReimbursableKm: +totalReimbursableKm.toFixed(3),
    totalGrossAmountPaise,
    totalNetAmountPaise,
    totalGrossAmountInr: (totalGrossAmountPaise / 100).toFixed(2),
    totalNetAmountInr: (totalNetAmountPaise / 100).toFixed(2),
    vehicleBreakdown: vehicleBreakdownOut,
    decisionLog: log,
  };
}

// ---------------------------------------------------------------------------
// DB writer
// ---------------------------------------------------------------------------

export async function writeReimbursementClaim(summary: MonthlyReimbursementSummary): Promise<void> {
  const row = {
    user_id: summary.userId,
    claim_month: summary.month + '-01',
    total_days_tracked: summary.totalDaysTracked,
    total_km: summary.totalEffectiveKm,
    reimbursable_km: summary.totalReimbursableKm,
    gross_amount: summary.totalGrossAmountInr,
    net_amount: summary.totalNetAmountInr,
    vehicle_breakdown: summary.vehicleBreakdown,
    computation_log: summary.decisionLog,
    status: 'computed',
  };

  console.debug(`[reimbursementEngine] write claim user=${summary.userId} month=${summary.month} net=${summary.totalNetAmountInr}`);

  const { error } = await supabase
    .from('reimbursement_claims')
    .upsert(row, { onConflict: 'user_id,claim_month' });

  if (error) throw new Error(`reimbursement_claims upsert: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runReimbursementEngine(opts: {
  userIds: string[];
  month: string;  // YYYY-MM
  dryRun?: boolean;
}): Promise<RunReimbursementEngineResult> {
  const result: RunReimbursementEngineResult = { processed: 0, written: 0, errors: [], summaries: [] };
  console.debug(`[reimbursementEngine] run: users=${opts.userIds.length} month=${opts.month} dryRun=${opts.dryRun}`);

  for (const userId of opts.userIds) {
    result.processed++;
    try {
      const summary = await computeMonthlyReimbursement(userId, opts.month);
      result.summaries.push(summary);
      if (!opts.dryRun) {
        await writeReimbursementClaim(summary);
        result.written++;
      }
    } catch (err: any) {
      result.errors.push(`${userId}: ${err?.message}`);
    }
  }

  console.debug(`[reimbursementEngine] done: processed=${result.processed} written=${result.written} errors=${result.errors.length}`);
  return result;
}
