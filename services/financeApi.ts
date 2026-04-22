import { supabase } from './supabase';
import type { OpsPaymentReceipt, ProfitabilityMetric } from '../types/finance';
import type { OpsContract } from '../types/operations';

// Helper to convert snake_case DB fields to camelCase TS fields
const toCamelCase = (data: any): any => {
  if (Array.isArray(data)) return data.map(item => toCamelCase(item));
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const camelCased: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
        camelCased[camelKey] = toCamelCase(data[key]);
      }
    }
    return camelCased;
  }
  return data;
};

// Helper to convert camelCase TS fields to snake_case DB fields
const toSnakeCase = (data: any): any => {
  if (Array.isArray(data)) return data.map(item => toSnakeCase(item));
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

export const financeApi = {

  // ==========================================================================
  // PAYMENT RECEIPTS
  // ==========================================================================

  getPaymentReceipts: async (entityId?: string): Promise<OpsPaymentReceipt[]> => {
    let query = supabase
      .from('ops_payment_receipts')
      .select('*, entity:entities(name)');
    
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    
    const { data, error } = await query.order('payment_date', { ascending: false });
    if (error) throw error;
    
    return (data || []).map((row: any) => {
      const receipt = toCamelCase(row);
      receipt.entityName = row.entity?.name;
      return receipt;
    });
  },

  savePaymentReceipt: async (receipt: Partial<OpsPaymentReceipt>): Promise<OpsPaymentReceipt> => {
    const { id, createdAt, updatedAt, entityName, invoiceTotalAmount, ...rest } = receipt as any;
    
    // Auto status check
    const totalExpected = (rest.invoiceBaseAmount || 0) + (rest.invoiceGstAmount || 0);
    const totalRealized = (rest.amountReceived || 0) + (rest.tdsDeducted || 0) + (rest.otherDeductions || 0);
    
    if (totalRealized >= totalExpected && totalExpected > 0) {
      rest.status = 'Full';
    } else if (totalRealized > 0 && totalRealized < totalExpected) {
      rest.status = 'Partial';
    } else {
      rest.status = 'Pending';
    }
    
    let query;
    if (id) {
      query = supabase.from('ops_payment_receipts').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('ops_payment_receipts').insert(toSnakeCase(rest));
    }
    
    const { data, error } = await query.select('*, entity:entities(name)').single();
    if (error) throw error;
    
    const saved = toCamelCase(data);
    saved.entityName = data.entity?.name;
    return saved;
  },

  deletePaymentReceipt: async (id: string): Promise<void> => {
    const { error } = await supabase.from('ops_payment_receipts').delete().eq('id', id);
    if (error) throw error;
  },

  // ==========================================================================
  // PROFITABILITY
  // ==========================================================================

  getProfitabilityStats: async (): Promise<ProfitabilityMetric[]> => {
    // 1. Fetch all active contracts
    const { data: contractsData, error: contractsError } = await supabase
      .from('ops_contracts')
      .select('*, entity:entities(id, name)')
      .eq('status', 'Active');
      
    if (contractsError) throw contractsError;
    
    // 2. Fetch all payment receipts
    const { data: receiptsData, error: receiptsError } = await supabase
      .from('ops_payment_receipts')
      .select('*');
      
    if (receiptsError) throw receiptsError;

    // Group by entity
    const metricsMap = new Map<string, ProfitabilityMetric>();

    // Process Contracts (Revenue)
    (contractsData || []).forEach((contract: any) => {
      const entityId = contract.entity_id;
      if (!entityId || !contract.entity) return;
      
      if (!metricsMap.has(entityId)) {
        metricsMap.set(entityId, {
          entityId,
          entityName: contract.entity.name,
          totalContractValue: 0,
          totalInvoiced: 0,
          totalReceived: 0,
          totalTdsDeducted: 0,
          totalOutstanding: 0,
          profitMarginPercent: 0
        });
      }
      
      const metric = metricsMap.get(entityId)!;
      metric.totalContractValue += Number(contract.contract_value) || 0;
    });

    // Process Receipts
    (receiptsData || []).forEach((receipt: any) => {
      const entityId = receipt.entity_id;
      if (!metricsMap.has(entityId)) return; // Only process receipts for entities with active contracts for now
      
      const metric = metricsMap.get(entityId)!;
      metric.totalInvoiced += Number(receipt.invoice_total_amount) || 0;
      metric.totalReceived += Number(receipt.amount_received) || 0;
      metric.totalTdsDeducted += Number(receipt.tds_deducted) || 0;
      
      if (!metric.lastPaymentDate || new Date(receipt.payment_date) > new Date(metric.lastPaymentDate)) {
        metric.lastPaymentDate = receipt.payment_date;
      }
    });

    // Calculate derived fields
    metricsMap.forEach(metric => {
      const totalRealized = metric.totalReceived + metric.totalTdsDeducted; // TDS is considered realized revenue
      metric.totalOutstanding = metric.totalInvoiced - totalRealized;
      
      // Basic Profit Margin Estimate (Assumption: 15% standard margin if real costs aren't available yet)
      // For Indian standards, we'd ideally pull PF/ESI/LWF costs from payroll here. 
      // For now, we'll use a fixed estimated margin on the contract value for demo purposes.
      metric.profitMarginPercent = 15.0; // 15% placeholder
    });

    return Array.from(metricsMap.values());
  }
};
