const testText = `= wz 4
a
y =
SS Se # ee
ee) kotak
. OS BF Kotak Mahindra
Oe if Belt tips? aa
CRN + 714103000 eee ee a en a
; BALE, Recreate Ser tr eV APR Wg nd oi men a reer g see So ee
fm Account Number, atten rg ne ees Mode at Operations 22 SINGLY
Account Number : 1440955237
Name(s): Satyam Baishya
Branch name : BANGALORE - HSR LAYOUT
Branch Code : 8112
Branch Address: KOTAK MAHINDRABANK LTD
240/48 27TH MAIN SECTOR-II HSR LAYOUT
BANGALORE
BENGALURU - 560102
Karnataka INDIA
Preferred Contact No. : 8951731669
Account Opening Date ; 25-02-2023
Branch MICR : 560485063
Branch IFSC : KKBK0008112
Nominee Registered : No`;

const flat = testText.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');

const afterLabel = (label) => {
  const m = flat.match(new RegExp(label.source + '[:\\s]+([A-Za-z0-9 ./-]{2,60})', 'i'));
  return m ? m[1].trim() : null;
};

const nameRegex = /(?:Name\(s\)|Account\s*Holder(?:\s*Name)?|A\/C\s*Holder|Customer\s*Name|Account\s*Name|Beneficiary\s*Name)[:\s/|©®*+~¢-]+([A-Za-z\s.]{3,35}?)(?:\n|Branch|Address|Mode|Account|A\/c|CRN|Customer|Nominee|Preferred|$)/i;

console.log('afterLabel:', afterLabel(/(?:Account\s*Holder(?:\s*Name)?|A\/C\s*Holder|Customer\s*Name|Account\s*Name|Beneficiary\s*Name)/));
console.log('nameRegex match on testText:', testText.match(nameRegex));
console.log('nameRegex match on flat:', flat.match(nameRegex));
