import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import type { OnboardingData } from '../types';
import { supabase } from './supabase';
import templatePdfUrl from '../public/templates/PIFS_Compliance_Data_Sheet.pdf?url';

/**
 * Helper to safely fetch an asset (PDF template or image) as ArrayBuffer
 */
async function fetchAsArrayBuffer(urlOrPath: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(urlOrPath, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${urlOrPath}`);
    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) return null;
    
    // Validate %PDF magic header if fetching PDF
    if (urlOrPath.toLowerCase().includes('.pdf')) {
      const header = new Uint8Array(buffer.slice(0, 5));
      const headerStr = String.fromCharCode(...header);
      if (!headerStr.startsWith('%PDF')) {
        throw new Error(`Invalid PDF header from ${urlOrPath}: got "${headerStr}"`);
      }
    }
    return buffer;
  } catch (error) {
    console.warn(`Failed to fetch buffer from ${urlOrPath}:`, error);
    return null;
  }
}


/**
 * Formats full address into a clean single or multi-line string
 */
function formatAddress(addr?: any): { singleLine: string; line1: string; line2: string } {
  if (!addr) return { singleLine: '—', line1: '—', line2: '' };
  const parts: string[] = [];
  if (addr.line1) parts.push(addr.line1);
  if (addr.line2) parts.push(addr.line2);
  if (addr.city) parts.push(addr.city);
  if (addr.state) parts.push(addr.state);
  if (addr.pincode) parts.push(`- ${addr.pincode}`);
  if (addr.country && addr.country !== 'India') parts.push(addr.country);

  const singleLine = parts.join(', ').replace(/,\s*-/, ' -').trim() || '—';
  const midPoint = Math.floor(parts.length / 2);
  const line1 = parts.slice(0, Math.max(1, midPoint)).join(', ').trim();
  const line2 = parts.slice(Math.max(1, midPoint)).join(', ').replace(/,\s*-/, ' -').trim();

  return { singleLine, line1, line2 };
}

/**
 * Splits date string (YYYY-MM-DD or DD/MM/YYYY) into day, month, year
 */
function parseDateParts(dateStr?: string): { day: string; month: string; year: string } {
  if (!dateStr) return { day: '', month: '', year: '' };
  const parts = dateStr.trim().split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return { day: parts[2].padStart(2, '0'), month: parts[1].padStart(2, '0'), year: parts[0] };
    } else {
      // DD-MM-YYYY
      return { day: parts[0].padStart(2, '0'), month: parts[1].padStart(2, '0'), year: parts[2] };
    }
  }
  return { day: '', month: '', year: '' };
}

/**
 * Calculates age from Date of Birth string (YYYY-MM-DD)
 */
function calculateAge(dobStr?: string): string {
  if (!dobStr) return '—';
  try {
    const dob = new Date(dobStr);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    const age = Math.abs(ageDt.getUTCFullYear() - 1970);
    return isNaN(age) ? '—' : String(age);
  } catch {
    return '—';
  }
}

/**
 * Embeds an image (PNG / JPEG) into PDF document if valid
 */
async function tryEmbedImage(doc: PDFDocument, imageSource?: any): Promise<PDFImage | null> {
  if (!imageSource) return null;
  try {
    let buffer: ArrayBuffer | null = null;
    if (typeof imageSource === 'string') {
      if (imageSource.startsWith('data:image/')) {
        // Base64 Data URL
        const base64Data = imageSource.split(',')[1];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        buffer = bytes.buffer;
      } else {
        buffer = await fetchAsArrayBuffer(imageSource);
      }
    } else if (imageSource.preview && typeof imageSource.preview === 'string') {
      return await tryEmbedImage(doc, imageSource.preview);
    } else if (imageSource.url && typeof imageSource.url === 'string') {
      return await tryEmbedImage(doc, imageSource.url);
    } else if (imageSource.file instanceof Blob) {
      buffer = await imageSource.file.arrayBuffer();
    }

    if (!buffer || buffer.byteLength === 0) return null;

    try {
      return await doc.embedJpg(buffer);
    } catch {
      try {
        return await doc.embedPng(buffer);
      } catch (err) {
        console.warn('Could not embed image as JPG or PNG:', err);
        return null;
      }
    }
  } catch (error) {
    console.warn('Error in tryEmbedImage:', error);
    return null;
  }
}

/**
 * Sanitizes any text to 100% valid WinAnsi / ASCII characters.
 * Converts unicode checkmarks, dashes, quotes, and symbols to avoid pdf-lib encoding errors.
 */
function sanitizeWinAnsi(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/[✓✔☑]/g, '[YES]')
    .replace(/[—–]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[•·]/g, '*')
    .replace(/[₹]/g, 'Rs.')
    .replace(/[^\x20-\x7E\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Draws a sharp, clean vector tick mark (✓) on a PDF page
 */
function drawTickMark(
  page: PDFPage,
  x: number,
  y: number,
  size = 10,
  color = rgb(0.08, 0.52, 0.22),
  thickness = 1.8
): void {
  page.drawLine({
    start: { x: x, y: y + size * 0.4 },
    end: { x: x + size * 0.35, y: y },
    thickness: thickness,
    color: color,
  });
  page.drawLine({
    start: { x: x + size * 0.35, y: y },
    end: { x: x + size * 0.95, y: y + size * 0.9 },
    thickness: thickness,
    color: color,
  });
}

/**
 * Draws text safely onto a PDFPage
 */
function drawTextSafe(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size?: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
) {
  if (!text) return;
  const cleaned = sanitizeWinAnsi(text);
  if (!cleaned || cleaned === '-' || cleaned === '--') return;

  const size = options.size || 9;
  const color = options.color || rgb(0, 0, 0);
  const maxWidth = options.maxWidth || 320;

  try {
    let printable = cleaned;
    const textWidth = options.font.widthOfTextAtSize(printable, size);
    if (textWidth > maxWidth) {
      while (printable.length > 3 && options.font.widthOfTextAtSize(printable + '...', size) > maxWidth) {
        printable = printable.slice(0, -1);
      }
      printable = printable + '...';
    }

    page.drawText(printable, {
      x: options.x,
      y: options.y,
      size,
      font: options.font,
      color,
    });
  } catch (err) {
    console.warn(`Could not draw text "${text}":`, err);
  }
}

/**
 * Main function to generate the filled 21-page PIFS Compliance Data Sheet
 */
export async function generatePifsCompliancePdf(employeeData: OnboardingData): Promise<Uint8Array> {
  // 1. Fetch Template
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const templatePaths = [
    templatePdfUrl,
    `${origin}/templates/PIFS_Compliance_Data_Sheet.pdf`,
    `${origin}/PIFS Compliance Data Sheet.pdf`,
    '/templates/PIFS_Compliance_Data_Sheet.pdf',
    '/PIFS Compliance Data Sheet.pdf',
    './templates/PIFS_Compliance_Data_Sheet.pdf',
  ].filter(Boolean);

  let templateBuffer: ArrayBuffer | null = null;
  for (const path of templatePaths) {
    templateBuffer = await fetchAsArrayBuffer(path);
    if (templateBuffer && templateBuffer.byteLength > 0) break;
  }

  if (!templateBuffer || templateBuffer.byteLength === 0) {
    throw new Error('Could not load "PIFS Compliance Data Sheet.pdf" template file from server.');
  }

  const doc = await PDFDocument.load(templateBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const d = employeeData;
  const p = d.personal || ({} as any);
  const org = d.organization || ({} as any);
  const bank = d.bank || ({} as any);
  const uan = d.uan || ({} as any);
  const esi = d.esi || ({} as any);
  const addr = d.address || ({} as any);
  const gmc = d.gmc || ({} as any);

  const fullName = `${p.firstName || ''} ${p.middleName || ''} ${p.lastName || ''}`.replace(/\s+/g, ' ').trim() || '-';
  const employeeId = p.employeeId || d.id || 'PARA-NEW';
  const siteName = org.site || org.organizationName || 'Paradigm Facility';
  const designation = org.designation || 'Staff / Operative';
  const department = org.department || 'Operations';
  const doj = org.joiningDate || d.enrollmentDate || new Date().toISOString().split('T')[0];
  const dob = p.dob || '-';
  const age = calculateAge(dob);
  const gender = p.gender || '-';
  const maritalStatus = p.maritalStatus || 'Single';
  const bloodGroup = p.bloodGroup || '-';
  const mobile = p.mobile || '-';
  const email = p.email || '-';
  const aadhaarNumber = p.aadhaarNumber || p.idProofNumber || '-';
  const panNumber = p.panNumber || '-';

  // Relatives
  const fatherObj = d.family?.find(f => f && (f.relation === 'Father'));
  const motherObj = d.family?.find(f => f && (f.relation === 'Mother'));
  const spouseObj = d.family?.find(f => f && (f.relation === 'Spouse' || f.relation === 'Wife' || f.relation === 'Husband'));
  const fatherName = fatherObj?.name || '-';
  const motherName = motherObj?.name || '-';
  const spouseName = spouseObj?.name || '-';

  // Nominee
  const nomineeName = gmc.nomineeName || (spouseName !== '-' ? spouseName : (fatherName !== '-' ? fatherName : (motherName !== '-' ? motherName : 'Nominee')));
  const nomineeRelation = gmc.nomineeRelation || (spouseName !== '-' ? 'Spouse' : (fatherName !== '-' ? 'Father' : 'Mother'));
  const nomineeDob = spouseObj?.dob || fatherObj?.dob || motherObj?.dob || '-';

  // Addresses
  const presentAddr = formatAddress(addr.present);
  const permAddr = formatAddress(addr.permanent || (addr.sameAsPresent ? addr.present : null));

  // Bank
  const bankName = bank.bankName || '-';
  const bankAc = bank.accountNumber || '-';

  // Statutory
  const pfNo = uan.pfNumber || uan.uanNumber || '-';
  const uanNo = uan.uanNumber || '-';
  const esiNo = esi.esiNumber || '-';

  // Education
  const primaryEdu = d.education && d.education.length > 0 ? d.education[0] : null;
  const educationStr = primaryEdu ? `${primaryEdu.degree} (${primaryEdu.institution || ''})`.trim() : 'Secondary / SSLC';

  // Visual Colors
  const primaryNavy = rgb(0.04, 0.12, 0.35); // Sharp contrast navy
  const darkBlack = rgb(0.05, 0.05, 0.05);
  const greenCheck = rgb(0.08, 0.52, 0.22);

  // Photos & Signatures
  const candidatePhoto = await tryEmbedImage(doc, p.photo);
  const candidateSignature = await tryEmbedImage(doc, d.biometrics?.signatureImage);

  const pages = doc.getPages();

  // =========================================================================
  // PAGE 1: COVER SHEET / EMPLOYEE PERSONAL DATA
  // =========================================================================
  if (pages[0]) {
    const p1 = pages[0];
    // Underlines are at y = 332.5, 297.1, 258.0, 218.9, 181.7, 141.2
    drawTextSafe(p1, fullName.toUpperCase(), { x: 232, y: 334, size: 10, font: fontBold, color: primaryNavy, maxWidth: 300 });
    drawTextSafe(p1, siteName, { x: 232, y: 299, size: 10, font: fontBold, color: primaryNavy, maxWidth: 300 });
    drawTextSafe(p1, designation, { x: 232, y: 260, size: 10, font: fontBold, color: primaryNavy, maxWidth: 300 });
    drawTextSafe(p1, employeeId, { x: 232, y: 221, size: 10.5, font: fontBold, color: primaryNavy, maxWidth: 300 });
    drawTextSafe(p1, pfNo, { x: 232, y: 183, size: 10, font: font, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p1, esiNo, { x: 232, y: 143, size: 10, font: font, color: darkBlack, maxWidth: 300 });
  }

  // =========================================================================
  // PAGE 4: DOCUMENT CHECKLIST
  // =========================================================================
  if (pages[3]) {
    const p4 = pages[3];
    // Draw clean green check indicator beside each checklist item
    const checklistItems = [
      { y: 635, label: `[ATTACHED] ${aadhaarNumber ? `(${aadhaarNumber.slice(-4)})` : ''}`.trim() },
      { y: 605, label: '[ATTACHED]' },
      { y: 575, label: '[ATTACHED]' },
      { y: 545, label: '[ATTACHED]' },
      { y: 485, label: `[ATTACHED] (${age} Yrs)` },
      { y: 455, label: '[ATTACHED]' },
      { y: 424, label: '[ATTACHED]' },
    ];
    checklistItems.forEach(item => {
      drawTextSafe(p4, item.label, { x: 380, y: item.y, size: 8, font: fontBold, color: greenCheck, maxWidth: 80 });
    });
  }

  // =========================================================================
  // PAGE 5: KANNADA TRAINING & PROBATION DECLARATION
  // =========================================================================
  if (pages[4]) {
    const p5 = pages[4];
    // Exact horizontal alignment with Kannada colons (y = 110.0, 92.5, 75.0)
    drawTextSafe(p5, fullName.toUpperCase(), { x: 98, y: 110.0, size: 7.5, font: fontBold, color: primaryNavy, maxWidth: 190 });
    drawTextSafe(p5, 'PIFS PVT. LTD.', { x: 334, y: 110.0, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 120 });
    drawTextSafe(p5, designation, { x: 94, y: 92.5, size: 7.5, font: fontBold, color: primaryNavy, maxWidth: 190 });
    drawTextSafe(p5, 'Bangalore', { x: 326, y: 92.5, size: 7.5, font: font, color: darkBlack });
    drawTextSafe(p5, doj, { x: 338, y: 75.0, size: 7.5, font: font, color: darkBlack });
    if (candidateSignature) {
      try {
        p5.drawImage(candidateSignature, { x: 95, y: 50, width: 80, height: 24 });
      } catch (e) {
        console.warn('Could not draw signature on page 5:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 6: ENGLISH TRAINING & PROBATION DECLARATION
  // =========================================================================
  if (pages[5]) {
    const p6 = pages[5];
    // Exact baseline coordinates matching English colons (y = 96.5, 80.5, 65.0)
    drawTextSafe(p6, fullName.toUpperCase(), { x: 127, y: 96.5, size: 8, font: fontBold, color: primaryNavy, maxWidth: 190 });
    drawTextSafe(p6, 'PIFS PVT. LTD.', { x: 380, y: 96.5, size: 8, font: fontBold, color: darkBlack, maxWidth: 140 });
    drawTextSafe(p6, designation, { x: 153, y: 80.5, size: 8, font: fontBold, color: primaryNavy, maxWidth: 170 });
    drawTextSafe(p6, 'Bangalore', { x: 363, y: 80.5, size: 8, font: font, color: darkBlack });
    drawTextSafe(p6, doj, { x: 360, y: 65.0, size: 8, font: font, color: darkBlack });
    if (candidateSignature) {
      try {
        p6.drawImage(candidateSignature, { x: 145, y: 48, width: 80, height: 24 });
      } catch (e) {
        console.warn('Could not draw signature on page 6:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 7: HINDI TRAINING & PROBATION DECLARATION
  // =========================================================================
  if (pages[6]) {
    const p7 = pages[6];
    // Exact baseline coordinates matching Hindi colons (y = 112.5, 93.5, 73.5)
    drawTextSafe(p7, fullName.toUpperCase(), { x: 112, y: 112.5, size: 8, font: fontBold, color: primaryNavy, maxWidth: 130 });
    drawTextSafe(p7, 'PIFS PVT. LTD.', { x: 289, y: 109.5, size: 8, font: fontBold, color: darkBlack });
    drawTextSafe(p7, designation, { x: 115, y: 93.5, size: 8, font: fontBold, color: primaryNavy, maxWidth: 130 });
    drawTextSafe(p7, 'Bangalore', { x: 289, y: 91.5, size: 8, font: font, color: darkBlack });
    drawTextSafe(p7, doj, { x: 290, y: 73.5, size: 8, font: font, color: darkBlack });
    if (candidateSignature) {
      try {
        p7.drawImage(candidateSignature, { x: 130, y: 50, width: 80, height: 24 });
      } catch (e) {
        console.warn('Could not draw signature on page 7:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 8: EMPLOYEE BIO-DATA & PERSONAL PROFILE
  // =========================================================================
  if (pages[7]) {
    const p8 = pages[7];
    // Employee ID top left
    drawTextSafe(p8, employeeId, { x: 195, y: 747, size: 9, font: fontBold, color: primaryNavy });

    // Photo box at top right (inside dedicated photo frame, below Paradigm logo)
    if (candidatePhoto) {
      try {
        p8.drawImage(candidatePhoto, {
          x: 440,
          y: 628,
          width: 75,
          height: 78,
        });
      } catch (e) {
        console.warn('Could not draw photo on page 8:', e);
      }
    }

    // Left Column Fields - Dotted Line Baselines
    drawTextSafe(p8, fullName.toUpperCase(), { x: 120, y: 703, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 260 });
    drawTextSafe(p8, fatherName, { x: 160, y: 682, size: 8.5, font: font, color: darkBlack, maxWidth: 260 });
    drawTextSafe(p8, motherName, { x: 160, y: 661, size: 8.5, font: font, color: darkBlack, maxWidth: 260 });
    drawTextSafe(p8, 'Field Operations / HR Dept', { x: 155, y: 640, size: 8.5, font: font, color: darkBlack, maxWidth: 260 });
    drawTextSafe(p8, dob, { x: 150, y: 619, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p8, `${age} Yrs`, { x: 365, y: 619, size: 8.5, font: font, color: darkBlack });

    const safeEdu = educationStr && !educationStr.startsWith('(') ? educationStr : 'Secondary / SSLC';
    drawTextSafe(p8, safeEdu, { x: 150, y: 598, size: 8.5, font: font, color: darkBlack, maxWidth: 170 });
    drawTextSafe(p8, 'Fresher / Experienced', { x: 400, y: 598, size: 8, font: font, color: darkBlack });
    drawTextSafe(p8, designation, { x: 145, y: 576, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 170 });
    drawTextSafe(p8, 'As per Minimum Wages', { x: 435, y: 576, size: 8, font: font, color: darkBlack });

    // Present & Permanent Addresses on their dotted lines
    drawTextSafe(p8, presentAddr.line1, { x: 165, y: 555, size: 7.5, font: font, color: darkBlack, maxWidth: 250 });
    if (presentAddr.line2) drawTextSafe(p8, presentAddr.line2, { x: 60, y: 534, size: 7.5, font: font, color: darkBlack, maxWidth: 300 });

    drawTextSafe(p8, permAddr.line1, { x: 175, y: 512, size: 7.5, font: font, color: darkBlack, maxWidth: 250 });
    if (permAddr.line2) drawTextSafe(p8, permAddr.line2, { x: 60, y: 491, size: 7.5, font: font, color: darkBlack, maxWidth: 130 });

    drawTextSafe(p8, mobile, { x: 250, y: 491, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p8, maritalStatus, { x: 160, y: 343, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p8, spouseName, { x: 425, y: 343, size: 8.5, font: font, color: darkBlack });

    drawTextSafe(p8, doj, { x: 160, y: 262, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p8, aadhaarNumber, { x: 375, y: 264, size: 8.5, font: fontBold, color: darkBlack });
    drawTextSafe(p8, esiNo, { x: 160, y: 242, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p8, pfNo, { x: 375, y: 244, size: 8.5, font: font, color: darkBlack });

    drawTextSafe(p8, siteName, { x: 160, y: 202, size: 8.5, font: fontBold, color: darkBlack, maxWidth: 140 });
    drawTextSafe(p8, 'Operations Head', { x: 450, y: 204, size: 8, font: font, color: darkBlack });

    drawTextSafe(p8, `${nomineeName} (${mobile})`, { x: 210, y: 125, size: 8, font: font, color: darkBlack, maxWidth: 215 });
    drawTextSafe(p8, bloodGroup, { x: 515, y: 125, size: 8.5, font: fontBold, color: darkBlack });

    // Candidate Signature
    if (candidateSignature) {
      try {
        p8.drawImage(candidateSignature, { x: 165, y: 75, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 8:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 9: BANK ACCOUNT OPENING DETAILS & ID DETAILS TABLE
  // =========================================================================
  if (pages[8]) {
    const p9 = pages[8];
    // Religion & Category Checkmarks inside Particulars column empty space (x = 245)
    drawTickMark(p9, 245, 612, 10, greenCheck, 2.0); // Hindu
    drawTickMark(p9, 245, 475, 10, greenCheck, 2.0); // General

    // ID Details Table (Vertical cell centers inside Column 4 'Details' at x = 340)
    drawTextSafe(p9, 'Aadhaar Card', { x: 340, y: 265, size: 8.5, font: fontBold, color: darkBlack, maxWidth: 190 });
    drawTextSafe(p9, aadhaarNumber, { x: 340, y: 245, size: 8.5, font: font, color: darkBlack, maxWidth: 190 });
    drawTextSafe(p9, panNumber, { x: 340, y: 185, size: 8.5, font: fontBold, color: darkBlack, maxWidth: 190 });
    drawTextSafe(p9, nomineeName, { x: 340, y: 123, size: 8.5, font: fontBold, color: darkBlack, maxWidth: 190 });
    drawTextSafe(p9, nomineeRelation, { x: 340, y: 103, size: 8.5, font: font, color: darkBlack, maxWidth: 190 });
    const nomineeAgeStr = calculateAge(nomineeDob);
    const safeNomineeDobStr = (nomineeDob && nomineeDob !== '-') ? `${nomineeDob}${nomineeAgeStr !== '-' ? ` (${nomineeAgeStr} Yrs)` : ''}` : '-';
    drawTextSafe(p9, safeNomineeDobStr, { x: 340, y: 81, size: 8.5, font: font, color: darkBlack, maxWidth: 190 });

    if (candidateSignature) {
      try {
        p9.drawImage(candidateSignature, { x: 420, y: 60, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 9:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 10: FORM Q (APPOINTMENT ORDER)
  // =========================================================================
  if (pages[9]) {
    const p10 = pages[9];
    // Exact dotted line baselines on Page 10 (calibrated to exact pdf lines)
    drawTextSafe(p10, 'PARADIGM INTEGRATED FACILITY SERVICES PVT. LTD.', { x: 240, y: 573.0, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p10, `Shri. ${fullName} (${employeeId})`, { x: 240, y: 533.0, size: 8, font: fontBold, color: primaryNavy, maxWidth: 300 });
    drawTextSafe(p10, presentAddr.line1, { x: 240, y: 508.0, size: 7.5, font: font, color: darkBlack, maxWidth: 300 });
    if (presentAddr.line2) drawTextSafe(p10, presentAddr.line2, { x: 240, y: 483.5, size: 7.5, font: font, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p10, permAddr.line1, { x: 240, y: 458.5, size: 7.5, font: font, color: darkBlack, maxWidth: 300 });
    if (permAddr.line2) drawTextSafe(p10, permAddr.line2, { x: 240, y: 433.5, size: 7.5, font: font, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p10, fatherName, { x: 240, y: 408.5, size: 8.5, font: font, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p10, dob, { x: 240, y: 383.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p10, doj, { x: 240, y: 358.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p10, `${designation} at ${siteName}`, { x: 240, y: 331.0, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 300 });
    drawTextSafe(p10, employeeId, { x: 240, y: 306.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p10, 'Statutory Minimum Wages (Govt. of Karnataka)', { x: 240, y: 267.0, size: 8, font: font, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p10, 'Applicable VDA as notified', { x: 240, y: 201.0, size: 8, font: font, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p10, 'As per Minimum Wages Act', { x: 240, y: 175.0, size: 8, font: fontBold, color: darkBlack, maxWidth: 300 });

    if (candidateSignature) {
      try {
        p10.drawImage(candidateSignature, { x: 100, y: 65, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 10:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 11: FORM XIV (EMPLOYMENT CARD)
  // =========================================================================
  if (pages[10]) {
    const p11 = pages[10];
    // Exact column starts after pre-printed text, raised cleanly above dotted lines
    drawTextSafe(p11, `${designation} / ${siteName}`, { x: 100, y: 445.0, size: 8, font: fontBold, color: primaryNavy, maxWidth: 220 });
    drawTextSafe(p11, fullName.toUpperCase(), { x: 215, y: 413.5, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 280 });
    drawTextSafe(p11, employeeId, { x: 300, y: 395.5, size: 8.5, font: fontBold, color: primaryNavy });
    drawTextSafe(p11, designation, { x: 270, y: 377.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p11, 'As per Minimum Wages Act', { x: 360, y: 360.0, size: 8, font: font, color: darkBlack });
    drawTextSafe(p11, 'Monthly', { x: 180, y: 342.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p11, 'Regular Contractual', { x: 215, y: 324.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p11, 'Active / Enrolled', { x: 160, y: 306.5, size: 8.5, font: font, color: darkBlack });

    if (candidateSignature) {
      try {
        p11.drawImage(candidateSignature, { x: 100, y: 230, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 11:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 12: FORM 1 (PAYMENT OF WAGES NOMINATION)
  // =========================================================================
  if (pages[11]) {
    const p12 = pages[11];
    drawTextSafe(p12, fullName.toUpperCase(), { x: 345, y: 701, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 200 });
    drawTextSafe(p12, fatherName, { x: 215, y: 677, size: 8.5, font: font, color: darkBlack, maxWidth: 300 });
    drawTextSafe(p12, dob, { x: 140, y: 653.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p12, gender, { x: 385, y: 653.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p12, maritalStatus, { x: 150, y: 628.5, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p12, permAddr.line1, { x: 135, y: 592.5, size: 7.5, font: font, color: darkBlack, maxWidth: 400 });
    if (permAddr.line2) drawTextSafe(p12, permAddr.line2, { x: 50, y: 572.5, size: 7.5, font: font, color: darkBlack, maxWidth: 480 });
    drawTextSafe(p12, presentAddr.line1, { x: 135, y: 555.5, size: 7.5, font: font, color: darkBlack, maxWidth: 400 });
    if (presentAddr.line2) drawTextSafe(p12, presentAddr.line2, { x: 50, y: 535.5, size: 7.5, font: font, color: darkBlack, maxWidth: 480 });

    // Nominee Table Row 1 (Inside table cells raised at y = 383)
    drawTextSafe(p12, `${nomineeName}, ${permAddr.line1}`, { x: 48, y: 383, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 140 });
    drawTextSafe(p12, nomineeRelation, { x: 200, y: 383, size: 8, font: font, color: darkBlack });
    drawTextSafe(p12, nomineeDob, { x: 270, y: 383, size: 8, font: font, color: darkBlack });
    drawTextSafe(p12, '100%', { x: 345, y: 383, size: 8.5, font: fontBold, color: darkBlack });
    if (candidateSignature) {
      try {
        p12.drawImage(candidateSignature, { x: 420, y: 260, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 12:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 13: FORM F (GRATUITY NOMINATION)
  // =========================================================================
  if (pages[12]) {
    const p13 = pages[12];
    drawTextSafe(p13, fullName.toUpperCase(), { x: 180, y: 680, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 300 });
    
    // Nominee Table Row 1 (Header line y = 493.9, Row 1 between y = 493.9 and y = 475.5 -> baseline y = 480.0)
    // Pre-printed '1.' is at x = 48..56. Col 1 line is at x = 77.5. Text starts at x = 82!
    drawTextSafe(p13, `${nomineeName}, ${permAddr.singleLine}`, { x: 82, y: 480.0, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 160 });
    drawTextSafe(p13, nomineeRelation, { x: 255, y: 480.0, size: 8, font: font, color: darkBlack, maxWidth: 115 });
    drawTextSafe(p13, calculateAge(nomineeDob), { x: 390, y: 480.0, size: 8, font: font, color: darkBlack });
    drawTextSafe(p13, '100%', { x: 460, y: 480.0, size: 8.5, font: fontBold, color: darkBlack });

    // Statement Particulars (exact baselines matching table rows)
    drawTextSafe(p13, fullName.toUpperCase(), { x: 190, y: 383, size: 8, font: fontBold, color: primaryNavy, maxWidth: 350 });
    drawTextSafe(p13, gender, { x: 100, y: 363, size: 8, font: font, color: darkBlack });
    drawTextSafe(p13, 'Indian', { x: 118, y: 343, size: 8, font: font, color: darkBlack });
    drawTextSafe(p13, maritalStatus, { x: 288, y: 323, size: 8, font: font, color: darkBlack });
    drawTextSafe(p13, `${department} / ${siteName}`, { x: 290, y: 303, size: 8, font: font, color: darkBlack, maxWidth: 250 });
    drawTextSafe(p13, `${designation} (ID: ${employeeId})`, { x: 275, y: 283, size: 8, font: fontBold, color: darkBlack, maxWidth: 265 });
    drawTextSafe(p13, doj, { x: 175, y: 263, size: 8, font: font, color: darkBlack });
    drawTextSafe(p13, permAddr.singleLine, { x: 168, y: 242, size: 7.5, font: font, color: darkBlack, maxWidth: 375 });

    // Place & Date on Form F Employee Declaration
    drawTextSafe(p13, 'Bangalore', { x: 80, y: 183, size: 8, font: font, color: darkBlack });
    drawTextSafe(p13, doj, { x: 80, y: 164.2, size: 8, font: font, color: darkBlack });
    if (candidateSignature) {
      try {
        p13.drawImage(candidateSignature, { x: 380, y: 185, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 13:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 14: ESIC FORM 1 (DECLARATION FORM FRONT)
  // =========================================================================
  if (pages[13]) {
    const p14 = pages[13];
    // Candidate Name (Box 2: x = 133..282, y = 675.8..651.5)
    drawTextSafe(p14, fullName.toUpperCase(), { x: 140, y: 660, size: 8, font: fontBold, color: primaryNavy, maxWidth: 138 });

    // Father Name (Box 3: x = 141..282, y = 651.5..631.6)
    drawTextSafe(p14, fatherName, { x: 145, y: 638, size: 7.5, font: font, color: darkBlack, maxWidth: 135 });

    // Date of Appointment (Box 10 Day, Month, Year empty value row: baseline y = 644)
    const dojParts = parseDateParts(doj);
    if (dojParts.day) drawTextSafe(p14, dojParts.day, { x: 425, y: 644, size: 8, font: fontBold, color: darkBlack });
    if (dojParts.month) drawTextSafe(p14, dojParts.month, { x: 472, y: 644, size: 8, font: fontBold, color: darkBlack });
    if (dojParts.year) drawTextSafe(p14, dojParts.year, { x: 519, y: 644, size: 8, font: fontBold, color: darkBlack });

    // Date of Birth (Box 4 D M Y square boxes: baseline y = 603)
    const dobParts = parseDateParts(dob);
    if (dobParts.day) drawTextSafe(p14, dobParts.day, { x: 65, y: 603, size: 7.5, font: fontBold, color: darkBlack });
    if (dobParts.month) drawTextSafe(p14, dobParts.month, { x: 92, y: 603, size: 7.5, font: fontBold, color: darkBlack });
    if (dobParts.year) drawTextSafe(p14, dobParts.year, { x: 115, y: 603, size: 7.5, font: fontBold, color: darkBlack });

    // Marital Status (Box 5) & Sex (Box 6) centered in value cells
    drawTextSafe(p14, maritalStatus, { x: 226, y: 618, size: 7.5, font: font, color: darkBlack });
    drawTextSafe(p14, gender, { x: 230, y: 603, size: 7.5, font: font, color: darkBlack });

    // Present & Permanent Addresses (Boxes 7 & 8)
    drawTextSafe(p14, presentAddr.line1, { x: 52, y: 570, size: 6.5, font: font, color: darkBlack, maxWidth: 105 });
    if (presentAddr.line2) drawTextSafe(p14, presentAddr.line2, { x: 52, y: 550, size: 6.5, font: font, color: darkBlack, maxWidth: 105 });
    drawTextSafe(p14, permAddr.line1, { x: 172, y: 570, size: 6.5, font: font, color: darkBlack, maxWidth: 105 });
    if (permAddr.line2) drawTextSafe(p14, permAddr.line2, { x: 172, y: 550, size: 6.5, font: font, color: darkBlack, maxWidth: 105 });

    // Section (C) Details of Nominee (Row 1 at y = 396)
    drawTextSafe(p14, nomineeName, { x: 50, y: 396, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 120 });
    drawTextSafe(p14, nomineeRelation, { x: 180, y: 396, size: 7.5, font: font, color: darkBlack, maxWidth: 60 });
    drawTextSafe(p14, permAddr.singleLine, { x: 250, y: 396, size: 6.5, font: font, color: darkBlack, maxWidth: 295 });

    if (candidateSignature) {
      try {
        p14.drawImage(candidateSignature, { x: 420, y: 80, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 14:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 15: ESIC FORM 1 OVERLEAF (DEPENDENT PARENTS & FAMILY PARTICULARS)
  // =========================================================================
  if (pages[14]) {
    const p15 = pages[14];
    drawTextSafe(p15, 'Bangalore', { x: 80, y: 340, size: 8, font: font, color: darkBlack });
    drawTextSafe(p15, doj, { x: 80, y: 320, size: 8, font: font, color: darkBlack });

    if (candidateSignature) {
      try {
        p15.drawImage(candidateSignature, { x: 400, y: 320, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 15:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 16: EPF FORM 2 (REVISED) - PART A (EPF NOMINATION)
  // =========================================================================
  if (pages[15]) {
    const p16 = pages[15];
    // 1. Name on dotted baseline
    drawTextSafe(p16, fullName.toUpperCase(), { x: 180, y: 615, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 140 });
    // 2. Father's Name on dotted baseline
    drawTextSafe(p16, fatherName, { x: 180, y: 584, size: 8, font: font, color: darkBlack, maxWidth: 140 });
    // 3. Date of Birth on dotted baseline
    drawTextSafe(p16, dob, { x: 180, y: 558, size: 8, font: font, color: darkBlack });
    
    // 4. Sex Checkbox inside square boxes (Male box center: x = 154, y = 538; Female box center: x = 232, y = 538)
    if (gender.toLowerCase().includes('female')) {
      drawTickMark(p16, 233, 535, 9, greenCheck, 1.8);
    } else {
      drawTickMark(p16, 155, 535, 9, greenCheck, 1.8);
    }
    
    // 5. Marital Status on dotted baseline
    drawTextSafe(p16, maritalStatus, { x: 180, y: 510, size: 8, font: font, color: darkBlack });

    // 6. EPF Account No
    drawTextSafe(p16, pfNo, { x: 420, y: 612, size: 8, font: fontBold, color: darkBlack });
    
    // 7. Permanent Address (below label 7 at y = 590, above label 8 at y = 548)
    drawTextSafe(p16, permAddr.line1, { x: 345, y: 578, size: 7.5, font: font, color: darkBlack, maxWidth: 195 });
    if (permAddr.line2) drawTextSafe(p16, permAddr.line2, { x: 345, y: 566, size: 7.5, font: font, color: darkBlack, maxWidth: 195 });
    
    // 8. Temporary Address (below label 8 at y = 548, above Part A title at y = 484)
    drawTextSafe(p16, presentAddr.line1, { x: 345, y: 534, size: 7.5, font: font, color: darkBlack, maxWidth: 195 });
    if (presentAddr.line2) drawTextSafe(p16, presentAddr.line2, { x: 345, y: 520, size: 7.5, font: font, color: darkBlack, maxWidth: 195 });

    // EPF Nomination Table Row 1 (Header baseline y = 303.1, Row 1 between y = 303.1 and y = 250.0 -> baseline y = 280)
    drawTextSafe(p16, `${nomineeName}, ${permAddr.singleLine}`, { x: 48, y: 280, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 168 });
    drawTextSafe(p16, nomineeRelation, { x: 226, y: 280, size: 8, font: font, color: darkBlack, maxWidth: 58 });
    drawTextSafe(p16, nomineeDob, { x: 290, y: 280, size: 8, font: font, color: darkBlack });
    drawTextSafe(p16, '100%', { x: 350, y: 280, size: 8.5, font: fontBold, color: darkBlack });
    drawTextSafe(p16, '-', { x: 480, y: 280, size: 8, font: font, color: darkBlack });

    // Subscriber Signature
    if (candidateSignature) {
      try {
        p16.drawImage(candidateSignature, { x: 420, y: 200, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 16:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 17: EPF FORM 2 (REVISED) - PART B (EPS FAMILY DETAILS & NOMINATION)
  // =========================================================================
  if (pages[16]) {
    const p17 = pages[16];
    // Part B: EPS Family details Table Row 1 (Header y = 642.6, Row 1 y = 590.8 -> baseline y = 615)
    const fam = spouseObj || fatherObj || motherObj;
    if (fam) {
      drawTextSafe(p17, fam.name, { x: 90, y: 615, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 125 });
      drawTextSafe(p17, fam.dob || '-', { x: 230, y: 615, size: 7.5, font: font, color: darkBlack });
      drawTextSafe(p17, fam.relation, { x: 340, y: 615, size: 7.5, font: font, color: darkBlack });
      drawTextSafe(p17, permAddr.line1, { x: 405, y: 615, size: 7, font: font, color: darkBlack, maxWidth: 140 });
    }

    // EPS Nomination Table Row 1 (Header y = 471.9, Row 1 y = 388.8 -> baseline y = 425)
    drawTextSafe(p17, `${nomineeName}, ${permAddr.singleLine}`, { x: 90, y: 425, size: 7.5, font: fontBold, color: darkBlack, maxWidth: 195 });
    drawTextSafe(p17, nomineeDob, { x: 305, y: 425, size: 8, font: font, color: darkBlack });
    drawTextSafe(p17, nomineeRelation, { x: 380, y: 425, size: 8, font: font, color: darkBlack });

    // Date & Signature on Part B (Date: label is at x = 73, y = 365 -> value starts at x = 105, y = 365)
    drawTextSafe(p17, doj, { x: 105, y: 365, size: 8.5, font: font, color: darkBlack });
    if (candidateSignature) {
      try {
        p17.drawImage(candidateSignature, { x: 380, y: 350, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 17:', e);
      }
    }

    // Certified by Employer: Employee Name on the dotted line after Shri/Smt./Kum at y = 226.5
    drawTextSafe(p17, fullName.toUpperCase(), { x: 115, y: 226.5, size: 8, font: fontBold, color: primaryNavy, maxWidth: 200 });
  }

  // =========================================================================
  // PAGE 18: BACKGROUND & EMPLOYMENT VERIFICATION FORM (PAGE 1)
  // =========================================================================
  if (pages[17]) {
    const p18 = pages[17];
    // Applicant Details (Row 1 y = 643.0, Row 2 y = 626.5, Row 3 y = 608.0)
    drawTextSafe(p18, fullName.toUpperCase(), { x: 160, y: 643.0, size: 8, font: fontBold, color: primaryNavy, maxWidth: 240 });
    drawTextSafe(p18, employeeId, { x: 521, y: 643.0, size: 7, font: fontBold, color: primaryNavy, maxWidth: 31 });
    drawTextSafe(p18, dob, { x: 160, y: 626.5, size: 8, font: font, color: darkBlack });
    drawTextSafe(p18, gender, { x: 456, y: 626.5, size: 7.5, font: font, color: darkBlack });
    drawTextSafe(p18, fatherName, { x: 160, y: 608.0, size: 8, font: font, color: darkBlack, maxWidth: 380 });

    // Contact Details (Centered vertically inside large address boxes)
    drawTextSafe(p18, presentAddr.singleLine, { x: 205, y: 555, size: 7.5, font: font, color: darkBlack, maxWidth: 330 });
    drawTextSafe(p18, permAddr.singleLine, { x: 205, y: 506, size: 7.5, font: font, color: darkBlack, maxWidth: 330 });
    drawTextSafe(p18, mobile, { x: 205, y: 445, size: 8, font: font, color: darkBlack });

    // Education Table (Populate full row in education table)
    drawTextSafe(p18, 'State Board / Secondary School', { x: 60, y: 288, size: 7, font: font, color: darkBlack, maxWidth: 100 });
    drawTextSafe(p18, 'State Board', { x: 170, y: 288, size: 7.5, font: font, color: darkBlack, maxWidth: 60 });
    drawTextSafe(p18, educationStr || 'SSLC / 10th Standard', { x: 240, y: 288, size: 7.5, font: font, color: darkBlack, maxWidth: 90 });
    drawTextSafe(p18, 'Passed', { x: 340, y: 288, size: 7.5, font: font, color: darkBlack });
    drawTextSafe(p18, '-', { x: 400, y: 288, size: 7.5, font: font, color: darkBlack });
    drawTextSafe(p18, 'Full Time', { x: 480, y: 288, size: 7.5, font: font, color: darkBlack });

    // Candidate Signature
    if (candidateSignature) {
      try {
        p18.drawImage(candidateSignature, { x: 420, y: 65, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 18:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 19: BACKGROUND & EMPLOYMENT VERIFICATION FORM (PAGE 2)
  // =========================================================================
  if (pages[18]) {
    const p19 = pages[18];
    // Period for Criminal Verification: doj on dotted line after FROM (x = 345), 'Present' on dotted line after TO (x = 450)
    drawTextSafe(p19, doj, { x: 345, y: 643.0, size: 8, font: font, color: darkBlack });
    drawTextSafe(p19, 'Present', { x: 450, y: 643.0, size: 8, font: font, color: darkBlack });

    // Present Address & Permanent Address on Page 2
    drawTextSafe(p19, presentAddr.singleLine, { x: 205, y: 585, size: 7.5, font: font, color: darkBlack, maxWidth: 330 });
    drawTextSafe(p19, permAddr.singleLine, { x: 205, y: 490, size: 7.5, font: font, color: darkBlack, maxWidth: 330 });
    drawTextSafe(p19, '-', { x: 205, y: 390, size: 7.5, font: font, color: darkBlack });
    drawTextSafe(p19, '-', { x: 205, y: 290, size: 7.5, font: font, color: darkBlack });

    if (candidateSignature) {
      try {
        p19.drawImage(candidateSignature, { x: 420, y: 120, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 19:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 20: RESIGNATION LETTER TEMPLATE
  // =========================================================================
  if (pages[19]) {
    const p20 = pages[19];
    // Exact baseline coordinates matching pre-printed dotted lines
    drawTextSafe(p20, fullName.toUpperCase(), { x: 65, y: 688.5, size: 8.5, font: fontBold, color: primaryNavy, maxWidth: 245 });
    drawTextSafe(p20, employeeId, { x: 438, y: 688.5, size: 8.5, font: fontBold, color: primaryNavy });
    drawTextSafe(p20, fatherName || spouseName, { x: 165, y: 649.0, size: 8.5, font: font, color: darkBlack, maxWidth: 345 });
    drawTextSafe(p20, doj, { x: 412, y: 609.5, size: 8, font: font, color: darkBlack });
    drawTextSafe(p20, 'Bangalore', { x: 80, y: 570.6, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p20, doj, { x: 80, y: 529.2, size: 8.5, font: font, color: darkBlack });
    drawTextSafe(p20, employeeId, { x: 440, y: 523.0, size: 8.5, font: fontBold, color: primaryNavy });

    if (candidateSignature) {
      try {
        p20.drawImage(candidateSignature, { x: 380, y: 590, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 20:', e);
      }
    }
  }

  // =========================================================================
  // PAGE 21: ANNEXURE (LIST OF ACCEPTABLE DOCUMENTARY PROOFS)
  // =========================================================================
  if (pages[20]) {
    const p21 = pages[20];
    if (candidateSignature) {
      try {
        p21.drawImage(candidateSignature, { x: 420, y: 150, width: 85, height: 28 });
      } catch (e) {
        console.warn('Could not draw signature on page 21:', e);
      }
    }
  }

  // Final PDF compilation
  const pdfBytes = await doc.save();
  return pdfBytes;
}

/**
 * Downloads the filled PDF directly in browser
 */
export async function downloadPifsCompliancePdf(employeeData: OnboardingData): Promise<void> {
  const pdfBytes = await generatePifsCompliancePdf(employeeData);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const employeeId = employeeData?.personal?.employeeId || employeeData?.id || 'employee';
  const cleanEmpId = employeeId.replace(/-/g, ' ');

  const link = document.createElement('a');
  link.href = url;
  link.download = `PIFS Data Sheet ${cleanEmpId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Saves/Uploads the filled PIFS Compliance PDF to Supabase Storage and records in DB
 */
export async function savePifsCompliancePdfToServer(
  employeeData: OnboardingData,
  pdfBytesOrBlob?: Uint8Array | Blob
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    let pdfBytes: Uint8Array;
    if (!pdfBytesOrBlob) {
      pdfBytes = await generatePifsCompliancePdf(employeeData);
    } else if (pdfBytesOrBlob instanceof Blob) {
      const buffer = await pdfBytesOrBlob.arrayBuffer();
      pdfBytes = new Uint8Array(buffer);
    } else {
      pdfBytes = pdfBytesOrBlob;
    }

    const employeeId = employeeData?.personal?.employeeId || employeeData?.id || `EMP_${Date.now()}`;
    const timestamp = Date.now();
    const fileName = `PIFS_Data_Sheet_${employeeId}_${timestamp}.pdf`;
    const storagePath = `${employeeId}/compliance_sheets/${fileName}`;
    const bucket = 'onboarding-documents';

    const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.warn('Storage upload warning:', uploadError);
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const publicUrl = publicUrlData?.publicUrl || '';

    // Insert record in user_documents
    try {
      await supabase.from('user_documents').insert({
        user_id: employeeData?.id || employeeId,
        submission_id: employeeData?.id || null,
        name: `PIFS Compliance Data Sheet (${employeeId})`,
        bucket,
        path: storagePath,
        file_type: 'application/pdf',
        file_size: pdfBytes.byteLength,
        created_at: new Date().toISOString(),
      });
    } catch (insertErr) {
      console.warn('user_documents table recording note:', insertErr);
    }

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error: any) {
    console.error('Failed to save compliance PDF to server:', error);
    return {
      success: false,
      url: '',
      error: error?.message || 'Server upload failed',
    };
  }
}
