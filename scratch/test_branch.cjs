const rawLine = 'Name(s): Sal gae Savaninaisncn: © > alee Branch ume = BANGALORE-HSLAYOUT';
const branchRegex = /(?:Branch\s*(?:name|nisme|ume|Code|Office)?|Br\.\s*Name)[:\s~¢=.\-]+([A-Za-z0-9\s-]+?)(?:\n|Branch|Address|$)/i;
console.log('branchRegex match:', rawLine.match(branchRegex));
