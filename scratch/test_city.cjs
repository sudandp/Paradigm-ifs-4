const raw = `= wz 4
a
y =
SS Se # ee
ee) kotak
. OS BF Kotak hatindes
Oe if Belt tips? aa
CRN + 714103000 eee ee a en a
; BALE, Recreate Ser tr eV APR Wg nd oi men a reer g see So ee
fm Avcount Number, atten rg ne ees Mode at Operations 22 SINGLY
Name(s): Sal gae Savaninaisncn: © > alee Branch ume = BANGALORE-HSLAYOUT
cl ty ae Bore RS eae Gill Codes ee
5 Adthuesss |, eT a Me Poaee a Ie teen eee
woeAdiress “2 SEE Wenp Roca pike pron os ze Fen oe
DF Aeros = NOD Roval pincidiPhmeey = Branch Address: KOTAK MAHINDRABANK LID:
PAID Quaters Ht Ist Sector as ses FAWA2TTEEMAIN: SECTOR-IHSR LAY!
Be Fehyo a <> HarlurRoad Bangalore” ise sjpabiiee: 240/48 270H MAIN SECTOR-H HSR LAY!
a ee aes Sea Need els Se ie : vee BANGALORE fale
—— seGengaliri —SOOI0R eee ee ee BENGALURU-soolog?
Karnataka i — eamaaer i ee cae Pe
INDIA INDIA .
Preferred Contact No. : 8951731669 Branch Tel. No. > SS8444153
Account Opening Date ; 25-02-2023 Branch MICK + 360485063
Nominee Rewistercd 7 No Branch ESC: + KRBKOOOSII2
Nominee Name 3
(As Registered with the Bank)
This isa system generated pasbber and does Hot require sino wte ah staine

oS Reo keeles ree pitts
anid SS 2 a are eae ees
Reedy igre aoe as BC Rt Ss
CRN > TI4103000
Account Number + 1446955237 me iia!
Name(s) + Satyam Baishya <a
“ Lane 5) ee ees
Avliteacec FES a NS Te Ay tat oe

On ae e kota
pees ; jh Bee iy Kotak stan
4 ea he inbon neg?
Mode of Operiution : SINGLY
Brinch tame : BANGALORE - HSR LAYOUT
Bruch Code +, St12

INDLA Ebi eens
Branch fel. No. > S884-444\\53
Branch MICR + 360485063
Branch ESC + KRBKOOOSII2

CRN So.
Account Number 1446985237,
— Namefs) 5 Satyam Batista
\\ a\\daress: HOOT Royal Placid Phase |
r Surlur Road Banvalor 2
Karnataka ie :
IND IA
Preferred Contact No, : 8931731669
Account Opening Date : 25-02-2023
Nominee Revistered : No
Nominee Nuime $2`;

const flat = raw.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');

const PIN_DISTRICT_MAP = {
  '624': 'Dindigul',
  '560': 'Bengaluru',
};

const resolveCity = (flatText, pincode) => {
  if (pincode && PIN_DISTRICT_MAP[pincode.substring(0, 3)]) {
    return PIN_DISTRICT_MAP[pincode.substring(0, 3)];
  }
  const cityM = flatText.match(/(?:VTC|District|DIST|City)[:\s]*([A-Za-z ]{3,30})/i);
  if (cityM && cityM[1].trim().length >= 3) {
    return cityM[1].trim();
  }
  const cityBeforeState = flatText.match(/([A-Za-z]{3,20})(?:\s+Tamil\s*Nadu|\s*,\s*Tamil\s*Nadu|\s*[-–]?\s*[0-9]{6})/i);
  if (cityBeforeState) {
    const raw = cityBeforeState[1].trim();
    if (raw.toLowerCase().startsWith('dindig')) return 'Dindigul';
    return raw;
  }
  return '';
};

console.log('resolveCity result:', resolveCity(flat));
console.log('city regex match:', flat.match(/(?:VTC|District|DIST|City)[:\s]*([A-Za-z ]{3,30})/i));
