import { SiteStaffConfig, generateMonthlyOutput, ManualAdjustment } from './siteStaffCalculations';

export interface LumpsumItem {
  itemName: string;
  ratePerMonth: number;
}

export interface InvoiceRecord {
  subTotal: number;
  managementFee: number;
  totalBeforeGst: number;
  gstAmount: number;
  grandTotal: number;
  perPresentLines: {
    employeeName: string;
    duties: number;
    rate: number;
    total: number;
  }[];
  lumpsumLines: {
    itemName: string;
    rate: number;
  }[];
}

export function generateSiteInvoice(
  employees: { config: SiteStaffConfig, employeeName: string, attendanceMarks: string[], holidaysInPeriod: number, elOpening: number, woOpening: number, manualAdjustments?: ManualAdjustment[] }[],
  lumpsumItems: LumpsumItem[],
  managementFee: number,
  billingPeriodStart: string,
  billingPeriodEnd: string
): InvoiceRecord {
  let perPresentTotal = 0;
  const perPresentLines: InvoiceRecord['perPresentLines'] = [];

  employees.forEach(emp => {
    const monthlyRecord = generateMonthlyOutput(
      emp.config.userId,
      billingPeriodStart,
      billingPeriodEnd,
      emp.config,
      emp.attendanceMarks,
      emp.holidaysInPeriod,
      emp.elOpening,
      emp.woOpening,
      emp.manualAdjustments
    );

    perPresentLines.push({
      employeeName: emp.employeeName,
      duties: monthlyRecord.billing.billable_days_count,
      rate: monthlyRecord.billing.per_day_rate,
      total: monthlyRecord.billing.invoice_subtotal
    });

    perPresentTotal += monthlyRecord.billing.invoice_subtotal;
  });

  let lumpsumTotal = 0;
  const lumpsumLines: InvoiceRecord['lumpsumLines'] = [];
  
  lumpsumItems.forEach(item => {
    lumpsumLines.push({
      itemName: item.itemName,
      rate: item.ratePerMonth
    });
    lumpsumTotal += item.ratePerMonth;
  });

  const subTotal = perPresentTotal + lumpsumTotal;
  const totalBeforeGst = subTotal + managementFee;
  const gstAmount = totalBeforeGst * 0.18;
  const grandTotal = totalBeforeGst + gstAmount;

  return {
    subTotal: Number(subTotal.toFixed(2)),
    managementFee: Number(managementFee.toFixed(2)),
    totalBeforeGst: Number(totalBeforeGst.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
    perPresentLines,
    lumpsumLines
  };
}
