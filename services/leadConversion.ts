import { supabase } from './supabase';
import { crmApi } from './crmApi';
import type { CrmLead, CrmChecklistSubmission, CrmQuotation } from '../types/crm';
import type { Entity } from '../types/organization';

/**
 * CRM Lead-to-Entity Conversion Service
 * 
 * When a lead is "Won", this service:
 * 1. Creates a new Entity record from the lead's property data
 * 2. Maps survey checklist data into Entity fields
 * 3. Links the lead to the new entity
 * 4. Updates lead status to "Onboarding Started"
 */

interface ConversionResult {
  entityId: string;
  success: boolean;
  message: string;
}

export const leadConversionService = {

  /**
   * Convert a won lead into an Entity record in the existing society/entity module.
   */
  convertLeadToEntity: async (leadId: string): Promise<ConversionResult> => {
    try {
      // 1. Fetch lead data
      const lead = await crmApi.getLeadById(leadId);
      if (!lead) throw new Error('Lead not found');
      if (lead.convertedEntityId) {
        return { entityId: lead.convertedEntityId, success: true, message: 'Already converted' };
      }

      // 2. Fetch survey data (if exists)
      const survey = await crmApi.getChecklistSubmission(leadId);

      // 3. Fetch latest quotation (if exists)
      const quotations = await crmApi.getQuotations(leadId);
      const latestQuotation = quotations.length > 0 ? quotations[0] : null;

      // 4. Build Entity object from lead + survey data
      const entityData = buildEntityFromLead(lead, survey, latestQuotation);

      // 5. Insert into entities table
      const { data: newEntity, error } = await supabase
        .from('entities')
        .insert(entityData)
        .select('id')
        .single();

      if (error) throw error;

      // 6. Update the lead with the converted entity ID
      await crmApi.updateLead(leadId, {
        convertedEntityId: newEntity.id,
        convertedAt: new Date().toISOString(),
        status: 'Onboarding Started',
      });

      // 7. Audit log
      await crmApi.createAuditLog(
        'crm',
        leadId,
        'conversion',
        null,
        { entityId: newEntity.id },
        `Lead converted to Entity: ${lead.clientName}`
      );

      return {
        entityId: newEntity.id,
        success: true,
        message: `Successfully converted "${lead.clientName}" to Entity`,
      };
    } catch (err: any) {
      console.error('[CRM Conversion] Failed:', err);
      return {
        entityId: '',
        success: false,
        message: err.message || 'Conversion failed',
      };
    }
  },
};

/**
 * Maps CRM lead data + survey results into the Entity structure
 */
function buildEntityFromLead(
  lead: CrmLead,
  survey: CrmChecklistSubmission | null,
  quotation: CrmQuotation | null
): Record<string, any> {
  const entity: Record<string, any> = {
    name: lead.clientName,
    billing_name: lead.associationName || lead.clientName,
    organization_id: lead.organizationId,
    location: lead.city ? `${lead.location || ''}, ${lead.city}`.replace(/^,\s*/, '') : lead.location,
    email: lead.email,
    status: 'draft',
    site_takeover_date: lead.expectedStartDate || new Date().toISOString().split('T')[0],

    // Site Management from property data
    site_management: {
      siteAreaSqFt: lead.areaSqft || 0,
      projectType: lead.propertyType || 'Residential',
      unitCount: lead.unitCount || 0,
    },
  };

  // Map survey infrastructure data into asset tracking
  if (survey?.data) {
    const data = survey.data;
    const tools: any[] = [];

    // Extract infrastructure items that were marked "Yes"
    const infraItems = [
      { key: 'dg_generator', name: 'DG / Generator' },
      { key: 'stp', name: 'STP' },
      { key: 'wtp', name: 'WTP' },
      { key: 'pumps', name: 'Pumps' },
      { key: 'lifts', name: 'Lifts / Elevators' },
      { key: 'fire_systems', name: 'Fire Fighting Systems' },
      { key: 'electrical_panels', name: 'Electrical Panels' },
      { key: 'cctv', name: 'CCTV Systems' },
      { key: 'intercom', name: 'Intercom System' },
      { key: 'swimming_pool', name: 'Swimming Pool' },
      { key: 'transformer', name: 'Transformer' },
    ];

    infraItems.forEach(item => {
      const response = data[item.key];
      if (response?.value === 'Yes') {
        tools.push({
          name: item.name,
          brand: '',
          size: '',
          quantity: 1,
          issueDate: new Date().toISOString().split('T')[0],
          imageUrl: '',
          dcCopyRef: response.remarks || '',
        });
      }
    });

    if (tools.length > 0) {
      entity.asset_tracking = { tools };
    }

    // Map compliance data
    const compliance: Record<string, any> = {
      form6Applicable: false,
      minWageRevisionApplicable: false,
    };

    if (data.pf_registration?.value === 'Yes') {
      compliance.epfoSubCodes = data.pf_registration.remarks || '';
    }
    if (data.esi_registration?.value === 'Yes') {
      compliance.esicSubCodes = data.esi_registration.remarks || '';
    }

    entity.compliance_details = compliance;
  }

  // Map quotation data into financial linkage
  if (quotation) {
    entity.financial_linkage = {
      effectiveDate: new Date().toISOString().split('T')[0],
      version: `v${quotation.version}`,
    };
  }

  return entity;
}

/**
 * Generate a simple HTML proposal from quotation data,
 * which can be printed to PDF via the browser.
 */
export function generateProposalHtml(
  lead: CrmLead,
  quotation: CrmQuotation,
  companyName: string = 'Paradigm IFS'
): string {
  const fmt = (val: number) =>
    val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const manpowerRows = quotation.manpowerDetails.map((m, i) => {
    const effectiveCount = m.relieverRequired ? Math.ceil(m.count * 1.17) : m.count;
    const total = effectiveCount * m.salary;
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${m.role}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${effectiveCount}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.shiftType}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(m.salary)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmt(total)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Proposal - ${lead.clientName}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #006b3f; padding-bottom: 20px; }
    .logo-area h1 { color: #006b3f; font-size: 24px; margin: 0 0 4px; }
    .logo-area p { color: #666; font-size: 11px; margin: 0; }
    .ref-box { text-align: right; font-size: 11px; color: #666; }
    .ref-box .num { font-size: 16px; font-weight: 700; color: #006b3f; }
    .section-title { background: #006b3f; color: white; padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: 700; margin: 24px 0 12px; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f0fdf4; color: #006b3f; text-align: left; padding: 10px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #006b3f; }
    .summary-table td { padding: 6px 12px; }
    .summary-table .label { color: #666; }
    .summary-table .value { text-align: right; font-weight: 600; }
    .grand-total { background: #006b3f; color: white; font-size: 16px; }
    .grand-total td { padding: 12px !important; font-weight: 700; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #999; text-align: center; }
    .client-box { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .client-box h3 { margin: 0 0 8px; color: #006b3f; font-size: 14px; }
    .client-box p { margin: 2px 0; font-size: 12px; color: #444; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>${companyName}</h1>
      <p>Facility Management Solutions</p>
    </div>
    <div class="ref-box">
      <div class="num">${quotation.quotationNumber || `QTN-${Date.now().toString(36).toUpperCase()}`}</div>
      <div>Date: ${today}</div>
      <div>Version: ${quotation.version}</div>
    </div>
  </div>

  <div class="client-box">
    <h3>Proposal For</h3>
    <p><strong>${lead.clientName}</strong></p>
    ${lead.associationName ? `<p>${lead.associationName}</p>` : ''}
    ${lead.location ? `<p>📍 ${lead.location}${lead.city ? ', ' + lead.city : ''}</p>` : ''}
    ${lead.contactPerson ? `<p>👤 ${lead.contactPerson} ${lead.phone ? '• ' + lead.phone : ''}</p>` : ''}
    ${lead.propertyType ? `<p>🏢 ${lead.propertyType} • ${lead.unitCount || '-'} Units • ${lead.areaSqft?.toLocaleString('en-IN') || '-'} sqft</p>` : ''}
  </div>

  <div class="section-title">MANPOWER DEPLOYMENT</div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Role / Designation</th>
        <th style="text-align:center">Count</th>
        <th style="text-align:center">Shift</th>
        <th style="text-align:right">Rate (₹/Mo)</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${manpowerRows}</tbody>
  </table>

  <div class="section-title">COST SUMMARY</div>
  <table class="summary-table">
    <tr><td class="label">Salary Cost</td><td class="value">${fmt(quotation.totalSalaryCost)}</td></tr>
    <tr><td class="label">Statutory Compliance (PF + ESI + Bonus + Gratuity)</td><td class="value">${fmt(quotation.statutoryCost)}</td></tr>
    <tr><td class="label">Consumables</td><td class="value">${fmt(quotation.consumablesCost)}</td></tr>
    <tr><td class="label">Equipment</td><td class="value">${fmt(quotation.equipmentCost)}</td></tr>
    <tr><td class="label">Uniforms</td><td class="value">${fmt(quotation.uniformCost)}</td></tr>
    <tr style="border-top:1px solid #e5e7eb"><td class="label" style="font-weight:600">Subtotal</td><td class="value" style="font-weight:700">${fmt(quotation.totalSalaryCost + quotation.statutoryCost + quotation.consumablesCost + quotation.equipmentCost + quotation.uniformCost)}</td></tr>
    <tr><td class="label">Management Fee (${quotation.managementFeePercent}%)</td><td class="value">${fmt(quotation.managementFee)}</td></tr>
    <tr><td class="label">GST (${quotation.gstPercent}%)</td><td class="value">${fmt(quotation.gstAmount)}</td></tr>
    <tr class="grand-total"><td>MONTHLY TOTAL</td><td style="text-align:right">${fmt(quotation.monthlyCost)}</td></tr>
    <tr style="background:#f0fdf4"><td class="label" style="font-weight:600;color:#006b3f">ANNUAL VALUE</td><td class="value" style="font-weight:700;color:#006b3f;font-size:15px">${fmt(quotation.annualCost)}</td></tr>
  </table>

  <div class="section-title">TERMS & CONDITIONS</div>
  <ol style="padding-left:18px;line-height:1.8;font-size:11px;color:#444">
    <li>This proposal is valid for 30 days from the date of issue.</li>
    <li>All statutory obligations (PF, ESI, Bonus, Gratuity) are computed as per prevailing rates.</li>
    <li>Minimum wage revisions by the government will be passed on at actuals.</li>
    <li>Management fee covers supervision, administration, and HR support.</li>
    <li>GST is applicable as per government norms and billed separately.</li>
    <li>Payment terms: Monthly billing with 15-day credit period.</li>
    <li>Contract period: 12 months, renewable on mutual agreement.</li>
    <li>Uniforms will be provided as per agreed specifications.</li>
  </ol>

  <div class="footer">
    <p>This is a computer-generated document. No signature is required.</p>
    <p>${companyName} • Facility Management Solutions • Generated on ${today}</p>
  </div>
</body>
</html>`;
}
