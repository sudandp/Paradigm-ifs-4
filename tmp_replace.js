const fs = require('fs');
const file = 'e:/backup/onboarding all files/Paradigm Office 4/components/hr/EntityForm.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/<DatePicker/g, '<Input type="date"');
content = content.replace(/import DatePicker from '\.\.\/ui\/DatePicker';\r?\n/, '');
fs.writeFileSync(file, content);
console.log('Replaced correctly!');
