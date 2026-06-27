/**
 * payrollEngine.ts - Monthly Payroll Computation Engine
 *
 * Computes gross payable, statutory deductions (EPF/ESIC/PT), and net payable
 * for each employee for a given month. Reads from:
 *   - attendance_month_snapshots (locked attendance data)
 *   - reimbursement_claims (travel reimbursement)
 *   - salary_structure_config (statutory rates by state+effective date)
 *   - site_staff_config / users (CTC, divisor)
 *
 * Writes to payroll_snapshots.
 *
 * Hard Rules:
 *   - INDEPENDENT of billingEngine - never reads/writes billing tables
 *   - All monetary values in PAISE internally, INR string at DB boundary
 *   - rule_version_id pinned at computation time
 *   - Every step logged at DEBUG level
 *   - Never modifies attendance data
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatutoryRates {
  epfEmployeeRate: number;  // decimal e.g. 0.12
  epfEmployerRate: number;
  epfWageCeiling: number;   // INR e.g. 15000
  esicEmployeeRate: number; // decimal e.g. 0.0075
  esicEmployerRate: number;
  esicWageCeiling: number;  // INR e.g. 21000
  ptSlabs: Array<{ upTo: number | null; monthlyPT: number }>;
}

export interface PayrollInput {
  userId: string;
  month: string;  // YYYY-MM
  // Attendance
  totalPayableDays: number;
  otHours: number;
  lossOfPayDays: number;
  // CTC
  ctcPerMonth: number;      // INR
  salaryDivisor: number;    // 26, 30, 25, or custom
  // OT config
  otHourlyRateInr?: number; // if null, no OT pay
  // Travel
  travelReimbursementInr?: number;
  // Manual
  bonusPaise?: number;
  deductionPaise?: number;
  // Rule version
  ruleVersionId?: string;
  // State for statutory lookup
  state?: string;
}

export interface PayrollResult {
  userId: string;
  month: string;
  // Component breakdown (all in PAISE)
  basicPayablePaise: number;
  otAmountPaise: number;
  travelAmountPaise: number;
  bonusPaise: number;
  grossPayablePaise: number;
  // Deductions (paise)
  epfEmployeePaise: number;
  epfEmployerPaise: number;
  esicEmployeePaise: number;
  esicEmployerPaise: number;
  professionalTaxPaise: number;
  manualDeductionPaise: number;
  totalDeductionPaise: number;
  // Net
  netPayablePaise: number;
  // INR strings (DB output boundary)
  basicPayableInr: string;
  otAmountInr: string;
  travelAmountInr: string;
  bonusInr: string;
  grossPayableInr: string;
  epfEmployeeInr: string;
  epfEmployerInr: string;
  esicEmployeeInr: string;
  esicEmployerInr: string;
  professionalTaxInr: string;
  totalDeductionInr: string;
  netPayableInr: string;
  // Flags
  isEsicApplicable: boolean;
  isEpfApplicable: boolean;
  ruleVersionId?: string;
  decisionLog: string[];
}

// ---------------------------------------------------------------------------
// Statutory Rates Loader
// ---------------------------------------------------------------------------

export async function loadStatutoryRates(state: string, month: string): Promise<StatutoryRates> {
  const refDate = month + '-01';
  const { data, error } = await supabase
    .from('salary_structure_config')
    .select('*')
    .eq('state', state)
    .lte('effective_from', refDate)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.debug(`[payrollEngine] No salary_structure_config for state=${state} month=${month} - using EPF/ESIC statutory defaults`);
    // Hard statutory minimums as safe fallback (these are NATIONAL STATUTORY RATES - not business logic)
    return {
      epfEmployeeRate: 0.12,
      epfEmployerRate: 0.12,
      epfWageCeiling: 15000,
      esicEmployeeRate: 0.0075,
      esicEmployerRate: 0.0325,
      esicWageCeiling: 21000,
      ptSlabs: [
        { upTo: 9999, monthlyPT: 0 },
        { upTo: 14999, monthlyPT: 150 },
        { upTo: null, monthlyPT: 200 },
      ],
    };
  }

  return {
    epfEmployeeRate: Number(data.epf_employee_rate),
    epfEmployerRate: Number(data.epf_employer_rate),
    epfWageCeiling: Number(data.epf_wage_ceiling),
    esicEmployeeRate: Number(data.esic_employee_rate),
    esicEmployerRate: Number(data.esic_employer_rate),
    esicWageCeiling: Number(data.esic_wage_ceiling),
    ptSlabs: data.pt_slabs ?? [],
  };
}

// ---------------------------------------------------------------------------
// Professional Tax Slab Resolver
// ---------------------------------------------------------------------------

function computePTPaise(grossInr: number, slabs: StatutoryRates['ptSlabs']): number {
  const sortedSlabs = [...slabs].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  for (const slab of sortedSlabs) {
    if (slab.upTo === null || grossInr <= slab.upTo) {
      return Math.round(slab.monthlyPT * 100);
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Core computation (pure - testable)
// ---------------------------------------------------------------------------

export function computePayroll(input: PayrollInput, rates: StatutoryRates): PayrollResult {
  const log: string[] = [];
  log.push(`DEBUG computePayroll user=${input.userId} month=${input.month}`);
  log.push(`DEBUG ctc=${input.ctcPerMonth} divisor=${input.salaryDivisor} payableDays=${input.totalPayableDays}`);

  // Step 1: Per-day rate and basic payable (in PAISE)
  const perDayInr = input.ctcPerMonth / input.salaryDivisor;
  const perDayPaise = Math.round(perDayInr * 100);
  log.push(`DEBUG per_day_paise=${perDayPaise} (ctc=${input.ctcPerMonth} / divisor=${input.salaryDivisor})`);

  // Basic payable = per_day x payable_days
  const basicPayablePaise = Math.round(perDayPaise * input.totalPayableDays);
  log.push(`DEBUG basic_payable_paise=${basicPayablePaise} (${perDayPaise} x ${input.totalPayableDays} days)`);

  // Step 2: OT amount
  const otAmountPaise = input.otHourlyRateInr && input.otHours > 0
    ? Math.round(input.otHourlyRateInr * 100 * input.otHours)
    : 0;
  if (otAmountPaise > 0) log.push(`DEBUG ot_paise=${otAmountPaise} (${input.otHours}h x ${input.otHourlyRateInr} INR/h)`);

  // Step 3: Travel reimbursement (already computed by reimbursementEngine)
  const travelAmountPaise = Math.round((input.travelReimbursementInr ?? 0) * 100);
  log.push(`DEBUG travel_paise=${travelAmountPaise}`);

  // Step 4: Bonus
  const bonusPaise = input.bonusPaise ?? 0;
  log.push(`DEBUG bonus_paise=${bonusPaise}`);

  // Step 5: Gross payable (in paise)
  const grossPayablePaise = basicPayablePaise + otAmountPaise + travelAmountPaise + bonusPaise;
  const grossPayableInr = grossPayablePaise / 100;
  log.push(`DEBUG gross_paise=${grossPayablePaise} gross_inr=${grossPayableInr.toFixed(2)}`);

  // Step 6: EPF (applies if employee is eligible — wage <= ceiling or if earning more, on capped amount)
  const isEpfApplicable = true; // All employees covered; calculation caps at ceiling
  const epfWageInr = Math.min(basicPayablePaise / 100, rates.epfWageCeiling);
  const epfEmployeePaise = Math.round(epfWageInr * rates.epfEmployeeRate * 100);
  const epfEmployerPaise = Math.round(epfWageInr * rates.epfEmployerRate * 100);
  log.push(`DEBUG epf: wage_cap=${epfWageInr} employee_paise=${epfEmployeePaise} employer_paise=${epfEmployerPaise}`);

  // Step 7: ESIC (applies only if gross <= esic wage ceiling)
  const isEsicApplicable = grossPayableInr <= rates.esicWageCeiling;
  const esicEmployeePaise = isEsicApplicable
    ? Math.round(grossPayablePaise * rates.esicEmployeeRate)
    : 0;
  const esicEmployerPaise = isEsicApplicable
    ? Math.round(grossPayablePaise * rates.esicEmployerRate)
    : 0;
  log.push(`DEBUG esic: applicable=${isEsicApplicable} employee_paise=${esicEmployeePaise} employer_paise=${esicEmployerPaise}`);

  // Step 8: Professional Tax
  const professionalTaxPaise = computePTPaise(grossPayableInr, rates.ptSlabs);
  log.push(`DEBUG pt_paise=${professionalTaxPaise} for gross=${grossPayableInr.toFixed(2)}`);

  // Step 9: Manual deduction
  const manualDeductionPaise = input.deductionPaise ?? 0;

  // Step 10: Total employee-side deductions
  const totalDeductionPaise = epfEmployeePaise + esicEmployeePaise + professionalTaxPaise + manualDeductionPaise;
  log.push(`DEBUG total_deduction_paise=${totalDeductionPaise}`);

  // Step 11: Net payable
  const netPayablePaise = Math.max(0, grossPayablePaise - totalDeductionPaise);
  log.push(`DEBUG net_payable_paise=${netPayablePaise} net_inr=${(netPayablePaise / 100).toFixed(2)}`);

  const p2s = (p: number) => (p / 100).toFixed(2);

  return {
    userId: input.userId,
    month: input.month,
    basicPayablePaise, otAmountPaise, travelAmountPaise, bonusPaise, grossPayablePaise,
    epfEmployeePaise, epfEmployerPaise, esicEmployeePaise, esicEmployerPaise,
    professionalTaxPaise, manualDeductionPaise, totalDeductionPaise, netPayablePaise,
    basicPayableInr: p2s(basicPayablePaise),
    otAmountInr: p2s(otAmountPaise),
    travelAmountInr: p2s(travelAmountPaise),
    bonusInr: p2s(bonusPaise),
    grossPayableInr: p2s(grossPayablePaise),
    epfEmployeeInr: p2s(epfEmployeePaise),
    epfEmployerInr: p2s(epfEmployerPaise),
    esicEmployeeInr: p2s(esicEmployeePaise),
    esicEmployerInr: p2s(esicEmployerPaise),
    professionalTaxInr: p2s(professionalTaxPaise),
    totalDeductionInr: p2s(totalDeductionPaise),
    netPayableInr: p2s(netPayablePaise),
    isEsicApplicable, isEpfApplicable,
    ruleVersionId: input.ruleVersionId,
    decisionLog: log,
  };
}

// ---------------------------------------------------------------------------
// DB writer
// ---------------------------------------------------------------------------

export async function writePayrollSnapshot(r: PayrollResult): Promise<void> {
  const row = {
    user_id: r.userId,
    payroll_month: r.month + '-01',
    basic_payable: r.basicPayableInr,
    ot_amount: r.otAmountInr,
    travel_reimbursement: r.travelAmountInr,
    bonus: r.bonusInr,
    gross_payable: r.grossPayableInr,
    epf_employee: r.epfEmployeeInr,
    epf_employer: r.epfEmployerInr,
    esic_employee: r.esicEmployeeInr,
    esic_employer: r.esicEmployerInr,
    professional_tax: r.professionalTaxInr,
    total_deductions: r.totalDeductionInr,
    net_payable: r.netPayableInr,
    is_esic_applicable: r.isEsicApplicable,
    rule_version_id: r.ruleVersionId ?? null,
    computation_log: r.decisionLog,
    status: 'computed',
  };

  console.debug(`[payrollEngine] write snapshot user=${r.userId} month=${r.month} net=${r.netPayableInr}`);

  const { error } = await supabase
    .from('payroll_snapshots')
    .upsert(row, { onConflict: 'user_id,payroll_month' });

  if (error) throw new Error(`payroll_snapshots upsert: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runPayrollEngine(opts: {
  userIds: string[];
  month: string;
  state?: string;
  dryRun?: boolean;
}): Promise<{ processed: number; written: number; errors: string[]; results: PayrollResult[] }> {
  const out = { processed: 0, written: 0, errors: [] as string[], results: [] as PayrollResult[] };
  const state = opts.state ?? 'KA';
  const rates = await loadStatutoryRates(state, opts.month);
  console.debug(`[payrollEngine] run: users=${opts.userIds.length} month=${opts.month} state=${state} dryRun=${opts.dryRun}`);

  for (const userId of opts.userIds) {
    out.processed++;
    try {
      // Load attendance snapshot
      const { data: snap } = await supabase
        .from('attendance_month_snapshots')
        .select('total_payable_days, ot_hours, loss_of_pay_days, rule_version_id')
        .eq('user_id', userId)
        .eq('month', opts.month + '-01')
        .maybeSingle();

      // Load user CTC
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      // Load travel reimbursement
      const { data: claim } = await supabase
        .from('reimbursement_claims')
        .select('net_amount')
        .eq('user_id', userId)
        .eq('claim_month', opts.month + '-01')
        .maybeSingle();

      // Load site_staff_config for CTC (field: ctc_per_month, salary_divisor)
      const { data: ssc } = await supabase
        .from('site_staff_config')
        .select('ctc_per_month, salary_divisor')
        .eq('user_id', userId)
        .maybeSingle();

      const input: PayrollInput = {
        userId,
        month: opts.month,
        totalPayableDays: snap?.total_payable_days ?? 0,
        otHours: snap?.ot_hours ?? 0,
        lossOfPayDays: snap?.loss_of_pay_days ?? 0,
        ctcPerMonth: Number(ssc?.ctc_per_month ?? 0),
        salaryDivisor: Number(ssc?.salary_divisor ?? 26),
        travelReimbursementInr: claim ? Number(claim.net_amount) : 0,
        ruleVersionId: snap?.rule_version_id ?? undefined,
        state,
      };

      const result = computePayroll(input, rates);
      out.results.push(result);

      if (!opts.dryRun) {
        await writePayrollSnapshot(result);
        out.written++;
      }
    } catch (err: any) {
      out.errors.push(`${userId}: ${err?.message}`);
    }
  }

  console.debug(`[payrollEngine] done: processed=${out.processed} written=${out.written} errors=${out.errors.length}`);
  return out;
}
