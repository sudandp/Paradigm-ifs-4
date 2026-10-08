const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function testEmbed() {
  const fileContent = fs.readFileSync('utils/reportLogos.ts', 'utf-8');
  const match = fileContent.match(/export const SOUTHWALL_LOGO_BASE64 = '([^']+)';/);
  if (!match) {
    console.error('Regex match failed');
    return;
  }
  const base64 = match[1];
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  
  const buffer = Buffer.from(base64, 'base64');
  const img = await doc.embedJpg(buffer);
  console.log('Successfully embedded SouthWall logo! Size:', img.width, img.height);
  
  page.drawImage(img, { x: 100, y: 700, width: 180, height: 60 });
  const pdfBytes = await doc.save();
  console.log('PDF saved successfully, bytes:', pdfBytes.length);
}
testEmbed().catch(console.error);
