const lines = [
  'Name(s) : Satyam Baishya',
  'Name(s) + Satyam Baishya <a',
  '— Namefs) 5 Satyam Batista',
  'Name(s): Sal gae Savaninaisncn: © > alee Branch ume = BANGALORE-HSLAYOUT'
];

const nameRegex = /(?:Name(?:\s*[\(\[f]\s*s\s*[\)\]]|\s*\(s\)|\(s\)|s|\(5\))?|Account\s*Holder(?:\s*Name)?|A\/C\s*Holder|Customer\s*Name|Account\s*Name|Beneficiary\s*Name)[:\s/|©®*+~¢=>\-5]+([A-Za-z\s.]{3,35}?)(?:\n|Branch|Address|Mode|Account|A\/c|CRN|Customer|Nominee|Preferred|[<|#*~_\[\]=]|\s*$)/i;

for (const line of lines) {
  const m = line.match(nameRegex);
  console.log('Line:', line);
  console.log('Matched name:', m ? m[1].trim() : null);
}
