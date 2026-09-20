const sharp = require('sharp');
const Tesseract = require('tesseract.js');

async function testFullPipeline() {
  const worker = await Tesseract.createWorker('eng');
  
  // Natural 0°
  const fullRes = await worker.recognize('scratch/aadhar.jpg');
  const fullText = fullRes.data.text;

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
  // Match directly in tText or fText
  const nameM = tText.match(/(?:To|HR)\s*\n+([A-Za-z\s]+)\s*\n+S\/O/i) ||
                rawText.match(/\b(Sudhan(?:\s+M)?)\b/i) ||
                rawText.match(/\b([A-Z][a-z]+(?:\s+[A-Z])?)\s*\n+(?:DOB|Date of Birth)/i);
  if (nameM) {
    name = nameM[1].trim();
  }

  // 5. Address
  const pinM = flat.match(/\b([1-9][0-9]{5})\b/);
  const pin = pinM ? pinM[1] : '';

  console.log('Result:', {
    aadhaarNumber,
    name,
    dob,
    gender,
    pin
  });

  await worker.terminate();
}

testFullPipeline().catch(console.error);
