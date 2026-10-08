const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function inspect() {
  const buf = fs.readFileSync('public/templates/PIFS_Compliance_Data_Sheet.pdf');
  const doc = await PDFDocument.load(buf);
  console.log('Page count:', doc.getPageCount());
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    console.log('Page ' + (i + 1) + ': ' + width + ' x ' + height);
  }
}
inspect().catch(console.error);
