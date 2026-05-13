
import fs from 'fs';

const content = fs.readFileSync('e:/backup/onboarding all files/Paradigm Office 4/pages/gate/RegisterGateUser.tsx', 'utf8');

const openDivs = (content.match(/<div/g) || []).length;
const closeDivs = (content.match(/<\/div>/g) || []).length;

const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;

const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log({ openDivs, closeDivs, openBraces, closeBraces, openParens, closeParens });

// Let's specifically check the printUser block
const printUserBlock = content.substring(content.indexOf('printUser && ('));
const blockOpenDivs = (printUserBlock.match(/<div/g) || []).length;
const blockCloseDivs = (printUserBlock.match(/<\/div>/g) || []).length;
console.log({ blockOpenDivs, blockCloseDivs });
