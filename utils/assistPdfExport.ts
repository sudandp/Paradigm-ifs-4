import { format } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface StaffRosterPDFOptions {
  siteName: string;
  siteCity?: string;
  staffList: Array<{
    employee_id?: string;
    full_name: string;
    designation: string;
    department: string;
    phone: string;
    shift_type?: string;
    reporting_manager_name?: string;
  }>;
  generatedBy?: string;
}

export interface EscalationMatrixPDFOptions {
  siteName: string;
  siteCity?: string;
  escalationList: Array<{
    level: string;
    role_name: string;
    contact_person: string;
    phone: string;
    email?: string;
    tat_minutes: number;
    escalation_trigger: string;
  }>;
  generatedBy?: string;
}

export async function exportSiteStaffRosterPDF(options: StaffRosterPDFOptions) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const {
    siteName,
    siteCity = 'Bengaluru',
    staffList,
    generatedBy = 'Paradigm Operations'
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header Logo
  const logoUrl = '/Paradigm-Logo-3-1024x157.png';
  try {
    doc.addImage(logoUrl, 'PNG', margin, 10, 45, 7);
  } catch (e) {
    // continue without logo
  }

  // Header Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('PARADIGM INTEGRATED FACILITY SERVICES PVT. LTD.', pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`OFFICIAL SITE STAFF ROSTER & DUTY DIRECTORY — ${siteName.toUpperCase()} (${siteCity.toUpperCase()})`, pageWidth / 2, 21, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Authorized By: ${generatedBy} | Total Active Personnel: ${staffList.length}`, pageWidth / 2, 26, { align: 'center' });

  // Table Columns & Rows
  const head = [['S.No', 'Emp ID', 'Full Name', 'Designation', 'Department', 'Phone Number', 'Shift', 'Reporting Manager']];
  const body = staffList.map((s, idx) => [
    idx + 1,
    s.employee_id || `PAR-${String(idx + 1).padStart(3, '0')}`,
    s.full_name,
    s.designation,
    s.department,
    s.phone,
    s.shift_type || 'GS',
    s.reporting_manager_name || 'Site Manager'
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 45, fontStyle: 'bold' },
      3: { cellWidth: 45 },
      4: { cellWidth: 30 },
      5: { cellWidth: 35 },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 40 }
    },
    didDrawPage: (data) => {
      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${pageNumber} of ${totalPages} • Confidential • For Internal Paradigm & Client Management Use Only`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }
  });

  const fileName = `Paradigm_Roster_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;

  await saveOrSharePdf(doc, fileName);
}

export async function exportEscalationMatrixPDF(options: EscalationMatrixPDFOptions) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const {
    siteName,
    siteCity = 'Bengaluru',
    escalationList,
    generatedBy = 'Paradigm Operations'
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const logoUrl = '/Paradigm-Logo-3-1024x157.png';
  try {
    doc.addImage(logoUrl, 'PNG', margin, 10, 45, 7);
  } catch (e) {}

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PARADIGM INTEGRATED FACILITY SERVICES PVT. LTD.', pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38); // red-600
  doc.text(`INCIDENT & EMERGENCY ESCALATION MATRIX — ${siteName.toUpperCase()}`, pageWidth / 2, 21, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`City: ${siteCity} | Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Authorized By: ${generatedBy}`, pageWidth / 2, 26, { align: 'center' });

  const head = [['Level', 'Role / Designation', 'Contact Person', 'Phone Number', 'SLA / TAT', 'Escalation Trigger']];
  const body = escalationList.map(e => [
    e.level,
    e.role_name,
    e.contact_person,
    e.phone,
    `${e.tat_minutes} mins`,
    e.escalation_trigger
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [185, 28, 28], // red-700
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 35, fontStyle: 'bold' },
      2: { cellWidth: 35 },
      3: { cellWidth: 30 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 45 }
    },
    didDrawPage: () => {
      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${pageNumber} of ${totalPages} • Paradigm 24x7 Helpdesk: +91 80 4114 2666 • ISO 9001:2015 Certified`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }
  });

  const fileName = `Paradigm_Escalation_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  await saveOrSharePdf(doc, fileName);
}

async function saveOrSharePdf(doc: any, fileName: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });

      await Share.share({
        title: fileName,
        url: savedFile.uri,
        dialogTitle: 'Share or Open PDF Document'
      });
      return;
    } catch (nativeErr) {
      console.warn('[PDF] Native share failed, falling back to browser download:', nativeErr);
    }
  }

  doc.save(fileName);
}
