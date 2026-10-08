const fs = require('fs');
const pdf = require('pdf-parse');

async function check() {
  const buf = fs.readFileSync('public/templates/PIFS_Compliance_Data_Sheet.pdf');
  const data = await pdf(buf);
  // pdf-parse gives full text
  const pages = data.text.split('\n\n');
  console.log('Text near end:');
  console.log(data.text.slice(-1500));
}
check().catch(console.error);
