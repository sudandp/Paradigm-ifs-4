import { describe, it, expect, vi } from 'vitest';
import {
  getOfflineWorkerOptions,
  parseAadhaarQrContent,
  extractDataOffline,
} from './offlineExtraction';

// Top-level mock for tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockImplementation(async (imageSource: string) => {
      if (imageSource.includes('mock-aadhaar')) {
        return {
          data: {
            text: `Government of India\nSudhan M\nDOB: 16/10/1995\nMale\n4852 1587 3813\nAddress: 516/A, OM SHAKTHI COMPLEX, THIRUCHI ROAD, Silapadi, Dindigul, Tamil Nadu 624005\nMobile: 9000885355`,
          },
        };
      }
      return {
        data: {
          text: `INCOME TAX DEPARTMENT\nGOVT OF INDIA\nABCDE1234F\nName: JOHN DOE\nFather's Name: ROBERT DOE\nDate of Birth: 15/08/1990`,
        },
      };
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('offlineExtraction', () => {
  describe('getOfflineWorkerOptions', () => {
    it('returns worker options pointing to local public/tesseract paths', () => {
      const options = getOfflineWorkerOptions();
      expect(options.workerPath).toContain('/tesseract/worker.min.js');
      expect(options.corePath).toContain('/tesseract/core');
      expect(options.langPath).toContain('/tesseract/tessdata');
      expect(options.cachePath).toContain('/tesseract/tessdata');
      expect(options.gzip).toBe(false);
      expect(options.workerBlobURL).toBe(false);
    });
  });

  describe('parseAadhaarQrContent', () => {
    it('parses standard XML Aadhaar QR code correctly', async () => {
      const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<PrintLetterBarcodeData uid="485215873813" name="Sudhan M" gender="M" yob="1995" co="S/O Mari Dass" house="516/A" street="OM SHAKTHI COMPLEX" loc="THIRUCHI ROAD, Silapadi" vtc="Dindigul" dist="Dindigul" state="Tamil Nadu" pc="624005" dob="16/10/1995" mobile="9000885355" />`;

      const result = await parseAadhaarQrContent(sampleXml);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Sudhan M');
      expect(result?.dob).toBe('1995-10-16');
      expect(result?.gender).toBe('Male');
      expect(result?.aadhaarNumber).toBe('485215873813');
      expect(result?.phone).toBe('9000885355');
      expect(result?.address?.city).toBe('Dindigul');
      expect(result?.address?.state).toBe('Tamil Nadu');
      expect(result?.address?.pincode).toBe('624005');
      expect(result?.address?.line1).toContain('516/A');
      expect(result?.fatherName).toBe('Mari Dass');
    });

    it('returns null for non-QR or invalid text', async () => {
      const result = await parseAadhaarQrContent('not a qr text');
      expect(result).toBeNull();
    });
  });

  describe('extractDataOffline with regex parsing', () => {
    it('extracts PAN card details from raw text', async () => {
      const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=';
      const result = await extractDataOffline(dummyBase64, 'PAN', 'image/png');

      expect(result._offlineFallback).toBe(true);
      expect(result.panNumber).toBe('ABCDE1234F');
      expect(result.dob).toBe('1990-08-15');
    });

    it('extracts Aadhaar card details from raw text without errors', async () => {
      const dummyBase64 = 'mock-aadhaar-base64';
      const result = await extractDataOffline(dummyBase64, 'Aadhaar', 'image/png');

      expect(result._offlineFallback).toBe(true);
      expect(result.aadhaarNumber).toBe('485215873813');
      expect(result.gender).toBe('Male');
      expect(result.dob).toBe('1995-10-16');
      expect(result.phone).toBe('9000885355');
      expect(result.address?.pincode).toBe('624005');
      expect(result.address?.state).toBe('Tamil Nadu');
    });

    it('accurately parses real-world e-Aadhaar with columns and disclaimers', async () => {
      const dummyBase64 = 'mock-real-eaadhaar';
      // Mock worker recognize to return the exact raw OCR text from the user's document
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `BAS K BAS
4, y i — y v
’ eee
‘TAN. | "AN.
sa weet Tere 1] ovetrment taka AADHAAR
Government of India H trbd
Unique Identification Authority of India Any
eccies zoaiy Enrolment No.: 2086/13070/63272 H INFORMATION
8 To !] = Aadhaar is a proof of identity, not of citizenship.
i ot !] = Verify identity using Secure QR Code/ Otfine XML/ Online
2 SO Man Doss | Authentication.
519A H
eee |] = This is electronically generated letter.
 THIRUCHI ROAD. H
B Sipe H
© Silapad ‘
Dindigu Tamil Nadu - 624005 H eee cetcactos aran,sabat attics
‘9008885355 : a mhexianh dooed arte Meardead aeatrivat,
pe ontas ay £ |: = Aadhaar is valid throughout the country.
ab, eoeot soal, / Your AadhaarNo.: |! inAadhaee,
4852 1587 3813 i = Carry Aadhaar in your smart phone
‘VID : 9112 4361 0767 1797 ' Whatienet Ave.
Government of india | & Unique Identification Authontty of India my.
1] SO ting prob, Ste, gues amis
spe on 1) SO ing sreb, 5160, gibeif andiokds, mameeeseemges oem
Suchan Mt Z|] Peat Ging, ouing parodss, ern ey
4852 1587 3813 y 4852 1587 3813
Vip : 9112 4961 0767 1797`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'Aadhaar', 'image/png');

      expect(result._offlineFallback).toBe(true);
      expect(result.aadhaarNumber).toBe('485215873813');
      expect(result.virtualId).toBe('9112436107671797');
      expect(result.phone).toBe('9008885355');
      // Name must be resolved as Sudhan M, never BAS K BAS
      expect(result.name).toBe('Sudhan M');
      // City must be resolved as Dindigul
      expect(result.address?.city).toBe('Dindigul');
      expect(result.address?.state).toBe('Tamil Nadu');
      expect(result.address?.pincode).toBe('624005');
      // Father Name must be extracted from S/O / 2 SO Man Doss
      expect(result.fatherName).toBe('MARI DASS');
      // Address line 1 must not contain boilerplate disclaimers or S/O parent name
      expect(result.address?.line1).not.toContain('Aadhaar is a proof of identity');
      expect(result.address?.line1).not.toContain('electronically generated letter');
      expect(result.address?.line1).not.toContain('Authentication');
      expect(result.address?.line1).not.toContain('S/O');
      expect(result.address?.line1).toContain('516/A, OM SHAKTHI COMPLEX');
      expect(result.address?.line1).toContain('THIRUCHI ROAD');
    });

    it('rejects isolated 2-letter OCR noise such as "ae G" and extracts clean PAN name', async () => {
      const dummyBase64 = 'mock-pan-noise-card';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `INCOME TAX DEPARTMENT
GOVT. OF INDIA
SUDHAN M
MARI DASS
16/10/1995
ABCDE1234F
ae G`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'PAN', 'image/jpeg');

      expect(result.panNumber).toBe('ABCDE1234F');
      expect(result.dob).toBe('1995-10-16');
      // Name must be SUDHAN M and NEVER the noise token "ae G"
      expect(result.name?.toUpperCase()).toBe('SUDHAN M');
      expect(result.name).not.toBe('ae G');
    });

    it('handles noisy PAN card where only name and DOB are above PAN number without standard header', async () => {
      const dummyBase64 = 'mock-pan-no-header';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `JOHNATHAN DOE
ROBERT DOE
15/08/1990
ABCDE1234F`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'PAN', 'image/jpeg');

      expect(result.panNumber).toBe('ABCDE1234F');
      expect(result.dob).toBe('1990-08-15');
      expect(result.name).toBe('JOHNATHAN DOE');
    });
    it('accurately parses QR-format PAN card with PAN number above name and Father Name anchor', async () => {
      const dummyBase64 = 'mock-pan-qr-format';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `INCOME TAX DEPARTMENT GOVT. OF INDIA
Permanent Account Number Card
KBLPS4696J
SUDHAN M dle Ho
Father's Name
MARI DASS
16/10/1995 Signature`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'PAN', 'image/jpeg');

      expect(result.panNumber).toBe('KBLPS4696J');
      expect(result.name?.toUpperCase()).toBe('SUDHAN M');
      expect(result.fatherName?.toUpperCase()).toBe('MARI DASS');
      expect(result.dob).toBe('1995-10-16');
    });

    it('accurately extracts PAN, Name, Father Name, and DOB from real-world noisy PAN OCR text', async () => {
      const dummyBase64 = 'mock-pan-user-real';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `6nn T ea =_ oP ee
gp FTAA fart ARG ara
» INCOME TAX DEPARTMENT > GOVT. OF INDIA
¥ ert dear der ae a ean
Permanent Account Number Card ee
KBLPS4696J ree ee
* ae
J ° Pee oe yee Me
’ ° se Lees,
P / Father's Name ?
ty
a -
. - Day 7Signature 7
iy . 2
: 7 Pee
pate
M tiene es
pies e ek
/ Father's Name
‘MARI DASS
16/10/1995
| SUDHANM p i`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'PAN', 'image/jpeg');

      expect(result.panNumber).toBe('KBLPS4696J');
      expect(result.name?.toUpperCase()).toBe('SUDHAN M');
      expect(result.fatherName?.toUpperCase()).toBe('MARI DASS');
      expect(result.dob).toBe('1995-10-16');
    });

    it('detects when user uploads Aadhaar card into PAN slot and rejects with mismatch error', async () => {
      const dummyBase64 = 'mock-aadhaar-uploaded-in-pan';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `Government of India
Unique Identification Authority of India
Enrolment No.: 2086/13070/63272
Sudhan M
4852 1587 3813
VID : 9112 4361 0767 1797
Address: 516/A, OM SHAKTHI COMPLEX, THIRUCHI ROAD, Silapadi, Dindigul Tamil Nadu - 624005`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'PAN', 'image/jpeg');

      expect(result._documentMismatch).toBe(true);
      expect(result._detectedDocType).toBe('Aadhaar');
      expect(result._expectedDocType).toBe('PAN');
      expect(result._mismatchError).toContain('This is an Aadhaar card, not a PAN card');
    });

    it('detects when user uploads PAN card into Aadhaar slot and rejects with mismatch error', async () => {
      const dummyBase64 = 'mock-pan-uploaded-in-aadhaar';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `INCOME TAX DEPARTMENT
GOVT. OF INDIA
Permanent Account Number Card
ABCDE1234F
JOHN DOE
ROBERTS DOE
15/08/1990`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'idFront', 'image/jpeg');

      expect(result._documentMismatch).toBe(true);
      expect(result._detectedDocType).toBe('PAN');
      expect(result._expectedDocType).toBe('Aadhaar');
      expect(result._mismatchError).toContain('This is a PAN card, not an Aadhaar card');
    });

    it('accurately extracts Bank Passbook details and prevents Account Opening Date from becoming DOB', async () => {
      const dummyBase64 = 'mock-bank-kotak-passbook';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `= wz 4
a
y =
SS Se # ee
ee) kotak
. OS BF Kotak Mahindra
Oe if Belt tips? aa
CRN + 714103000 eee ee a en a
; BALE, Recreate Ser tr eV APR Wg nd oi men a reer g see So ee
fm Account Number, atten rg ne ees Mode at Operations 22 SINGLY
Account Number : 1440955237
Name(s): Satyam Baishya
Branch name : BANGALORE - HSR LAYOUT
Branch Code : 8112
Branch Address: KOTAK MAHINDRABANK LTD
240/48 27TH MAIN SECTOR-II HSR LAYOUT
BANGALORE
BENGALURU - 560102
Karnataka INDIA
Preferred Contact No. : 8951731669
Account Opening Date ; 25-02-2023
Branch MICR : 560485063
Branch IFSC : KKBK0008112
Nominee Registered : No`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'Bank', 'image/jpeg');

      expect(result.accountNumber).toBe('1440955237');
      expect(result.confirmAccountNumber).toBe('1440955237');
      expect(result.accountHolderName).toBe('Satyam Baishya');
      expect(result.bankName).toBe('Kotak Mahindra Bank');
      expect(result.branchName).toContain('BANGALORE');
      expect(result.ifscCode).toBe('KKBK0008112');
      expect(result.phone).toBe('8951731669');
      // Crucial verification: Account Opening Date (25-02-2023) must NEVER be extracted as DOB on bank proof!
      expect(result.dob).toBeUndefined();
      expect(result.panNumber).toBeUndefined();
      expect(result.address?.state).toBe('Karnataka');
    });

    it('extracts Bank details from user exact noisy full-page OCR text without polluting DOB or Aadhaar', async () => {
      const dummyBase64 = 'mock-bank-user-raw';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `(= wz 4
a
y =
SS Se # ee
ee) kotak
. OS BF Kotak hatindes
Oe if Belt tips? aa
CRN + 714103000 eee ee a en a
; BALE, Recreate Ser tr eV APR Wg nd oi men a reer g see So ee
fm Avcount Number, atten rg ne ees Mode at Operations 22 SINGLY
Name(s): Sal gae Savaninaisncn: © > alee Branch ume = BANGALORE-HSLAYOUT
cl ty ae Bore RS eae Gill Codes ee
5 Adthuesss |, eT a Me Poaee a Ie teen eee
woeAdiress “2 SEE Wenp Roca pike pron os ze Fen oe
DF Aeros = NOD Roval pincidiPhmeey = Branch Address: KOTAK MAHINDRABANK LID:
PAID Quaters Ht Ist Sector as ses FAWA2TTEEMAIN: SECTOR-IHSR LAY!
Be Fehyo a <> HarlurRoad Bangalore” ise sjpabiiee: 240/48 270H MAIN SECTOR-H HSR LAY!
a ee aes Sea Need els Se ie : vee BANGALORE fale
—— seGengaliri —SOOI0R eee ee ee BENGALURU-soolog?
Karnataka i — eamaaer i ee cae Pe
INDIA INDIA .
Preferred Contact No. : 8951731669 Branch Tel. No. > SS8444153
Account Opening Date ; 25-02-2023 Branch MICK + 360485063
Nominee Rewistercd 7 No Branch ESC: + KRBKOOOSII2`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'Bank', 'image/jpeg');

      expect(result.bankName).toBe('Kotak Mahindra Bank');
      expect(result.branchName).toContain('BANGALORE');
      expect(result.ifscCode).toBe('KKBK0008112');
      expect(result.phone).toBe('8951731669');
      expect(result.address?.state).toBe('Karnataka');
      expect(result.dob).toBeUndefined();
      expect(result.panNumber).toBeUndefined();
    });

    it('accurately resolves Namefs, branch spacing, city Bengaluru (not Number), and pincode 560102 from Image 3 text', async () => {
      const dummyBase64 = 'mock-bank-image-3';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `CRN > TI4103000
Account Number + 1446955237 me iia!
Name(s) + Satyam Baishya <a
“ Lane 5) ee ees
Avliteacec FES a NS Te Ay tat oe

On ae e kota
pees ; jh Bee iy Kotak stan
4 ea he inbon neg?
Mode of Operiution : SINGLY
Brinch tame : BANGALORE - HSR LAYOUT
Bruch Code +, St12

INDLA Ebi eens
Branch fel. No. > S884-444\\53
Branch MICR + 360485063
Branch ESC + KRBKOOOSII2

CRN So.
Account Number 1446985237,
— Namefs) 5 Satyam Batista
\\ a\\daress: HOOT Royal Placid Phase |
r Surlur Road Banvalor 2
Karnataka ie :
IND IA
Preferred Contact No, : 8931731669
Account Opening Date : 25-02-2023
Nominee Revistered : No
Nominee Nuime $2`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'Bank', 'image/jpeg');

      expect(result.accountNumber).toBe('1446955237');
      expect(result.confirmAccountNumber).toBe('1446955237');
      expect(result.accountHolderName).toBe('Satyam Baishya');
      expect(result.bankName).toBe('Kotak Mahindra Bank');
      expect(result.branchName).toBe('BANGALORE - HSR LAYOUT');
      expect(result.ifscCode).toBe('KKBK0008112');
      expect(result.address?.line1).toBe('No 01 Royal Placid Phase I, PWD Quaters, Harlur Road');
      expect(result.address?.city).toBe('Bengaluru');
      expect(result.address?.state).toBe('Karnataka');
      expect(result.address?.pincode).toBe('560102');
      expect(result.line1).toBe('No 01 Royal Placid Phase I, PWD Quaters, Harlur Road');
      expect(result.city).toBe('Bengaluru');
      expect(result.state).toBe('Karnataka');
      expect(result.pincode).toBe('560102');
      expect(result.dob).toBeUndefined();
      expect(result.panNumber).toBeUndefined();
    });

    it('extracts UAN number without false mismatch rejection when document mentions Aadhaar or Government text', async () => {
      const dummyBase64 = 'mock-uan-with-aadhaar-mention';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `EMPLOYEES' PROVIDENT FUND ORGANISATION
Government of India
Universal Account Number (UAN) Member Card
UAN: 101234567890
Name: Sudhan M
Aadhaar: Verified
Member ID: PYKRP00123450000001`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'UAN', 'image/jpeg');

      expect(result.uanNumber).toBe('101234567890');
      expect(result._documentMismatch).toBe(false);
      expect(result._requiredDataMissing).toBe(false);
    });

    it('sets _requiredDataMissing when uploaded document lacks required fields after upload', async () => {
      const dummyBase64 = 'mock-blank-doc';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `Random notes and guidelines with no numbers or details`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'UAN', 'image/jpeg');

      expect(result.uanNumber).toBeUndefined();
      expect(result._requiredDataMissing).toBe(true);
      expect(result.errorMessage).toContain('Required UAN details could not be found');
    });

    it('accurately extracts Father Name from noisy S/O iar Dass on Aadhaar Back and leaves clean address line 1', async () => {
      const dummyBase64 = 'mock-aadhaar-back-noisy';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `Address:
S/O iar Dass, S16/A, OM SHAKTHI csiy ae COMPLEX, THIRUCHI ROAD, Silapadi Ear apcoor nad Ora apcs sued Tam Nicks, Dindigul, - 624005
Mobile: 9008885355`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'idBack', 'image/jpeg');

      expect(result.fatherName).toBe('MARI DASS');
      expect(result.address?.line1).not.toContain('S/O');
      expect(result.address?.line1).toContain('516/A');
      expect(result.address?.line1).toContain('THIRUCHI ROAD');
      expect(result.address?.city).toBe('Dindigul');
      expect(result.address?.pincode).toBe('624005');
      expect(result.phone).toBe('9008885355');
    });

    it('accurately extracts Aadhaar number even with OCR substitutions like B for 8 and variable spacing', async () => {
      const dummyBase64 = 'mock-aadhaar-front-ocr-noise';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `Government of India
Sudhan M
DOB: 16/10/1995
MALE
Aadhaar is proof of identity, not of citizenship.
4852 15B7 3813 |`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'idFront', 'image/jpeg');

      expect(result._offlineFallback).toBe(true);
      expect(result.aadhaarNumber).toBe('485215873813');
      expect(result.name).toBe('Sudhan M');
      expect(result.dob).toBe('1995-10-16');
      expect(result.gender).toBe('Male');
      expect(result._requiredDataMissing).toBe(false);
    });

    it('rejects Kannada OCR noise like Sq Sy rowSD and correctly extracts Sudhan M', async () => {
      const dummyBase64 = 'mock-aadhaar-kannada-noise';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `Government of India
Sq Sy rowSD
Sudhan M
DOB: 16/10/1995
Male
4852 1587 3813
VID : 9112 4381 0767 1797`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'idFront', 'image/jpeg');

      expect(result._offlineFallback).toBe(true);
      expect(result.name).toBe('Sudhan M');
      expect(result.dob).toBe('1995-10-16');
      expect(result.gender).toBe('Male');
      expect(result.aadhaarNumber).toBe('485215873813');
    });

    it('extracts candidate name when combined on same line as DOB', async () => {
      const dummyBase64 = 'mock-aadhaar-sameline-dob';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1);
      (worker.recognize as any).mockResolvedValueOnce({
        data: {
          text: `Government of India
Sudhan M DOB: 16/10/1995
MALE
4852 1587 3813`
        }
      });

      const result = await extractDataOffline(dummyBase64, 'idFront', 'image/jpeg');

      expect(result.name).toBe('Sudhan M');
      expect(result.dob).toBe('1995-10-16');
      expect(result.gender).toBe('Male');
    });
  });
});


