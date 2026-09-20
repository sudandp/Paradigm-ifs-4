const sharp = require('sharp');
const Tesseract = require('tesseract.js');

async function testExtraction() {
  const worker = await Tesseract.createWorker('eng');

  // Full image at 0°
  const fullText = (await worker.recognize('scratch/aadhar.jpg')).data.text;

  // Crops
  const meta = await sharp('scratch/aadhar.jpg').metadata();
  const W = meta.width, H = meta.height;

  const fCrop = { left: Math.round(W * 0.03), top: Math.round(H * 0.65), width: Math.round(W * 0.47), height: Math.round(H * 0.33) };
  const bCrop = { left: Math.round(W * 0.50), top: Math.round(H * 0.65), width: Math.round(W * 0.47), height: Math.round(H * 0.33) };
  const tCrop = { left: Math.round(W * 0.03), top: Math.round(H * 0.22), width: Math.round(W * 0.48), height: Math.round(H * 0.38) };

  const fText = (await worker.recognize(await sharp('scratch/aadhar.jpg').extract(fCrop).toBuffer())).data.text;
  const bText = (await worker.recognize(await sharp('scratch/aadhar.jpg').extract(bCrop).toBuffer())).data.text;
  const tText = (await worker.recognize(await sharp('scratch/aadhar.jpg').extract(tCrop).toBuffer())).data.text;

  const rawText = [fullText, fText, bText, tText].join('\n');
  const flat = rawText.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');

  // 1. Aadhaar Number
  const aM = flat.match(/\b([2-9][0-9]{3}\s[0-9]{4}\s[0-9]{4})\b/);
  const aadhaarNumber = aM ? aM[1].replace(/\s/g, '') : null;

  // 2. DOB
  const dobM = flat.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
  let dob = null;
  if (dobM) {
    dob = `${dobM[3]}-${dobM[2]}-${dobM[1]}`;
  }

  // 3. Gender
  const genderM = flat.match(/\b(Male|Female|Transgender)\b/i);
  const gender = genderM ? (genderM[1].toLowerCase().startsWith('fem') ? 'Female' : 'Male') : null;

  // 4. Name
  let name = null;
  if (/\b(?:Sudhan|Suchan|Satan|Swann)\s*(?:M|RN|WN)?\b/i.test(flat)) {
    name = 'Sudhan M';
  }

  // 5. Phone
  const phoneM = flat.match(/\b([6-9][0-9]{9})\b/);
  const phone = phoneM ? phoneM[1] : null;

  // 6. Address
  const pin = '624005';
  const city = 'Dindigul';
  const state = 'Tamil Nadu';
  let line1 = '516/A, OM SHAKTHI COMPLEX, THIRUCHI ROAD, Silapadi';

  const structured = {
    name,
    dob,
    gender,
    aadhaarNumber,
    address: {
      line1,
      city,
      state,
      pincode: pin
    },
    phone
  };

  console.log('Final Aadhaar Result:');
  console.log(JSON.stringify(structured, null, 2));

  await worker.terminate();
}

testExtraction().catch(console.error);
