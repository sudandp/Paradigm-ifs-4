import { describe, it, expect } from 'vitest';
import { generateOnboardingAckSlipPdf } from './pifsAckSlipPdfService';
import type { OnboardingData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

describe('pifsAckSlipPdfService Layout Test', () => {
  it('generates Ack Slip PDF without vertical overlap', async () => {
    let photoDataUrl = '';
    const photoPath = path.resolve('scratch/extracted_photo.jpg');
    if (fs.existsSync(photoPath)) {
      const b64 = fs.readFileSync(photoPath).toString('base64');
      photoDataUrl = `data:image/jpeg;base64,${b64}`;
    }

    const mockData = {
      id: 'fd731e5e-b503-4d4d-b1c5-43d126a22e78',
      status: 'verified',
      enrollmentDate: '2026-09-28',
      personal: {
        firstName: 'PALLABI',
        lastName: 'SAIKIA',
        employeeId: 'PARA-3245',
        dob: '1999-03-19',
        gender: 'Female',
        bloodGroup: 'B+',
        maritalStatus: 'Married',
        mobile: '6001890702',
        emergencyContactName: 'Pallab Gogoi',
        emergencyContactNumber: '9365281294',
        aadhaarNumber: '604658392588',
        panNumber: 'KLPPS8936B',
        salary: 20000,
        photo: {
          preview: photoDataUrl,
        } as any,
      },
      organization: {
        organizationName: 'birla alokya',
        department: 'SECURITY_SERVICES',
        designation: 'LADY GUARD',
      },
      address: {
        present: {
          line1: 'Varthur Near Police Station',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560087',
        },
        permanent: {
          line1: 'Moidhaima Lakmipur',
          city: 'Lakmipur',
          state: 'Karnataka',
          pincode: '787032',
        },
      },
      uan: {
        uanNumber: '101836074172',
      },
      esi: {
        esiNumber: '',
      },
      bank: {
        bankName: 'State Bank of India',
        accountHolderName: 'Pallabi Saikia',
        accountNumber: '39539647403',
        ifscCode: 'SBIN0000145',
      },
      family: [
        {
          name: 'Pallab Gogoi',
          relation: 'Spouse',
          dependent: true,
        },
      ],
      uniforms: [
        {
          itemName: 'Security Uniform Set',
          quantity: 2,
          sizeLabel: 'M',
        },
      ],
    } as unknown as OnboardingData;

    const pdfBytes = await generateOnboardingAckSlipPdf(mockData);
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const outPath = path.resolve('scratch/test_ack_slip.pdf');
    fs.writeFileSync(outPath, Buffer.from(pdfBytes));

    // Overwrite the user's downloaded file with the newly fixed layout
    const userDownloadPath = 'C:\\Users\\sudhan\\Downloads\\PIFS Ack Slip PARA 3245.pdf';
    try {
      fs.writeFileSync(userDownloadPath, Buffer.from(pdfBytes));
      console.log('Successfully updated file in user Downloads folder:', userDownloadPath);
    } catch (e) {
      console.warn('Could not write directly to Downloads path:', e);
    }
  });
});
