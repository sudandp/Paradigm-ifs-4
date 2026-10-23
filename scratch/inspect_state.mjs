import WebSocket from 'ws';
import { execSync } from 'child_process';

const ADB = process.env.LOCALAPPDATA + '\\Android\\Sdk\\platform-tools\\adb.exe';

async function main() {
  const sockets = execSync(`"${ADB}" -s R9ZL20MN6SD shell "cat /proc/net/unix | grep webview_devtools"`).toString();
  const match = sockets.match(/@(webview_devtools_remote_\d+)/);
  execSync(`"${ADB}" -s R9ZL20MN6SD forward tcp:9222 localabstract:${match[1]}`);
  await new Promise(r => setTimeout(r, 400));

  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let reqId = 1;
  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = reqId++;
      ws.on('message', function h(msg) {
        const data = JSON.parse(msg.toString());
        if (data.id === id) { ws.off('message', h); resolve(data.result); }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const res = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const root = document.getElementById('root') || document.body;
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
        let fiber = root[key];
        
        let foundStore = null;
        let depth = 0;
        function traverse(f) {
          if (!f || depth > 250 || foundStore) return;
          depth++;
          if (f.memoizedState) {
            let s = f.memoizedState;
            while (s) {
              if (s.memoizedState && typeof s.memoizedState === 'object' && s.memoizedState.data && s.memoizedState.updatePersonal) {
                foundStore = s.memoizedState;
                return;
              }
              s = s.next;
            }
          }
          if (f.child) traverse(f.child);
          if (f.sibling) traverse(f.sibling);
        }
        traverse(fiber);

        if (!foundStore) return { success: false, err: 'Store not found' };

        window.__onboardingStore = foundStore;
        const testEmpId = 'PARA-DEV-' + Date.now().toString().slice(-4);
        const dummyPhoto = "data:image/jpeg;base64," + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

        const fullCandidate = {
          id: 'draft_' + testEmpId,
          personal: {
            employeeId: testEmpId,
            firstName: "Suresh",
            lastName: "FiberHydrated",
            fatherName: "Rajendra",
            dob: "1995-02-14",
            gender: "Male",
            maritalStatus: "Single",
            mobile: "9876501234",
            bloodGroup: "O+",
            photo: { preview: dummyPhoto, name: "photo.jpg" },
            idProofType: "Aadhaar",
            idProofNumber: "918273645511",
            idProofFront: { preview: dummyPhoto, name: "aadhaar_front.jpg" },
            idProofBack: { preview: dummyPhoto, name: "aadhaar_back.jpg" },
            panNumber: "ABCDE1234F",
            panCard: { preview: dummyPhoto, name: "pan.jpg" }
          },
          address: {
            permanentAddress: "Flat 202, Serene Meadows Phase 1",
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560066",
            sameAsPermanent: true
          },
          family: [],
          education: [],
          bank: {
            bankName: "State Bank of India",
            accountNumber: "20192837465",
            ifscCode: "SBIN0001234",
            bankProof: { preview: dummyPhoto, name: "cheque.jpg" }
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
          uniforms: [],
          biometrics: {
            fingerprints: [],
            signatureImage: dummyPhoto
          },
          status: "draft"
        };

        foundStore.setData(fullCandidate);
        return {
          success: true,
          testEmpId,
          updatedEmpId: foundStore.data.personal.employeeId
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Store update result:', res.result?.value);
  await new Promise(r => setTimeout(r, 1200));

  const checkState = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          missingDocsList: Array.from(document.querySelectorAll('li')).map(l => l.textContent?.trim()).filter(Boolean),
          buttons: Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent?.trim(),
            id: b.id,
            disabled: b.disabled
          }))
        };
      })()
    `,
    returnByValue: true
  });

  console.log('DOM check after store update:', JSON.stringify(checkState.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
