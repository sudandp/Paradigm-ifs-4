import WebSocket from 'ws';
import { execSync } from 'child_process';

const ADB = process.env.LOCALAPPDATA + '\\Android\\Sdk\\platform-tools\\adb.exe';
const ARTIFACT_DIR = 'C:\\Users\\sudhan\\.gemini\\antigravity-ide\\brain\\c5f0a64a-dd10-40a6-9949-8be62c20ab87';

function runAdb(cmd) {
  return execSync(`"${ADB}" -s R9ZL20MN6SD ${cmd}`).toString();
}

function captureScreenshot(filename) {
  const fullPath = `${ARTIFACT_DIR}\\${filename}`;
  execSync(`cmd /c ""${ADB}" -s R9ZL20MN6SD exec-out screencap -p > "${fullPath}""`);
  console.log(`Saved screenshot: ${filename}`);
  return fullPath;
}

async function main() {
  const sockets = runAdb('shell "cat /proc/net/unix | grep webview_devtools"');
  const match = sockets.match(/@(webview_devtools_remote_\d+)/);
  const socketName = match[1];
  runAdb(`forward tcp:9222 localabstract:${socketName}`);
  await new Promise(r => setTimeout(r, 600));

  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let reqId = 1;
  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      const handler = (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.id === id) {
          ws.off('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res.result?.value;
  }

  const testEmpId = `PARA-TEST-${Date.now().toString().slice(-4)}`;
  console.log('Hydrating test draft for:', testEmpId);

  await evaluate(`
    (() => {
      const dummyPhoto = "data:image/jpeg;base64," + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const testDraft = {
        id: "draft_${testEmpId}",
        personal: {
          employeeId: "${testEmpId}",
          firstName: "Ramesh",
          lastName: "OfflineVerified",
          fatherName: "Suresh Kumar",
          dob: "1994-05-12",
          gender: "Male",
          maritalStatus: "Single",
          mobile: "9876543210",
          bloodGroup: "O+",
          photo: { preview: dummyPhoto, name: "candidate_photo.jpg" },
          idProofType: "Aadhaar",
          idProofNumber: "998877665544",
          idProofFront: { preview: dummyPhoto, name: "aadhaar_front.jpg" },
          idProofBack: { preview: dummyPhoto, name: "aadhaar_back.jpg" },
          panNumber: "ABCDE1234F",
          panCard: { preview: dummyPhoto, name: "pan_card.jpg" }
        },
        address: {
          permanentAddress: "123 Green Valley, Site 4",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          sameAsPermanent: true
        },
        family: { members: [] },
        education: { qualifications: [] },
        bank: {
          bankName: "State Bank of India",
          accountNumber: "12345678901",
          ifscCode: "SBIN0001234",
          bankProof: { preview: dummyPhoto, name: "cancelled_cheque.jpg" }
        },
        uan: { hasPreviousPf: false, hasPreviousUan: false },
        esi: { hasPreviousEsi: false },
        organization: {
          designation: "Housekeeping Staff",
          department: "Housekeeping",
          dateOfJoining: new Date().toISOString().split('T')[0],
          organizationId: "SERENE_MEADOWS",
          organizationName: "Serene Meadows"
        },
        status: "draft"
      };

      window.sessionStorage.setItem('dpdp_consent', 'true');
      window.localStorage.setItem('dpdp_consent_draft_${testEmpId}', 'true');
      window.localStorage.setItem('paradigm_onboarding_draft', JSON.stringify({
        state: { data: testDraft },
        version: 0
      }));
      window.location.hash = '#/onboarding/add/review';
      window.location.reload();
    })()
  `);

  console.log('Reload triggered. Waiting 3.5s...');
  await new Promise(r => setTimeout(r, 3500));
  captureScreenshot('phone_test_rehydrated_review.png');
  ws.close();
}

main().catch(console.error);
