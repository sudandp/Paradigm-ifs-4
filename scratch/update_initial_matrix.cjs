const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/initialSiteResponsibilityData.ts');
let content = fs.readFileSync(filePath, 'utf8');

const updated = content.replaceAll('"hrInchargeName": "Chandana R"', '"hrInchargeName": "Chennamma"');

fs.writeFileSync(filePath, updated, 'utf8');
const remaining = (updated.match(/Chandana/g) || []).length;
console.log('Updated initialSiteResponsibilityData.ts. Remaining Chandana:', remaining);
