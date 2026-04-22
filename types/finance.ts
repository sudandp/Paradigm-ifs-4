// Finance Module Type Definitions

export type PaymentMode = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'Cheque' | 'Cash';
export type PaymentStatus = 'Pending' | 'Partial' | 'Full' | 'Overdue';

export interface OpsPaymentReceipt {
  id: string;
  organizationId?: string;
  entityId: string;
  entityName?: string; // Joined from entities
  
  // Invoice Details
  invoiceNumber: string;
  invoiceDate?: string;
  invoiceBaseAmount: number;
  invoiceGstAmount: number;
  invoiceTotalAmount?: number; // Generated column
  
  // Payment Details
  amountReceived: number;
  paymentDate: string;
  paymentMode?: PaymentMode;
  referenceNumber?: string;
  
  // Deductions
  tdsDeducted: number;
  tdsSection?: string;
  otherDeductions: number;
  
  // Status
  status: PaymentStatus;
  remarks?: string;
  
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfitabilityMetric {
  entityId: string;
  entityName: string;
  totalContractValue: number;      // From ops_contracts
  totalInvoiced: number;           // From ops_payment_receipts (invoiceTotalAmount)
  totalReceived: number;           // From ops_payment_receipts (amountReceived)
  totalTdsDeducted: number;        // From ops_payment_receipts
  totalOutstanding: number;        // totalInvoiced - (totalReceived + totalTdsDeducted + otherDeductions)
  profitMarginPercent: number;     // Calculation (Revenue - Expected Costs) / Revenue * 100
  lastPaymentDate?: string;
}
