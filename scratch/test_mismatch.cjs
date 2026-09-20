function validateDocType(detectedType, expectedType) {
  const normExpected = (() => {
    const l = (expectedType || '').toLowerCase();
    if (l.includes('pan')) return 'PAN';
    if (l.includes('aadhaar') || l.includes('idfront') || l.includes('idback')) return 'Aadhaar';
    if (l.includes('bank') || l.includes('cheque') || l.includes('passbook')) return 'Bank';
    if (l.includes('salary') || l.includes('payslip')) return 'Salary';
    if (l.includes('uan')) return 'UAN';
    return null;
  })();

  if (!normExpected || detectedType === 'Unknown' || detectedType === normExpected) {
    return { valid: true };
  }

  let msg = '';
  if (normExpected === 'PAN') {
    msg = `This is an ${detectedType} card, not a PAN card. Please upload a valid PAN card.`;
  } else if (normExpected === 'Aadhaar') {
    msg = `This is a ${detectedType} card, not an Aadhaar card. Please upload a valid Aadhaar card.`;
  } else if (normExpected === 'Bank') {
    msg = `This is an ${detectedType} document, not a Bank proof document. Please upload a valid Cheque or Passbook.`;
  } else {
    msg = `This is an ${detectedType} document, not a ${normExpected} document. Please upload the proper document.`;
  }

  return { valid: false, message: msg, detectedType, expectedType: normExpected };
}

console.log(validateDocType('Aadhaar', 'PAN'));
console.log(validateDocType('PAN', 'idFront'));
console.log(validateDocType('Bank', 'Aadhaar'));
console.log(validateDocType('Aadhaar', 'idFront'));
console.log(validateDocType('PAN', 'PAN'));
