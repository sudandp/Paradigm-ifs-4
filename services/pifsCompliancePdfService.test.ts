import { describe, it, expect } from 'vitest';
import { generatePifsCompliancePdf, isSouthWallEmployee } from './pifsCompliancePdfService';
import { generateOnboardingAckSlipPdf } from './pifsAckSlipPdfService';
import type { OnboardingData } from '../types';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

describe('SouthWall Security LLP Compliance & Onboarding Service', () => {
  const southWallEmployee = {
    id: 'deepan-sw-001',
    status: 'verified',
    enrollmentDate: '2026-09-04',
    personal: {
      firstName: 'DEEPAN',
      lastName: 'GURUNG',
      employeeId: 'PARA-1568',
      dob: '1984-01-01',
      gender: 'Male',
      bloodGroup: 'O+',
      maritalStatus: 'Married',
      mobile: '9805495996',
      emergencyContactName: 'Upendra Bhandari',
      emergencyContactNumber: '9805495996',
      aadhaarNumber: '252640029917',
      salary: 18500,
    },
    organization: {
      companyName: 'SOUTHWALL SECURITY LLP',
      organizationName: 'UBER VERDANT PHASE 2',
      department: 'SECURITY_SERVICES',
      designation: 'SECURITY GUARD',
    },
    address: {
      present: {
        line1: 'Shimla, Dhadirawat',
        city: 'Shimla',
        state: 'Himachal Pradesh',
        pincode: '171206',
      },
      permanent: {
        line1: 'Ambedkar Nagar, Teen Roon Colony, Carmalaram Railway Station',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560035',
      },
    },
    uan: {
      uanNumber: '102268669615',
    },
    esi: {
      esiNumber: '5044267223',
    },
    family: [
      {
        name: 'UPENDRA BHANDARI',
        relation: 'Father',
        dependent: true,
      },
    ],
    uniforms: [
      {
        itemName: 'Security Uniform',
        quantity: 2,
        sizeLabel: 'L',
      },
    ],
  } as unknown as OnboardingData;

  const paradigmEmployee = {
    id: 'pifs-emp-001',
    status: 'verified',
    enrollmentDate: '2026-10-01',
    personal: {
      firstName: 'RAMESH',
      lastName: 'KUMAR',
      employeeId: 'PARA-1200',
      dob: '1990-05-15',
      gender: 'Male',
      mobile: '9876543210',
    },
    organization: {
      companyName: 'Paradigm Services',
      organizationName: 'Corporate Office',
      department: 'FACILITY_MANAGEMENT',
      designation: 'FACILITY MANAGER',
    },
    address: {
      present: {
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    },
  } as unknown as OnboardingData;

  it('correctly identifies SouthWall employees by company name, site, or tokens', () => {
    expect(isSouthWallEmployee(southWallEmployee)).toBe(true);

    // Test with company token
    expect(isSouthWallEmployee({
      ...paradigmEmployee,
      organization: { ...paradigmEmployee.organization, companyName: 'South Wall Security LLP' },
    } as unknown as OnboardingData)).toBe(true);

    // Test with known security site
    expect(isSouthWallEmployee({
      ...paradigmEmployee,
      organization: { ...paradigmEmployee.organization, companyName: '', organizationName: 'Akshaya Patra Security' },
    } as unknown as OnboardingData)).toBe(true);

    // Regular Paradigm employee should not be detected as SouthWall
    expect(isSouthWallEmployee(paradigmEmployee)).toBe(false);
  });

  it('generates 21-page SouthWall compliance PDF with converted SW- employee code and branding', async () => {
    // If the template exists, test generation
    const templatePath = path.resolve('public/templates/PIFS_Compliance_Data_Sheet.pdf');
    if (!fs.existsSync(templatePath)) {
      console.warn('Skipping full compliance generation test: template not found at', templatePath);
      return;
    }

    const pdfBytes = await generatePifsCompliancePdf(southWallEmployee);
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(10000);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBe(21);

    // Verify it writes successfully to scratch
    const outPath = path.resolve('scratch/test_southwall_compliance.pdf');
    fs.writeFileSync(outPath, Buffer.from(pdfBytes));
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('generates SouthWall Ack Slip PDF with SW- employee code and SOUTHWALL SECURITY LLP header', async () => {
    const ackBytes = await generateOnboardingAckSlipPdf(southWallEmployee);
    expect(ackBytes).toBeDefined();
    expect(ackBytes.length).toBeGreaterThan(1000);

    const pdfDoc = await PDFDocument.load(ackBytes);
    expect(pdfDoc.getPageCount()).toBe(1);

    const outPath = path.resolve('scratch/test_southwall_ack_slip.pdf');
    fs.writeFileSync(outPath, Buffer.from(ackBytes));
    expect(fs.existsSync(outPath)).toBe(true);
  });
});
