
import fs from 'fs';

const content = fs.readFileSync('e:/backup/onboarding all files/Paradigm Office 4/pages/gate/RegisterGateUser.tsx', 'utf8');

const printUserBlock = content.substring(content.indexOf('printUser && ('));

const openDivs = (printUserBlock.match(/<div(?!\s*\/>)/g) || []).length;
const closeDivs = (printUserBlock.match(/<\/div>/g) || []).length;

console.log({ openDivs, closeDivs });

// Find where they diverge
let stack = [];
const tokens = printUserBlock.match(/<div|<\/div>|<div[^>]*\/>/g);
tokens.forEach((token, i) => {
    if (token === '</div>') {
        if (stack.length === 0) {
            console.log('Extra closing tag at index', i);
        } else {
            stack.pop();
        }
    } else if (token.endsWith('/>')) {
        // self-closing, do nothing
    } else {
        stack.push(token);
    }
});
console.log('Remaining stack:', stack.length);
