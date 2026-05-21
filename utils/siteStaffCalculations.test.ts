import { describe, it, expect } from 'vitest';
import {
  calculatePerDayRate,
  accrueWOBalance,
  accrueELBalance,
  calculateNHAddition,
  generateMonthlyOutput,
  SiteStaffConfig
} from './siteStaffCalculations';

describe('Site Staff Calculations', () => {
  const baseConfig: SiteStaffConfig = {
    userId: 'test-user',
    ctcPerMonth: 28150,
    weeklyOffsPerWeek: 1,
    earnedLeavesPerAnnum: 0,
    nfhPerAnnum: 12,
    nhBillingConfig: 'Actuals',
    nhSalaryConfig: 'Double',
    shift: 'A',
    shiftHours: 8
  };

  it('calculates per day billing rate correctly when nhBillingConfig=Actuals (NFH deducted)', () => {
    const result = calculatePerDayRate(baseConfig);
    expect(result.perAnnumRate).toBe(337800);
    // 365 - (365/7*1) - 0 - 12 = 365 - 52.1428 - 12 = 300.857
    expect(result.billableDutiesInYear).toBeCloseTo(300.857, 2);
    expect(result.perDayBillingRate).toBeCloseTo(1122.79, 2);
  });

  it('does NOT deduct NFH from billable duties when nhBillingConfig=NA', () => {
    const naConfig = { ...baseConfig, nhBillingConfig: 'NA' as const };
    const result = calculatePerDayRate(naConfig);
    expect(result.perAnnumRate).toBe(337800);
    // NA: 365 - (365/7*1) - 0 - 0 = 365 - 52.1428 = 312.857 (NFH NOT deducted)
    expect(result.billableDutiesInYear).toBeCloseTo(312.857, 2);
    expect(result.perDayBillingRate).toBeCloseTo(1079.73, 1);
  });

  it('accrues WO balance correctly with floored allotment and fractional carry-forward', () => {
    // 26 days present => 26 * (1/6) = 4.333 earned
    const result = accrueWOBalance(26, 0.5); // Opening balance 0.5
    expect(result.earned).toBeCloseTo(4.333, 2);
    // 0.5 + 4.333 = 4.833 => Allotted should be 4
    expect(result.allotted).toBe(4);
    // Closing should be 0.833
    expect(result.closing).toBeCloseTo(0.833, 2);
  });

  it('accrues EL balance correctly based on WO allotted', () => {
    // EL logic applies when Y=18
    const elConfig = { ...baseConfig, earnedLeavesPerAnnum: 18 };
    // Days present = 26, WO Allotted = 4, Holidays = 1
    // Qualifying days = 26 + 4 + 1 = 31
    // Earned = 31 * 0.05 = 1.55
    const result = accrueELBalance(26, 4, 1, 2.0, 1.0, elConfig.earnedLeavesPerAnnum);
    expect(result.earned).toBeCloseTo(1.55, 2);
    expect(result.availed).toBe(1.0);
    expect(result.closing).toBeCloseTo(2.55, 2); // 2.0 + 1.55 - 1.0
  });

  it('skips EL accrual if Y=0', () => {
    const result = accrueELBalance(26, 4, 1, 2.0, 1.0, 0);
    expect(result.earned).toBe(0);
    expect(result.availed).toBe(0);
    expect(result.closing).toBe(2.0); // Remains opening
  });

  it('calculates NH additions for all configs correctly', () => {
    // Scenario: 3 holidays total, 1 half-HP worked, 1 full-HP worked, 1 not worked
    // NA:      notWorked=0, half=0.5, full=1   => 0 + 0.5 + 1 = 1.5
    expect(calculateNHAddition('NA', 3, 1, 1)).toBe(1.5);
    // Actuals: notWorked=1, half=1.5, full=2   => 1 + 1.5 + 2 = 4.5
    expect(calculateNHAddition('Actuals', 3, 1, 1)).toBe(4.5);
    // Double:  notWorked=1, half=2, full=3     => 1 + 2 + 3 = 6
    expect(calculateNHAddition('Double', 3, 1, 1)).toBe(6);
  });

  it('calculates NH additions - simple: 1 holiday worked full day', () => {
    // 1 holiday total, 0 half-HP, 1 full-HP worked => not-worked = 0
    // NA:      0 + 0 + 1 = 1  (duty only)
    expect(calculateNHAddition('NA', 1, 0, 1)).toBe(1);
    // Actuals: 0 + 0 + 2 = 2  (1 base + 1 actual = 1+1)
    expect(calculateNHAddition('Actuals', 1, 0, 1)).toBe(2);
    // Double:  0 + 0 + 3 = 3  (1 base + 2*actual = 1+1+1)
    expect(calculateNHAddition('Double', 1, 0, 1)).toBe(3);
  });

  it('calculates NH additions - 1 holiday NOT worked', () => {
    // 1 holiday total, 0 half-HP, 0 full-HP => not-worked = 1
    // NA:      0  (no pay for non-worked)
    expect(calculateNHAddition('NA', 1, 0, 0)).toBe(0);
    // Actuals: 1  (base only)
    expect(calculateNHAddition('Actuals', 1, 0, 0)).toBe(1);
    // Double:  1  (base only)
    expect(calculateNHAddition('Double', 1, 0, 0)).toBe(1);
  });

  it('generates accurate monthly output combining all logic', () => {
    const marks = [
      ...Array(26).fill('P'),
      '1/2P', '1/2P', // 1 day combined
      'WO', 'WO', 'WO', 'WO',
      'EL',
      'HP' // 1 holiday worked full day
    ]; // 27 P equivalent, 1 EL, 4 WO, 1 HP
    
    // Note: marks array just simulates what we pass to it
    const output = generateMonthlyOutput(
      'emp1',
      '2026-04-21',
      '2026-05-20',
      baseConfig,
      marks,
      1, // 1 holiday in period (the one HP day)
      2.0, // el opening
      0.33 // wo opening
    );

    // Days present: 26 (P) + 1 (1/2P + 1/2P) = 27
    expect(output.attendance_summary.days_present).toBe(27);
    
    // NH Billing: config='Actuals', 1 holiday total, 0 half-HP, 1 HP
    // notWorked=0, HP = 1+1 = 2 => total = 2
    expect(output.attendance_summary.nh_billing_addition).toBe(2);
    // NH Salary: config='Double', 1 holiday total, 0 half-HP, 1 HP
    // notWorked=0, HP = 1+1+1 = 3 => total = 3
    expect(output.attendance_summary.nh_salary_addition).toBe(3);

    // Billable days count: 27 present + 2 nh billing = 29
    expect(output.billing.billable_days_count).toBe(29);
    // Workdays for disbursement: 27 present + 4 wo allotted + 1 el availed + 3 nh salary = 35
    expect(output.salary.workdays_for_disbursement).toBe(35);
  });
});
