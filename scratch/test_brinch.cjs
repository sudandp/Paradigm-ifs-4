const text = `INDLA Ebi eens
Branch fel. No. > S884-444\\53
Branch MICR + 360485063
Branch ESC + KRBKOOOSII2

CRN So.
Account Number 1446985237,
— Namefs) 5 Satyam Batista
Mode of Operiution : SINGLY
Brinch tame : BANGALORE - HSR LAYOUT
Bruch Code +, St12`;

const branchRegex = /(?:Br[ai]nch\s*(?:name|tame|nisme|ume|office)?|Br\.\s*Name)[:\s~¢=.\-]+([A-Za-z0-9\s-]+?)(?:\n|Branch|Br[ai]nch|Address|Code|MICR|IFSC|Tel|fel|$)/i;

// Match all matches to see what matches
const matches = [...text.matchAll(new RegExp(branchRegex.source, 'gi'))];
for (const m of matches) {
  const cand = m[1].trim();
  const isExcluded = /^(?:tel|fel|phone|code|micr|ifsc|address|name|tame|nisme|ume)\b/i.test(cand);
  console.log('Candidate:', JSON.stringify(cand), 'excluded:', isExcluded);
}
