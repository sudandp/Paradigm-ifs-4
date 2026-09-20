const CITY_BLACKLIST = new Set([
  'number', 'account', 'customer', 'branch', 'bank', 'name', 'tel', 'phone',
  'contact', 'date', 'opening', 'registered', 'nominee', 'quaters', 'quarters',
  'road', 'street', 'phase', 'sector', 'floor', 'door', 'plot', 'flat', 'mode',
  'operation', 'code', 'micr', 'ifsc', 'signature', 'photo'
]);

const resolveCity = (flatText, pincode) => {
  const PIN_DISTRICT_MAP = {
    '624': 'Dindigul',
    '560': 'Bengaluru',
  };
  if (pincode && PIN_DISTRICT_MAP[pincode.substring(0, 3)]) {
    return PIN_DISTRICT_MAP[pincode.substring(0, 3)];
  }
  // Check explicit Bengaluru / Bangalore / Chennai / etc mentions
  if (/\b(?:Bengaluru|Bangalore|Banvalor)\b/i.test(flatText)) return 'Bengaluru';
  if (/\b(?:Chennai|Madras)\b/i.test(flatText)) return 'Chennai';
  if (/\b(?:Mumbai|Bombay)\b/i.test(flatText)) return 'Mumbai';
  if (/\b(?:Hyderabad)\b/i.test(flatText)) return 'Hyderabad';
  if (/\b(?:Delhi|New Delhi)\b/i.test(flatText)) return 'New Delhi';

  const cityM = flatText.match(/(?:VTC|District|DIST|City)[:\s]*([A-Za-z ]{3,30})/i);
  if (cityM && cityM[1].trim().length >= 3) {
    const cand = cityM[1].trim();
    if (!CITY_BLACKLIST.has(cand.toLowerCase())) return cand;
  }
  const cityBeforeState = flatText.match(/([A-Za-z]{3,20})(?:\s+Tamil\s*Nadu|\s*,\s*Tamil\s*Nadu|\s*[-–]?\s*[0-9]{6})/i);
  if (cityBeforeState) {
    const raw = cityBeforeState[1].trim();
    if (!CITY_BLACKLIST.has(raw.toLowerCase())) {
      if (raw.toLowerCase().startsWith('dindig')) return 'Dindigul';
      return raw;
    }
  }
  return '';
};

console.log('City resolved from flat text:', resolveCity('Account Number 1446985237 Banvalor Karnataka', ''));
