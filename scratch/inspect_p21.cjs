const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function inspectPage21() {
  const buf = fs.readFileSync('public/templates/PIFS_Compliance_Data_Sheet.pdf');
  const doc = await PDFDocument.load(buf);
  console.log('Total pages in template:', doc.getPageCount());
  const p21 = doc.getPage(20);
  console.log('Page 21 size:', p21.getSize());
}
inspectPage21();
