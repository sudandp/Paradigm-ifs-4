import { describe, it, expect, vi } from 'vitest';
import { isLandscapeDocumentType, autoRotateDocumentIfSideways } from './imageRotation';

describe('imageRotation utils', () => {
  describe('isLandscapeDocumentType', () => {
    it('returns true for PAN card variants', () => {
      expect(isLandscapeDocumentType('PAN', 'PAN Card')).toBe(true);
      expect(isLandscapeDocumentType(undefined, 'Upload PAN Card (Mandatory)')).toBe(true);
      expect(isLandscapeDocumentType('pan', '')).toBe(true);
    });

    it('returns true for Aadhaar and ID Proof front/back', () => {
      expect(isLandscapeDocumentType('Aadhaar', 'Aadhaar Card Front')).toBe(true);
      expect(isLandscapeDocumentType('idFront', 'ID Proof (Front)')).toBe(true);
      expect(isLandscapeDocumentType('idBack', 'ID Proof (Back)')).toBe(true);
    });

    it('returns true for Bank Cheque and Passbook', () => {
      expect(isLandscapeDocumentType('Bank', 'Bank Cheque / Passbook')).toBe(true);
      expect(isLandscapeDocumentType(undefined, 'Cancelled Cheque Leaf')).toBe(true);
      expect(isLandscapeDocumentType(undefined, 'Bank Passbook Cover/Page')).toBe(true);
    });

    it('returns true for Voter ID and Driving License', () => {
      expect(isLandscapeDocumentType('Voter', 'Voter Identity Card')).toBe(true);
      expect(isLandscapeDocumentType('DL', 'Driving License')).toBe(true);
    });

    it('returns false for full-page portrait documents like Salary Slips or Profile Photo', () => {
      expect(isLandscapeDocumentType('Salary', 'Latest Salary Slip')).toBe(false);
      expect(isLandscapeDocumentType(undefined, 'Passport Size Photo')).toBe(false);
      expect(isLandscapeDocumentType('Education', 'Degree Certificate')).toBe(false);
      expect(isLandscapeDocumentType(undefined, 'Medical Prescription')).toBe(false);
    });
  });

  describe('autoRotateDocumentIfSideways', () => {
    it('detects when a landscape card is photographed in portrait and rotates 90° CW', async () => {
      const originalImage = global.Image;
      const originalDoc = (global as any).document;

      class MockImage {
        width = 400;
        height = 800; // Portrait orientation (h > w * 1.05)
        naturalWidth = 400;
        naturalHeight = 800;
        crossOrigin = '';
        src = '';
        onload: (() => void) | null = null;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          save: vi.fn(),
          translate: vi.fn(),
          rotate: vi.fn(),
          drawImage: vi.fn(),
          restore: vi.fn(),
        }),
        toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mockRotatedBase64'),
      };

      (global as any).document = {
        createElement: (tag: string) => {
          if (tag === 'canvas') return mockCanvas;
          return {};
        },
      };

      // @ts-ignore
      global.Image = MockImage;

      try {
        const dummyDataUrl = 'data:image/jpeg;base64,dummy';
        const res = await autoRotateDocumentIfSideways(dummyDataUrl, 'PAN', 'PAN Card');
        expect(res.wasRotated).toBe(true);
        expect(res.dataUrl).toContain('mockRotatedBase64');
      } finally {
        global.Image = originalImage;
        (global as any).document = originalDoc;
      }
    });

    it('does not rotate when document is already landscape', async () => {
      const originalImage = global.Image;
      class MockLandscapeImage {
        width = 800;
        height = 500; // Landscape orientation (w > h)
        naturalWidth = 800;
        naturalHeight = 500;
        crossOrigin = '';
        src = '';
        onload: (() => void) | null = null;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }

      // @ts-ignore
      global.Image = MockLandscapeImage;

      try {
        const dummyDataUrl = 'data:image/jpeg;base64,dummyLandscape';
        const res = await autoRotateDocumentIfSideways(dummyDataUrl, 'PAN', 'PAN Card');
        expect(res.wasRotated).toBe(false);
      } finally {
        global.Image = originalImage;
      }
    });

    it('does not auto-rotate portrait documents that are not landscape cards (e.g. Salary Slips)', async () => {
      const originalImage = global.Image;
      class MockPortraitDoc {
        width = 600;
        height = 900; // Portrait A4
        naturalWidth = 600;
        naturalHeight = 900;
        crossOrigin = '';
        src = '';
        onload: (() => void) | null = null;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }

      // @ts-ignore
      global.Image = MockPortraitDoc;

      try {
        const dummyDataUrl = 'data:image/jpeg;base64,dummySalary';
        const res = await autoRotateDocumentIfSideways(dummyDataUrl, 'Salary', 'Latest Salary Slip');
        expect(res.wasRotated).toBe(false);
      } finally {
        global.Image = originalImage;
      }
    });
  });
});
