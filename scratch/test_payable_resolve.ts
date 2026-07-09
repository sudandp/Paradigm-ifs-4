// Quick test: simulate resolvePayableValue for "0.5P+0.5 EL"
const resolvePayableValue = (s: string): number => {
    if (s.includes('+')) return s.split('+').reduce((acc, part) => acc + resolvePayableValue(part.trim()), 0);
    if (['W/P', 'H/P', 'BL/P', 'PL/P'].includes(s)) return 1.5; 
    if (['P', 'W/O', 'WOP', 'H', 'SL', 'S/L', 'EL', 'E/L', 'CL', 'C/L', 'C/O', 'CO', 'W/H', 'WH', 'BL', 'F/H', 'FH', 'PL', 'P/L', 'ML', 'M/L', 'CC', 'C/C', 'CCL'].includes(s)) return 1;
    // Handle half-day leave types (e.g. '0.5SL', '0.5WH', '0.5EL', '0.5CL')
    if (s.startsWith('0.5') && (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('WH') || s.includes('W/H') || s.includes('BL') || s.includes('PL') || s.includes('ML') || s.includes('CCL') || s.includes('CO') || s.includes('C/O'))) return 0.5;
    if (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('C/O') || s.includes('CO') || s.includes('BL') || s.includes('F/H') || s.includes('FH') || s.includes('PL') || s.includes('P/L') || s.includes('ML') || s.includes('M/L') || s.includes('CCL') || s.includes('WH') || s.includes('W/H')) {
        return s.startsWith('0.5') ? 0.5 : 1;
    }
    if (['Half Day', '0.5P', '1/2P', '2/4P'].includes(s)) return 0.5;
    if (s === '3/4P' || s === '0.75P') return 0.75;
    if (s === '1/4P' || s === '0.25P') return 0.25;
    if (s.endsWith('P') && s !== 'LOP') {
      const numericVal = parseFloat(s.slice(0, -1));
      if (!isNaN(numericVal)) return numericVal;
    }
    return 0;
};

// Test cases from the bug
const testCases = [
    '0.5P+0.5 EL',
    '0.5P+0.5 SL',
    '0.5P+0.5 CL',
    '0.5P',
    '0.5 EL',
    'EL',
    'Half Day',
];

for (const t of testCases) {
    console.log(`resolvePayableValue("${t}") = ${resolvePayableValue(t)}`);
}
