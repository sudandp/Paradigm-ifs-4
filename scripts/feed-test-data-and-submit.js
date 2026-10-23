import http from 'http';
import WebSocket from 'ws';

// Small 1x1 base64 transparent PNG for test documents
const DUMMY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const testEmployeeData = {
  id: `test_emp_offline_${Date.now()}`,
  personal: {
    employeeId: `PARA-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
    firstName: 'Ramesh',
    middleName: 'K',
    lastName: 'Kumar',
    fatherName: 'Suresh Kumar',
    dob: '1995-05-15',
    gender: 'Male',
    maritalStatus: 'Single',
    bloodGroup: 'O+',
    phone: '9876543210',
    emergencyContactName: 'Suresh Kumar',
    emergencyContactRelationship: 'Father',
    emergencyContactNumber: '9876543211',
    idProofType: 'Aadhaar Card',
    idProofNumber: '445566778899',
    aadhaarNumber: '445566778899',
    panNumber: 'ABCDE1234F',
    photo: { name: 'photo.png', preview: DUMMY_PNG, type: 'image/png' },
    idProofFront: { name: 'aadhaar_front.png', preview: DUMMY_PNG, type: 'image/png' },
    idProofBack: { name: 'aadhaar_back.png', preview: DUMMY_PNG, type: 'image/png' },
    panCard: { name: 'pan_card.png', preview: DUMMY_PNG, type: 'image/png' },
    verifiedStatus: { aadhaar: true, pan: true }
  },
  address: {
    present: { addressLine1: 'Site Camp Quarter', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', addressType: 'present' },
    permanent: { addressLine1: 'Village Post Office', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', addressType: 'permanent' },
    sameAsPresent: true
  },
  organization: {
    companyId: 'comp_1774527590821',
    companyName: 'Paradigm Services',
    organizationId: 'site_test_001',
    organizationName: 'Main Campus',
    site: 'Main Campus',
    designation: 'Multi-Skilled Technician',
    department: 'Technical',
    joiningDate: new Date().toISOString().split('T')[0],
    workType: 'Full-time',
    defaultSalary: 24500
  },
  family: [],
  education: [],
  bank: {
    accountHolderName: 'Ramesh Kumar',
    accountNumber: '98765432109876',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    branchName: 'Koramangala',
    bankProof: { name: 'passbook.png', preview: DUMMY_PNG, type: 'image/png' },
    verifiedStatus: true
  },
  uan: { hasPreviousPf: false },
  esi: { hasPreviousEsi: false },
  gmc: {},
  uniforms: [],
  biometrics: {},
  status: 'pending'
};

async function main() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page' || t.webSocketDebuggerUrl?.includes('/page/')) || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let id = 1;
  const evalJs = (expr) => new Promise((resolve, reject) => {
    const curId = id++;
    const handler = (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.id === curId) {
        ws.off('message', handler);
        if (parsed.error) reject(new Error(JSON.stringify(parsed.error)));
        else resolve(parsed.result?.result?.value);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({
      id: curId,
      method: 'Runtime.evaluate',
      params: { expression: expr, returnByValue: true, awaitPromise: true }
    }));
  });

  console.log('1. Setting full test draft into localStorage...');
  const jsonStr = JSON.stringify({ state: { data: testEmployeeData }, version: 0 });
  await evalJs(`localStorage.setItem('paradigm_onboarding_draft', ${JSON.stringify(jsonStr)})`);

  console.log('2. Reloading review page to hydrate draft...');
  await evalJs(`window.location.hash = '#/onboarding/add/review'; window.location.reload();`);

  console.log('Draft injected successfully!');
  ws.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
