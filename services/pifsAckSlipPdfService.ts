import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import type { OnboardingData } from '../types';
import { getProxyUrl } from '../utils/fileUrl';
import { formatDisplayDate } from '../utils/date';

// Color Palette
const darkNavy = rgb(0.06, 0.09, 0.16);
const primaryGreen = rgb(0.08, 0.52, 0.22);
const darkGreen = rgb(0.05, 0.38, 0.15);
const lightGreenBg = rgb(0.93, 0.98, 0.95);
const lightGrayBg = rgb(0.96, 0.97, 0.98);
const borderGray = rgb(0.82, 0.85, 0.89);
const textDark = rgb(0.12, 0.15, 0.18);
const textMuted = rgb(0.42, 0.46, 0.52);

/**
 * Strips/converts non-ASCII Unicode characters to WinAnsi-safe ASCII characters
 */
function cleanText(str: string | undefined | null): string {
  if (!str) return '-';
  return String(str)
    .replace(/₹/g, 'Rs. ')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/•/g, '|')
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/‘/g, "'")
    .replace(/’/g, "'")
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const fetchUrl = url.startsWith('data:') ? url : getProxyUrl(url);
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return new Uint8Array(arrayBuf);
  } catch (e) {
    console.warn('Could not fetch image for Ack Slip PDF:', url, e);
    return null;
  }
}

async function embedSafeImage(pdfDoc: PDFDocument, url: string | undefined | null) {
  if (!url) return null;
  const bytes = await fetchImageBytes(url);
  if (!bytes) return null;
  try {
    return await pdfDoc.embedJpg(bytes);
  } catch {
    try {
      return await pdfDoc.embedPng(bytes);
    } catch (e) {
      console.warn('Could not embed document image in Ack Slip PDF:', e);
      return null;
    }
  }
}

function drawSectionHeader(page: PDFPage, title: string, y: number, font: PDFFont): number {
  const headerHeight = 18;
  // Background pill
  page.drawRectangle({
    x: 35,
    y: y - headerHeight,
    width: 525,
    height: headerHeight,
    color: lightGreenBg,
    borderColor: borderGray,
    borderWidth: 0.5,
  });
  // Section Title vertically centered inside the pill
  page.drawText(cleanText(title), {
    x: 45,
    y: y - 12,
    size: 8.5,
    font: font,
    color: darkGreen,
  });
  // Return the baseline below the header with 8pt clean spacing for the first content row
  return y - headerHeight - 8;
}

import { isSouthWallEmployee } from './pifsCompliancePdfService';
import { SOUTHWALL_LOGO_BASE64 } from '../utils/reportLogos';

/**
 * Generates an Acknowledgement Slip / Onboarding Dossier PDF for an employee
 */
export async function generateOnboardingAckSlipPdf(data: OnboardingData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 (595.28 x 841.89 pt)
  const { width, height } = page.getSize();

  const d = data;
  const isSouthWall = isSouthWallEmployee(d);
  const rawEmpId = d.personal?.employeeId || d.id || (isSouthWall ? 'SW-1' : 'PARA-XXXX');
  const employeeId = isSouthWall
    ? (rawEmpId.startsWith('SW-') || rawEmpId.startsWith('SW_')
        ? rawEmpId.replace(/^SW_/, 'SW-')
        : (rawEmpId.startsWith('PARA-')
            ? `SW-${rawEmpId.substring(5)}`
            : `SW-${rawEmpId.replace(/^[A-Za-z]+-?/, '') || '1'}`))
    : rawEmpId;

  const fullName = `${d.personal?.firstName || ''} ${d.personal?.middleName || ''} ${d.personal?.lastName || ''}`.replace(/\s+/g, ' ').trim() || '-';
  const cleanEmpId = employeeId.replace(/-/g, ' ');
  const dateStr = d.enrollmentDate || d.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];

  // Primary Theme Colors (Deep SouthWall Navy vs Paradigm Forest Green)
  const brandPrimary = isSouthWall ? rgb(0.06, 0.16, 0.26) : primaryGreen;
  const brandDark = isSouthWall ? rgb(0.04, 0.12, 0.20) : darkGreen;
  const brandLightBg = isSouthWall ? rgb(0.94, 0.96, 0.98) : lightGreenBg;

  // Embed SouthWall Logo if applicable
  let southWallLogoImage = null;
  if (isSouthWall) {
    try {
      const cleanBase64 = SOUTHWALL_LOGO_BASE64.replace(/^data:image\/[a-z]+;base64,/, '');
      const binaryStr = typeof atob !== 'undefined'
        ? atob(cleanBase64)
        : Buffer.from(cleanBase64, 'base64').toString('binary');
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      southWallLogoImage = await pdfDoc.embedJpg(bytes.buffer);
    } catch (e) {
      console.warn('Could not embed SouthWall logo in ack slip:', e);
    }
  }

  // ==========================================
  // 1. HEADER SECTION
  // ==========================================
  // Top branding bar
  page.drawRectangle({
    x: 0,
    y: height - 6,
    width: width,
    height: 6,
    color: brandPrimary,
  });

  // Company Name, Logo & Subtitle
  if (isSouthWall && southWallLogoImage) {
    page.drawImage(southWallLogoImage, {
      x: 35,
      y: height - 54,
      width: 70,
      height: 24,
    });
    page.drawText('SOUTHWALL SECURITY LLP', {
      x: 115,
      y: height - 35,
      size: 13,
      font: fontBold,
      color: brandPrimary,
    });
    page.drawText('EMPLOYEE ONBOARDING DOSSIER & ACKNOWLEDGEMENT SLIP', {
      x: 115,
      y: height - 46,
      size: 7,
      font: fontBold,
      color: textMuted,
    });
    page.drawText('198, 2nd Floor, CMH Road, Indiranagar, Bangalore - 560 038.', {
      x: 115,
      y: height - 56,
      size: 6.5,
      font: fontRegular,
      color: textMuted,
    });
  } else {
    page.drawText(isSouthWall ? 'SOUTHWALL SECURITY LLP' : 'PARADIGM INTEGRATED SERVICES', {
      x: 35,
      y: height - 36,
      size: 15,
      font: fontBold,
      color: isSouthWall ? brandPrimary : darkNavy,
    });
    page.drawText('EMPLOYEE ONBOARDING DOSSIER & ACKNOWLEDGEMENT SLIP', {
      x: 35,
      y: height - 48,
      size: 7.5,
      font: fontBold,
      color: textMuted,
    });
    if (isSouthWall) {
      page.drawText('198, 2nd Floor, CMH Road, Indiranagar, Bangalore - 560 038.', {
        x: 35,
        y: height - 58,
        size: 6.5,
        font: fontRegular,
        color: textMuted,
      });
    }
  }

  // ID Badge & Date on Right
  page.drawRectangle({
    x: width - 170,
    y: height - 44,
    width: 135,
    height: 22,
    color: brandLightBg,
    borderColor: brandPrimary,
    borderWidth: 1,
  });
  page.drawText(cleanText(`ID: ${employeeId}`), {
    x: width - 160,
    y: height - 34,
    size: 9.5,
    font: fontBold,
    color: brandDark,
  });
  page.drawText(cleanText(`Date: ${dateStr}`), {
    x: width - 160,
    y: height - 56,
    size: 7.5,
    font: fontRegular,
    color: textMuted,
  });

  // Divider line
  page.drawLine({
    start: { x: 35, y: height - 62 },
    end: { x: width - 35, y: height - 62 },
    thickness: 1.5,
    color: isSouthWall ? brandPrimary : primaryGreen,
  });

  // ==========================================
  // 2. CANDIDATE PROFILE SUMMARY CARD
  // ==========================================
  let curY = height - 70;
  const cardHeight = 72;
  page.drawRectangle({
    x: 35,
    y: curY - cardHeight,
    width: 525,
    height: cardHeight,
    color: lightGrayBg,
    borderColor: borderGray,
    borderWidth: 0.75,
  });

  // Candidate Photo (if available)
  const photoUrl = d.personal?.photo?.preview || (d.personal?.photo as any)?.url || '';
  let photoDrawn = false;
  if (photoUrl) {
    const photoBytes = await fetchImageBytes(photoUrl);
    if (photoBytes) {
      try {
        const img = photoUrl.toLowerCase().includes('.png') 
          ? await pdfDoc.embedPng(photoBytes) 
          : await pdfDoc.embedJpg(photoBytes);
        page.drawImage(img, {
          x: 45,
          y: curY - cardHeight + 8,
          width: 48,
          height: 56,
        });
        photoDrawn = true;
      } catch (e) {
        console.warn('Could not embed photo in Ack Slip:', e);
      }
    }
  }

  if (!photoDrawn) {
    page.drawRectangle({
      x: 45,
      y: curY - cardHeight + 8,
      width: 48,
      height: 56,
      color: rgb(0.9, 0.92, 0.94),
      borderColor: borderGray,
      borderWidth: 0.5,
    });
    page.drawText('PHOTO', {
      x: 54,
      y: curY - cardHeight + 32,
      size: 7,
      font: fontBold,
      color: textMuted,
    });
  }

  // Profile fields inside summary card (3-column layout)
  const infoX1 = 110;
  const infoX2 = 295;
  const infoX3 = 445;

  const rawJoiningDate = d.organization?.joiningDate || (d as any)?.joining_date || (d as any)?.joiningDate || d.enrollmentDate;
  const dojFormatted = rawJoiningDate ? formatDisplayDate(rawJoiningDate) : formatDisplayDate(dateStr);

  const cleanName = cleanText(fullName.toUpperCase());
  const cleanSite = cleanText(d.organization?.organizationName || '-');
  const cleanDesig = cleanText(d.organization?.designation || '-');
  const cleanDept = cleanText(d.organization?.department || 'Operations');
  const cleanDoj = cleanText(dojFormatted);
  const cleanWorkType = cleanText(d.organization?.workType || 'Full-time');

  // Column 1: Employee Name & Site
  page.drawText('EMPLOYEE FULL NAME', { x: infoX1, y: curY - 18, size: 6.5, font: fontBold, color: textMuted });
  page.drawText(cleanName.length > 26 ? cleanName.substring(0, 24) + '...' : cleanName, { x: infoX1, y: curY - 30, size: 9.5, font: fontBold, color: darkNavy });

  page.drawText('ALLOCATED SITE / CLIENT', { x: infoX1, y: curY - 46, size: 6.5, font: fontBold, color: textMuted });
  page.drawText(cleanSite.length > 28 ? cleanSite.substring(0, 26) + '...' : cleanSite, { x: infoX1, y: curY - 58, size: 8, font: fontBold, color: textDark });

  // Column 2: Designation & Department
  page.drawText('DESIGNATION', { x: infoX2, y: curY - 18, size: 6.5, font: fontBold, color: textMuted });
  page.drawText(cleanDesig.length > 22 ? cleanDesig.substring(0, 20) + '...' : cleanDesig, { x: infoX2, y: curY - 30, size: 8.5, font: fontBold, color: isSouthWall ? brandPrimary : primaryGreen });

  page.drawText('DEPARTMENT', { x: infoX2, y: curY - 46, size: 6.5, font: fontBold, color: textMuted });
  page.drawText(cleanDept.length > 22 ? cleanDept.substring(0, 20) + '...' : cleanDept, { x: infoX2, y: curY - 58, size: 8, font: fontBold, color: textDark });

  // Column 3: Date of Joining & Work Type
  page.drawText('DATE OF JOINING', { x: infoX3, y: curY - 18, size: 6.5, font: fontBold, color: textMuted });
  page.drawText(cleanDoj, { x: infoX3, y: curY - 30, size: 9, font: fontBold, color: isSouthWall ? brandDark : darkGreen });

  page.drawText('WORK TYPE', { x: infoX3, y: curY - 46, size: 6.5, font: fontBold, color: textMuted });
  page.drawText(cleanWorkType.length > 18 ? cleanWorkType.substring(0, 16) + '...' : cleanWorkType, { x: infoX3, y: curY - 58, size: 8, font: fontBold, color: textDark });

  curY -= cardHeight + 12;

  // ==========================================
  // 3. SECTION 1: PERSONAL PARTICULARS & IDENTITY
  // ==========================================
  curY = drawSectionHeader(page, '1. PERSONAL PARTICULARS & IDENTITY', curY, fontBold);

  const fatherName = d.family?.find(f => f.relation?.toLowerCase() === 'father')?.name || '-';
  const motherName = d.family?.find(f => f.relation?.toLowerCase() === 'mother')?.name || '-';
  const spouseName = d.family?.find(f => f.relation?.toLowerCase() === 'spouse')?.name || '-';

  const col1 = 45;
  const col2 = 215;
  const col3 = 385;

  // Row 1
  page.drawText(`Father's Name: `, { x: col1, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(fatherName), { x: col1 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  page.drawText(`Mother's Name: `, { x: col2, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(motherName), { x: col2 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  page.drawText(`Spouse's Name: `, { x: col3, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(spouseName), { x: col3 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  curY -= 14;

  // Row 2
  page.drawText(`Date of Birth: `, { x: col1, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.personal?.dob || '-'), { x: col1 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  page.drawText(`Gender: `, { x: col2, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.personal?.gender || '-'), { x: col2 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  page.drawText(`Blood Group: `, { x: col3, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.personal?.bloodGroup || '-'), { x: col3 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  curY -= 14;

  // Row 3
  page.drawText(`Marital Status: `, { x: col1, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.personal?.maritalStatus || '-'), { x: col1 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  page.drawText(`Aadhaar Number: `, { x: col2, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.personal?.aadhaarNumber || d.personal?.idProofNumber || '-'), { x: col2 + 68, y: curY, size: 7.5, font: fontBold, color: textDark });

  page.drawText(`PAN Number: `, { x: col3, y: curY, size: 7.5, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.personal?.panNumber || '-'), { x: col3 + 65, y: curY, size: 7.5, font: fontBold, color: textDark });

  curY -= 16;

  // ==========================================
  // 4. SECTION 2: RESIDENTIAL & COMMUNICATION ADDRESSES
  // ==========================================
  curY = drawSectionHeader(page, '2. RESIDENTIAL & COMMUNICATION ADDRESSES', curY, fontBold);

  const presentStr = d.address?.present ? `${d.address.present.line1 || ''}, ${d.address.present.city || ''}, ${d.address.present.state || ''} - ${d.address.present.pincode || ''}` : '-';
  const permStr = d.address?.sameAsPresent ? presentStr : (d.address?.permanent ? `${d.address.permanent.line1 || ''}, ${d.address.permanent.city || ''}, ${d.address.permanent.state || ''} - ${d.address.permanent.pincode || ''}` : '-');

  const addrBoxHeight = 42;
  // Present Address box
  page.drawRectangle({
    x: 35,
    y: curY - addrBoxHeight,
    width: 255,
    height: addrBoxHeight,
    color: lightGrayBg,
    borderColor: borderGray,
    borderWidth: 0.5,
  });
  page.drawText('PRESENT ADDRESS', { x: 42, y: curY - 11, size: 6.5, font: fontBold, color: textMuted });
  const cleanPres = cleanText(presentStr);
  page.drawText(cleanPres.length > 55 ? cleanPres.substring(0, 52) + '...' : cleanPres, { x: 42, y: curY - 22, size: 7, font: fontRegular, color: textDark });
  page.drawText(cleanText(`Phone: ${d.personal?.mobile || '-'}`), { x: 42, y: curY - 34, size: 6.5, font: fontBold, color: primaryGreen });

  // Permanent Address box
  page.drawRectangle({
    x: 305,
    y: curY - addrBoxHeight,
    width: 255,
    height: addrBoxHeight,
    color: lightGrayBg,
    borderColor: borderGray,
    borderWidth: 0.5,
  });
  page.drawText('PERMANENT ADDRESS', { x: 312, y: curY - 11, size: 6.5, font: fontBold, color: textMuted });
  const cleanPerm = cleanText(permStr);
  page.drawText(cleanPerm.length > 55 ? cleanPerm.substring(0, 52) + '...' : cleanPerm, { x: 312, y: curY - 22, size: 7, font: fontRegular, color: textDark });
  const emerg = d.personal?.emergencyContactName ? `${d.personal.emergencyContactName} (${d.personal.emergencyContactNumber || ''})` : '-';
  page.drawText(cleanText(`Emergency: ${emerg}`), { x: 312, y: curY - 34, size: 6.5, font: fontBold, color: rgb(0.7, 0.2, 0.2) });

  curY -= addrBoxHeight + 12;

  // ==========================================
  // 5. SECTION 3: STATUTORY COMPLIANCE & SALARY
  // ==========================================
  curY = drawSectionHeader(page, '3. STATUTORY COMPLIANCE (EPFO & ESIC)', curY, fontBold);

  const statCol1 = 45;
  const statCol2 = 180;
  const statCol3 = 315;
  const statCol4 = 445;

  page.drawText('UAN Number:', { x: statCol1, y: curY, size: 7, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.uan?.uanNumber || '-'), { x: statCol1, y: curY - 11, size: 8, font: fontBold, color: textDark });

  page.drawText('PF Member ID:', { x: statCol2, y: curY, size: 7, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.uan?.pfNumber || '-'), { x: statCol2, y: curY - 11, size: 8, font: fontBold, color: textDark });

  page.drawText('ESI Insurance No:', { x: statCol3, y: curY, size: 7, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.esi?.esiNumber || '-'), { x: statCol3, y: curY - 11, size: 8, font: fontBold, color: textDark });

  page.drawText('Monthly Gross Salary:', { x: statCol4, y: curY, size: 7, font: fontRegular, color: textMuted });
  const salaryStr = d.personal?.salary ? `Rs. ${d.personal.salary.toLocaleString('en-IN')}` : '-';
  page.drawText(cleanText(salaryStr), { x: statCol4, y: curY - 11, size: 8.5, font: fontBold, color: primaryGreen });

  curY -= 26;

  // ==========================================
  // 6. SECTION 4: BANK MANDATE
  // ==========================================
  curY = drawSectionHeader(page, '4. BANK MANDATE & SALARY DISBURSAL ACCOUNT', curY, fontBold);

  page.drawText('Bank Name:', { x: statCol1, y: curY, size: 7, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.bank?.bankName || '-'), { x: statCol1, y: curY - 11, size: 8, font: fontBold, color: textDark });

  page.drawText('Account Holder:', { x: statCol2, y: curY, size: 7, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.bank?.accountHolderName || fullName), { x: statCol2, y: curY - 11, size: 7.5, font: fontBold, color: textDark });

  page.drawText('Account Number:', { x: statCol3, y: curY, size: 7, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.bank?.accountNumber || '-'), { x: statCol3, y: curY - 11, size: 8, font: fontBold, color: darkNavy });

  page.drawText('IFSC Code:', { x: statCol4, y: curY, size: 7, font: fontRegular, color: textMuted });
  page.drawText(cleanText(d.bank?.ifscCode || '-'), { x: statCol4, y: curY - 11, size: 8, font: fontBold, color: textDark });

  curY -= 26;

  // ==========================================
  // 7. SECTION 5: FAMILY DEPENDENTS & EDUCATION
  // ==========================================
  const validFamily = d.family?.filter(fam => fam && (fam.name?.trim() || fam.relation?.trim())) || [];
  const validEducation = d.education?.filter(edu => edu && (edu.degree?.trim() || edu.institution?.trim())) || [];

  if (validFamily.length > 0 || validEducation.length > 0) {
    curY = drawSectionHeader(page, '5. FAMILY DEPENDENTS & EDUCATION QUALIFICATIONS', curY, fontBold);

    // Dependents summary
    if (validFamily.length > 0) {
      const famSummary = validFamily.map(f => `${f.name} (${f.relation}${f.dependent ? ' - Dep' : ''})`).join(', ');
      page.drawText('Family Dependents: ', { x: col1, y: curY, size: 7, font: fontBold, color: textMuted });
      const cleanFam = cleanText(famSummary);
      page.drawText(cleanFam.length > 70 ? cleanFam.substring(0, 67) + '...' : cleanFam, { x: col1 + 80, y: curY, size: 7, font: fontRegular, color: textDark });
      curY -= 14;
    }

    // Education summary
    if (validEducation.length > 0) {
      const eduSummary = validEducation.map(e => `${e.degree || 'Qualification'} - ${e.institution || 'Institution'} (${e.endYear || ''})`).join(' | ');
      page.drawText('Education: ', { x: col1, y: curY, size: 7, font: fontBold, color: textMuted });
      const cleanEdu = cleanText(eduSummary);
      page.drawText(cleanEdu.length > 80 ? cleanEdu.substring(0, 77) + '...' : cleanEdu, { x: col1 + 80, y: curY, size: 7, font: fontRegular, color: textDark });
      curY -= 14;
    }
    curY -= 8;
  }

  // ==========================================
  // 8. SECTION 6: UNIFORM ALLOTMENT DOCKET
  // ==========================================
  const validUniforms = d.uniforms?.filter(u => u && (u.itemName || u.quantity)) || [];
  if (validUniforms.length > 0) {
    curY = drawSectionHeader(page, '6. UNIFORM & ASSET ALLOTMENT DOCKET', curY, fontBold);
    const uniText = validUniforms.map(u => `${u.itemName}: ${u.quantity}x (Size ${u.sizeLabel || ''})`).join(' | ');
    const cleanUni = cleanText(uniText);
    page.drawText(cleanUni.length > 90 ? cleanUni.substring(0, 87) + '...' : cleanUni, { x: col1, y: curY, size: 7, font: fontRegular, color: textDark });
    curY -= 18;
  }

  // ==========================================
  // 9. DECLARATION
  // ==========================================
  page.drawLine({
    start: { x: 35, y: curY },
    end: { x: width - 35, y: curY },
    thickness: 0.5,
    color: borderGray,
  });

  curY -= 14;
  page.drawText(
    '"I hereby solemnly declare and affirm that all details, certificates, and particulars submitted in this onboarding dossier are accurate and true to the best of my knowledge."',
    { x: 35, y: curY, size: 6.5, font: fontItalic, color: textMuted }
  );

  curY -= 16;

  // ==========================================
  // 10. PROFESSIONAL SIGNATURE & ATTESTATION CARDS
  // ==========================================
  const sigBoxHeight = 78;
  const sigCardY = curY - sigBoxHeight;

  // Left Card: Employee Signature Panel
  page.drawRectangle({
    x: 35,
    y: sigCardY,
    width: 255,
    height: sigBoxHeight,
    color: lightGrayBg,
    borderColor: borderGray,
    borderWidth: 0.5,
  });

  page.drawText('CANDIDATE / EMPLOYEE SIGNATURE', {
    x: 45,
    y: sigCardY + sigBoxHeight - 14,
    size: 7,
    font: fontBold,
    color: darkNavy,
  });

  // Candidate Signature Image (if present)
  const sigUrl = d.biometrics?.signatureImage?.preview || (d.biometrics?.signatureImage as any)?.url || '';
  let sigDrawn = false;
  if (sigUrl) {
    const sigBytes = await fetchImageBytes(sigUrl);
    if (sigBytes) {
      try {
        const sigImg = sigUrl.toLowerCase().includes('.png')
          ? await pdfDoc.embedPng(sigBytes)
          : await pdfDoc.embedJpg(sigBytes);
        page.drawImage(sigImg, {
          x: 55,
          y: sigCardY + 24,
          width: 90,
          height: 28,
        });
        sigDrawn = true;
      } catch (e) {
        console.warn('Could not embed candidate signature in Ack Slip:', e);
      }
    }
  }

  // Signature underline
  page.drawLine({
    start: { x: 45, y: sigCardY + 22 },
    end: { x: 230, y: sigCardY + 22 },
    thickness: 0.75,
    color: borderGray,
  });
  page.drawText(cleanText(fullName), {
    x: 45,
    y: sigCardY + 12,
    size: 7,
    font: fontBold,
    color: textDark,
  });
  page.drawText(cleanText(`Signed on: ${dateStr}`), {
    x: 45,
    y: sigCardY + 4,
    size: 6,
    font: fontRegular,
    color: textMuted,
  });

  // Right Card: Field Officer / HR Attestation Panel
  page.drawRectangle({
    x: 305,
    y: sigCardY,
    width: 255,
    height: sigBoxHeight,
    color: lightGrayBg,
    borderColor: borderGray,
    borderWidth: 0.5,
  });

  page.drawText('AUTHORIZED VERIFICATION & ATTESTATION', {
    x: 315,
    y: sigCardY + sigBoxHeight - 14,
    size: 7,
    font: fontBold,
    color: darkGreen,
  });

  // Verification status pill
  page.drawRectangle({
    x: 315,
    y: sigCardY + 36,
    width: 140,
    height: 16,
    color: lightGreenBg,
    borderColor: primaryGreen,
    borderWidth: 0.5,
  });
  page.drawText('STATUS: VERIFIED & ENROLLED', {
    x: 322,
    y: sigCardY + 41,
    size: 6.5,
    font: fontBold,
    color: darkGreen,
  });

  page.drawLine({
    start: { x: 315, y: sigCardY + 22 },
    end: { x: 500, y: sigCardY + 22 },
    thickness: 0.75,
    color: borderGray,
  });
  page.drawText(isSouthWall ? 'Southwall Security LLP' : 'Paradigm Integrated Facility Services Pvt. Ltd.', {
    x: 315,
    y: sigCardY + 12,
    size: 7,
    font: fontBold,
    color: brandPrimary,
  });
  page.drawText(cleanText(`Record Ref: ${employeeId} | HR Onboarding Desk`), {
    x: 315,
    y: sigCardY + 4,
    size: 6,
    font: fontRegular,
    color: textMuted,
  });

  // Digital audit footer banner
  const auditY = sigCardY - 22;
  page.drawRectangle({
    x: 35,
    y: auditY,
    width: 525,
    height: 15,
    color: brandLightBg,
    borderColor: borderGray,
    borderWidth: 0.5,
  });
  page.drawText(
    cleanText(`Official Verification Dossier • Electronically archived via Paradigm FMS Portal • Employee ID: ${employeeId}`),
    {
      x: 45,
      y: auditY + 4,
      size: 6,
      font: fontItalic,
      color: brandDark,
    }
  );

  // Footer text at bottom margin
  const footerCompany = isSouthWall ? 'Southwall Security LLP, 198, 2nd Floor, CMH Road, Indiranagar, Bangalore - 560 038.' : 'Paradigm Integrated Facility Services Pvt. Ltd.';
  page.drawText(`Confidential | ${footerCompany} | Official Onboarding Dossier & Service Book`, {
    x: isSouthWall ? 60 : 120,
    y: 16,
    size: 6.5,
    font: fontRegular,
    color: textMuted,
  });

  // ==========================================
  // PAGE 2: ATTACHED DOCUMENTS & STATUTORY PROOFS
  // ==========================================
  const page2 = pdfDoc.addPage([595.28, 841.89]);

  // Top branding bar
  page2.drawRectangle({
    x: 0,
    y: height - 6,
    width: width,
    height: 6,
    color: brandPrimary,
  });

  // Company Name, Logo & Subtitle
  if (isSouthWall && southWallLogoImage) {
    page2.drawImage(southWallLogoImage, {
      x: 35,
      y: height - 54,
      width: 70,
      height: 24,
    });
    page2.drawText('SOUTHWALL SECURITY LLP', {
      x: 115,
      y: height - 35,
      size: 13,
      font: fontBold,
      color: brandPrimary,
    });
    page2.drawText('ATTACHED STATUTORY IDENTITY & VERIFICATION DOCUMENTS', {
      x: 115,
      y: height - 46,
      size: 7,
      font: fontBold,
      color: textMuted,
    });
    page2.drawText(cleanText(`Candidate: ${fullName} | ID: ${employeeId}`), {
      x: 115,
      y: height - 56,
      size: 6.5,
      font: fontRegular,
      color: textMuted,
    });
  } else {
    page2.drawText(isSouthWall ? 'SOUTHWALL SECURITY LLP' : 'PARADIGM INTEGRATED SERVICES', {
      x: 35,
      y: height - 36,
      size: 15,
      font: fontBold,
      color: isSouthWall ? brandPrimary : darkNavy,
    });
    page2.drawText('ATTACHED STATUTORY IDENTITY & VERIFICATION DOCUMENTS', {
      x: 35,
      y: height - 48,
      size: 7.5,
      font: fontBold,
      color: textMuted,
    });
    page2.drawText(cleanText(`Candidate: ${fullName} | ID: ${employeeId}`), {
      x: 35,
      y: height - 58,
      size: 6.5,
      font: fontRegular,
      color: textMuted,
    });
  }

  // ID Badge & Page on Right
  page2.drawRectangle({
    x: width - 170,
    y: height - 44,
    width: 135,
    height: 22,
    color: brandLightBg,
    borderColor: brandPrimary,
    borderWidth: 1,
  });
  page2.drawText('PAGE 2 OF 2', {
    x: width - 142,
    y: height - 34,
    size: 9.5,
    font: fontBold,
    color: brandDark,
  });
  page2.drawText(cleanText(`Date: ${dateStr}`), {
    x: width - 160,
    y: height - 56,
    size: 7.5,
    font: fontRegular,
    color: textMuted,
  });

  // Divider line
  page2.drawLine({
    start: { x: 35, y: height - 62 },
    end: { x: width - 35, y: height - 62 },
    thickness: 1.5,
    color: isSouthWall ? brandPrimary : primaryGreen,
  });

  // Compute verified family & address attributes safely
  const permAddr = d.address?.permanent
    ? `${d.address.permanent.line1 || ''}, ${d.address.permanent.city || ''}, ${d.address.permanent.state || ''} ${d.address.permanent.pincode || ''}`.replace(/^[\s,]+|[\s,]+$/g, '')
    : (d.address?.present ? `${d.address.present.line1 || ''}, ${d.address.present.city || ''}` : '-');
  const emergencyStr = d.personal?.emergencyContactNumber || d.personal?.alternateMobile || d.personal?.mobile || '-';

  // 2x2 Grid of Document Cards with Verified Statutory Particulars
  const docCards = [
    {
      title: '1. AADHAAR CARD (FRONT SIDE)',
      subtitle: 'Primary Photo & Identity Proof',
      url: d.personal?.idProofFront?.preview || (d.personal?.idProofFront as any)?.url || '',
      boxX: 35,
      boxY: 420,
      detailsType: 'grid4' as const,
      col1: [
        { label: 'NAME ON CARD', val: cleanText(fullName) },
        { label: 'DOB / AGE', val: cleanText(formatDisplayDate(d.personal?.dob) || '-') },
      ],
      col2: [
        { label: 'AADHAAR NUMBER', val: cleanText(d.personal?.aadhaarNumber || d.personal?.idProofNumber || '-') },
        { label: 'GENDER', val: cleanText(d.personal?.gender || '-') },
      ],
    },
    {
      title: '2. AADHAAR CARD (BACK SIDE)',
      subtitle: 'Permanent / Communication Address Proof',
      url: d.personal?.idProofBack?.preview || (d.personal?.idProofBack as any)?.url || '',
      boxX: 305,
      boxY: 420,
      detailsType: 'address' as const,
      address: cleanText(permAddr),
      father: cleanText(fatherName !== '-' ? fatherName : (spouseName !== '-' ? spouseName : '-')),
      emergency: cleanText(emergencyStr),
    },
    {
      title: '3. PAN CARD',
      subtitle: 'Income Tax Identification',
      url: d.personal?.panCard?.preview || (d.personal?.panCard as any)?.url || '',
      boxX: 35,
      boxY: 75,
      detailsType: 'grid4' as const,
      col1: [
        { label: 'PAN NUMBER', val: cleanText(d.personal?.panNumber || '-') },
        { label: 'FATHER\'S NAME', val: cleanText(fatherName) },
      ],
      col2: [
        { label: 'CARDHOLDER NAME', val: cleanText(fullName) },
        { label: 'DATE OF BIRTH', val: cleanText(formatDisplayDate(d.personal?.dob) || '-') },
      ],
    },
    {
      title: '4. BANK MANDATE PROOF',
      subtitle: 'Salary Disbursal & Bank Mandate',
      url: d.bank?.bankProof?.preview || (d.bank?.bankProof as any)?.url || '',
      boxX: 305,
      boxY: 75,
      detailsType: 'grid4' as const,
      col1: [
        { label: 'BANK NAME', val: cleanText(d.bank?.bankName || 'State Bank of India') },
        { label: 'ACCOUNT NUMBER', val: cleanText(d.bank?.accountNumber || '-') },
      ],
      col2: [
        { label: 'ACCOUNT HOLDER', val: cleanText(d.bank?.accountHolderName || fullName) },
        { label: 'IFSC CODE', val: cleanText(d.bank?.ifscCode || '-') },
      ],
    },
  ];

  const boxW = 255;
  const boxH = 325;
  const headerH = 26;
  const particularsH = 46;

  for (const doc of docCards) {
    // Card border
    page2.drawRectangle({
      x: doc.boxX,
      y: doc.boxY,
      width: boxW,
      height: boxH,
      color: lightGrayBg,
      borderColor: borderGray,
      borderWidth: 0.75,
    });

    // Card top title bar
    page2.drawRectangle({
      x: doc.boxX,
      y: doc.boxY + boxH - headerH,
      width: boxW,
      height: headerH,
      color: brandLightBg,
      borderColor: borderGray,
      borderWidth: 0.5,
    });

    page2.drawText(cleanText(doc.title), {
      x: doc.boxX + 8,
      y: doc.boxY + boxH - 12,
      size: 7.5,
      font: fontBold,
      color: brandDark,
    });

    page2.drawText(cleanText(doc.subtitle), {
      x: doc.boxX + 8,
      y: doc.boxY + boxH - 22,
      size: 6.5,
      font: fontRegular,
      color: textMuted,
    });

    // Embed image if available (above particulars panel)
    let drawn = false;
    if (doc.url) {
      try {
        const docImg = await embedSafeImage(pdfDoc, doc.url);
        if (docImg) {
          const maxW = boxW - 16;
          const maxH = boxH - headerH - particularsH - 12;
          const scale = Math.min(maxW / docImg.width, maxH / docImg.height, 1);
          const drawW = docImg.width * scale;
          const drawH = docImg.height * scale;
          const drawX = doc.boxX + 8 + (maxW - drawW) / 2;
          const drawY = doc.boxY + particularsH + 6 + (maxH - drawH) / 2;
          page2.drawImage(docImg, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
          drawn = true;
        }
      } catch (err) {
        console.warn(`Could not embed image for ${doc.title}:`, err);
      }
    }

    if (!drawn) {
      page2.drawRectangle({
        x: doc.boxX + 16,
        y: doc.boxY + particularsH + 12,
        width: boxW - 32,
        height: boxH - headerH - particularsH - 24,
        color: rgb(0.92, 0.94, 0.96),
        borderColor: borderGray,
        borderWidth: 0.5,
      });
      page2.drawText('[ DOCUMENT NOT ATTACHED ]', {
        x: doc.boxX + 58,
        y: doc.boxY + particularsH + ((boxH - headerH - particularsH) / 2) + 4,
        size: 7.5,
        font: fontBold,
        color: textMuted,
      });
      page2.drawText('Original verification pending or copy not provided', {
        x: doc.boxX + 32,
        y: doc.boxY + particularsH + ((boxH - headerH - particularsH) / 2) - 8,
        size: 6.5,
        font: fontRegular,
        color: textMuted,
      });
    }

    // Bottom Verified Particulars Panel (Statutory Details Strip)
    page2.drawRectangle({
      x: doc.boxX,
      y: doc.boxY,
      width: boxW,
      height: particularsH,
      color: brandLightBg,
      borderColor: borderGray,
      borderWidth: 0.5,
    });

    if (doc.detailsType === 'grid4') {
      const col1X = doc.boxX + 8;
      const col2X = doc.boxX + 128;
      // Row 1
      page2.drawText(doc.col1[0].label, { x: col1X, y: doc.boxY + 34, size: 5.5, font: fontBold, color: textMuted });
      page2.drawText(doc.col1[0].val.slice(0, 24), { x: col1X, y: doc.boxY + 25, size: 7, font: fontBold, color: textDark });

      page2.drawText(doc.col2[0].label, { x: col2X, y: doc.boxY + 34, size: 5.5, font: fontBold, color: textMuted });
      page2.drawText(doc.col2[0].val.slice(0, 24), { x: col2X, y: doc.boxY + 25, size: 7, font: fontBold, color: brandDark });

      // Row 2
      page2.drawText(doc.col1[1].label, { x: col1X, y: doc.boxY + 14, size: 5.5, font: fontBold, color: textMuted });
      page2.drawText(doc.col1[1].val.slice(0, 24), { x: col1X, y: doc.boxY + 5, size: 7, font: fontBold, color: textDark });

      page2.drawText(doc.col2[1].label, { x: col2X, y: doc.boxY + 14, size: 5.5, font: fontBold, color: textMuted });
      page2.drawText(doc.col2[1].val.slice(0, 24), { x: col2X, y: doc.boxY + 5, size: 7, font: fontBold, color: textDark });
    } else if (doc.detailsType === 'address') {
      const startX = doc.boxX + 8;
      page2.drawText('VERIFIED PERMANENT / ADDRESS', { x: startX, y: doc.boxY + 34, size: 5.5, font: fontBold, color: textMuted });
      page2.drawText(doc.address.slice(0, 52), { x: startX, y: doc.boxY + 25, size: 6.5, font: fontRegular, color: textDark });

      page2.drawText('FATHER/SPOUSE:', { x: startX, y: doc.boxY + 13, size: 5.5, font: fontBold, color: textMuted });
      page2.drawText(doc.father.slice(0, 20), { x: startX + 55, y: doc.boxY + 13, size: 6.5, font: fontBold, color: textDark });

      page2.drawText('EMERGENCY:', { x: doc.boxX + 130, y: doc.boxY + 13, size: 5.5, font: fontBold, color: textMuted });
      page2.drawText(doc.emergency.slice(0, 16), { x: doc.boxX + 180, y: doc.boxY + 13, size: 6.5, font: fontBold, color: textDark });
    }
  }

  // Footer on Page 2
  page2.drawLine({
    start: { x: 35, y: 60 },
    end: { x: width - 35, y: 60 },
    thickness: 0.5,
    color: borderGray,
  });

  page2.drawText('Official Verification Dossier • All statutory documents verified against originals for onboarding compliance.', {
    x: 35,
    y: 45,
    size: 6.5,
    font: fontRegular,
    color: textMuted,
  });

  page2.drawText(`Confidential | ${footerCompany} | Page 2 of 2 (Attachments)`, {
    x: isSouthWall ? 60 : 120,
    y: 16,
    size: 6.5,
    font: fontRegular,
    color: textMuted,
  });

  return await pdfDoc.save();
}

/**
 * Directly triggers download of the Ack Slip PDF in the user's browser
 */
export async function downloadOnboardingAckSlipPdf(data: OnboardingData): Promise<void> {
  const isSouthWall = isSouthWallEmployee(data);
  const pdfBytes = await generateOnboardingAckSlipPdf(data);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const rawEmpId = data?.personal?.employeeId || data?.id || (isSouthWall ? 'SW-1' : 'employee');
  const employeeId = isSouthWall
    ? (rawEmpId.startsWith('SW-') ? rawEmpId : (rawEmpId.startsWith('PARA-') ? `SW-${rawEmpId.substring(5)}` : `SW-${rawEmpId.replace(/^[A-Za-z]+-?/, '') || '1'}`))
    : rawEmpId;
  const cleanEmpId = employeeId.replace(/-/g, ' ');
  const filePrefix = isSouthWall ? 'SouthWall Ack Slip' : 'PIFS Ack Slip';

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filePrefix} ${cleanEmpId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
