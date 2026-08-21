import { HTAuditHeader, HTEquipmentInstance, HTAuditResponse, HTSnagItem } from '../types/htYard';

export const htYardExporter = {
  // Generate multi-tab Excel replacing HT_yard.xlsx
  async exportToExcel(
    audit: HTAuditHeader,
    equipmentInstances: HTEquipmentInstance[],
    responses: Record<string, HTAuditResponse>,
    snagItems: HTSnagItem[]
  ): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Paradigm IFS 4.0';
    workbook.created = new Date();

    // Sheet 1: Summary & Site Details
    const summarySheet = workbook.addWorksheet('Site Overview');
    summarySheet.columns = [
      { header: 'Property / Field', key: 'field', width: 30 },
      { header: 'Audit Detail Value', key: 'value', width: 50 }
    ];

    summarySheet.addRows([
      { field: 'Site Name', value: audit.siteName },
      { field: 'Reference No.', value: audit.referenceNumber },
      { field: 'Audit Date', value: audit.auditDate },
      { field: 'Client / Division', value: audit.clientDivision || 'N/A' },
      { field: 'Auditor Name', value: audit.auditorName || 'N/A' },
      { field: 'Approval Status', value: audit.status },
      { field: 'Total Equipment Count', value: equipmentInstances.length }
    ]);

    // Sheet per Equipment Instance
    equipmentInstances.forEach((inst) => {
      const sheetName = `${inst.instanceName} Audit Report`.substring(0, 31); // max 31 chars in Excel
      const sheet = workbook.addWorksheet(sheetName);

      sheet.columns = [
        { header: 'Sl. No.', key: 'sl', width: 8 },
        { header: 'Checklist Item Description', key: 'label', width: 45 },
        { header: 'Audit Observation / Details', key: 'value', width: 35 },
        { header: 'Remarks', key: 'remarks', width: 35 }
      ];

      // Filter responses for this instance
      const instanceResponses = Object.values(responses).filter(
        (r) => r.equipmentInstanceId === inst.id
      );

      instanceResponses.forEach((r, idx) => {
        sheet.addRow({
          sl: idx + 1,
          label: r.fieldLabel,
          value: r.isNotApplicable ? 'N/A' : r.responseValue || '-',
          remarks: r.remarks || ''
        });
      });
    });

    // Sheet for Snag Points
    if (snagItems.length > 0) {
      const snagSheet = workbook.addWorksheet('Snag Points Rollup');
      snagSheet.columns = [
        { header: 'Sl No.', key: 'sl', width: 8 },
        { header: 'Snag Point / Defect', key: 'snag', width: 40 },
        { header: 'Action Suggested', key: 'action', width: 40 },
        { header: 'Target Date', key: 'targetDate', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
      ];

      snagItems.forEach((s, idx) => {
        snagSheet.addRow({
          sl: idx + 1,
          snag: s.snagPoint,
          action: s.actionSuggested,
          targetDate: s.targetDate || '-',
          status: s.status
        });
      });
    }

    // Trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `HT_Yard_Audit_${audit.siteName.replace(/\s+/g, '_')}_${audit.referenceNumber}.xlsx`;
    link.click();
  },

  // Generate PDF report for BESCOM/CEIG submission
  async exportToPDF(
    audit: HTAuditHeader,
    equipmentInstances: HTEquipmentInstance[],
    responses: Record<string, HTAuditResponse>,
    snagItems: HTSnagItem[]
  ): Promise<void> {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text('HT YARD / SITE TAKE-OVER ELECTRICAL AUDIT REPORT', 14, 20);

    doc.setFontSize(10);
    doc.text(`Site Name: ${audit.siteName}`, 14, 28);
    doc.text(`Reference No: ${audit.referenceNumber}`, 14, 34);
    doc.text(`Audit Date: ${audit.auditDate}`, 14, 40);
    doc.text(`Auditor: ${audit.auditorName || 'N/A'}`, 140, 28);
    doc.text(`Status: ${audit.status}`, 140, 34);

    let startY = 48;

    // Equipment Summaries
    equipmentInstances.forEach((inst) => {
      doc.setFontSize(12);
      doc.text(`${inst.instanceName} Checklist Details`, 14, startY);

      const instanceResponses = Object.values(responses).filter(
        (r) => r.equipmentInstanceId === inst.id
      );

      const tableData = instanceResponses.map((r, idx) => [
        idx + 1,
        r.fieldLabel,
        r.isNotApplicable ? 'N/A' : r.responseValue || '-',
        r.remarks || ''
      ]);

      autoTable(doc, {
        startY: startY + 4,
        head: [['#', 'Checklist Item', 'Audit Value', 'Remarks']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
      });

      startY = (doc as any).lastAutoTable.finalY + 12;
      if (startY > 260) {
        doc.addPage();
        startY = 20;
      }
    });

    // Save PDF
    doc.save(`HT_Yard_Audit_${audit.siteName.replace(/\s+/g, '_')}_${audit.referenceNumber}.pdf`);
  }
};
