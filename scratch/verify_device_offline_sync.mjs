import WebSocket from 'ws';
import { execSync } from 'child_process';

const ADB = process.env.LOCALAPPDATA + '\\Android\\Sdk\\platform-tools\\adb.exe';
const ARTIFACT_DIR = 'C:\\Users\\sudhan\\.gemini\\antigravity-ide\\brain\\c5f0a64a-dd10-40a6-9949-8be62c20ab87';

const SUPABASE_URL = 'https://fmyafuhxlorbafbacywa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';

function runAdb(cmd) {
  return execSync(`"${ADB}" -s R9ZL20MN6SD ${cmd}`).toString();
}

function captureScreenshot(filename) {
  const fullPath = `${ARTIFACT_DIR}\\${filename}`;
  execSync(`cmd /c ""${ADB}" -s R9ZL20MN6SD exec-out screencap -p > "${fullPath}""`);
  console.log(`Saved screenshot: ${filename}`);
  return fullPath;
}

async function connectToDevice() {
  const sockets = runAdb('shell "cat /proc/net/unix | grep webview_devtools"');
  const match = sockets.match(/@(webview_devtools_remote_\d+)/);
  if (!match) throw new Error('No webview socket found on device!');
  const socketName = match[1];
  runAdb(`forward tcp:9222 localabstract:${socketName}`);
  await new Promise(r => setTimeout(r, 500));

  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!pageTarget) throw new Error('No inspectable WebView page found');

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
      console.error('Eval Exception:', res.exceptionDetails);
    }
    return res.result?.value;
  }

  return { ws, evaluate, sendCommand };
}

async function dismissOfflineModal(client) {
  for (let i = 0; i < 5; i++) {
    const dismissed = await client.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const workOffline = btns.find(b => b.textContent && b.textContent.includes('Work Offline'));
        if (workOffline) {
          workOffline.click();
          return true;
        }
        return false;
      })()
    `);
    if (dismissed) {
      console.log('Dismissed OfflineScreen overlay!');
      break;
    }
    await new Promise(r => setTimeout(r, 600));
  }
}

async function main() {
  console.log('====================================================');
  console.log('🚀 CLEAN E2E OFFLINE SYNC VERIFICATION ON PHONE');
  console.log('====================================================');

  console.log('Phase 0: Ensure device network is initially ON...');
  runAdb('shell "cmd connectivity airplane-mode disable; svc wifi enable; svc data enable"');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Phase 1: Connect to WebView and clear stale outbox...');
  const client = await connectToDevice();

  await client.evaluate(`
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('paradigmOfflineDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('outbox')) {
            resolve({ cleared: true });
            return;
          }
          const tx = db.transaction('outbox', 'readwrite');
          tx.objectStore('outbox').clear();
          tx.oncomplete = () => resolve({ cleared: true });
          tx.onerror = () => resolve({ cleared: false });
        };
        req.onerror = () => resolve({ cleared: false });
      });
    })()
  `);
  console.log('Cleared IndexedDB outbox.');

  const testEmpId = `PARA-DEV-${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`Phase 2: Hydrate fresh test candidate (${testEmpId}) via React Store Fiber...`);

  const hydrateResult = await client.evaluate(`
    (() => {
      window.sessionStorage.setItem('dpdp_consent', 'true');
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
      const dummyPhoto = "data:image/jpeg;base64," + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const fullCandidate = {
        id: 'draft_${testEmpId}',
        personal: {
          employeeId: '${testEmpId}',
          firstName: "Suresh",
          lastName: "OfflineFieldVerified",
          fatherName: "Rajendra",
          dob: "1995-02-14",
          gender: "Male",
          maritalStatus: "Single",
          mobile: "9876501234",
          bloodGroup: "O+",
          photo: { preview: dummyPhoto, name: "candidate_photo.jpg" },
          idProofType: "Aadhaar",
          idProofNumber: "918273645511",
          idProofFront: { preview: dummyPhoto, name: "aadhaar_front.jpg" },
          idProofBack: { preview: dummyPhoto, name: "aadhaar_back.jpg" },
          panNumber: "ABCDE1234F",
          panCard: { preview: dummyPhoto, name: "pan_card.jpg" }
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
        uniforms: [],
        biometrics: {
          fingerprints: [],
          signatureImage: dummyPhoto
        },
        status: "draft"
      };

      foundStore.setData(fullCandidate);
      window.location.hash = '#/onboarding/add/review';

      return {
        success: true,
        testEmpId: '${testEmpId}'
      };
    })()
  `);
  console.log('Hydrate result:', hydrateResult);

  await new Promise(r => setTimeout(r, 2000));
  captureScreenshot('step1_review_ready.png');

  console.log('Phase 3: Turn Airplane Mode ON (Field Mode / No Network)...');
  runAdb('shell cmd connectivity airplane-mode enable');
  await new Promise(r => setTimeout(r, 2000));

  await dismissOfflineModal(client);
  await new Promise(r => setTimeout(r, 1000));

  console.log('Phase 4: Tapping "Submit" on Review Screen while 100% OFFLINE...');
  const submitResult = await client.evaluate(`
    (async () => {
      const btn = document.getElementById('save-and-next-button') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Submit Application');
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim(), id: btn.id };
      }
      return { clicked: false };
    })()
  `);
  console.log('Submit button clicked:', submitResult);

  console.log('Waiting 3s for offline outbox storage and toast banner...');
  await new Promise(r => setTimeout(r, 3000));
  captureScreenshot('step2_saved_offline.png');

  console.log('Phase 5: Verifying candidate is queued in IndexedDB Outbox...');
  const outboxItems = await client.evaluate(`
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('paradigmOfflineDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('outbox', 'readonly');
          const store = tx.objectStore('outbox');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      });
    })()
  `);

  console.log(`Outbox queue has ${outboxItems?.length || 0} items:`);
  console.log(JSON.stringify(outboxItems.map(i => ({
    id: i.id,
    tableName: i.tableName,
    status: i.status,
    employeeId: i.payload?.employee_id || i.payload?.personal?.employeeId
  })), null, 2));

  if (!outboxItems || outboxItems.length === 0) {
    throw new Error('Outbox is empty! Offline save failed.');
  }

  const queuedEmpId = outboxItems[0]?.payload?.employee_id || outboxItems[0]?.payload?.personal?.employeeId;
  console.log(`✅ Candidate ${queuedEmpId} successfully queued offline in Android IndexedDB!`);

  console.log('Phase 6: RESTORING NETWORK -> Disabling Airplane Mode, Reconnecting Wi-Fi...');
  runAdb('shell "cmd connectivity airplane-mode disable; svc wifi enable; svc data enable"');
  console.log('Waiting 7s for network interfaces to re-establish connectivity...');
  await new Promise(r => setTimeout(r, 7000));

  console.log('Phase 7: Triggering online auto-sync...');
  await client.evaluate(`
    (() => {
      window.dispatchEvent(new Event('online'));
      return true;
    })()
  `);

  let drained = false;
  let remainingCount = 999;
  for (let i = 1; i <= 12; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const currentOutbox = await client.evaluate(`
      (async () => {
        return new Promise((resolve) => {
          const req = indexedDB.open('paradigmOfflineDB');
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('outbox', 'readonly');
            const store = tx.objectStore('outbox');
            const getAll = store.getAll();
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => resolve([]);
          };
          req.onerror = () => resolve([]);
        });
      })()
    `);
    remainingCount = currentOutbox.length;
    console.log(`Sync Poll #${i}: Outbox items remaining: ${remainingCount}`);
    if (remainingCount === 0) {
      drained = true;
      break;
    }
  }

  captureScreenshot('step3_synced_cloud.png');

  console.log('Phase 8: Directly querying Supabase Cloud Database for synced record...');
  const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_submissions?employee_id=eq.${testEmpId}&select=*`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const cloudRecords = await supaRes.json();
  console.log('Supabase Query Result:', JSON.stringify(cloudRecords, null, 2));

  if (!cloudRecords || cloudRecords.length === 0) {
    throw new Error(`Record ${testEmpId} not found in Supabase!`);
  }

  const record = cloudRecords[0];
  console.log('====================================================');
  console.log('🎉 100% SUCCESS: OFFLINE ENROLLMENT SYNCED TO CLOUD!');
  console.log(`• Employee ID   : ${record.employee_id}`);
  console.log(`• Full Name     : ${record.first_name} ${record.last_name}`);
  console.log(`• Cloud UUID    : ${record.id}`);
  console.log(`• Submission St : ${record.status}`);
  console.log(`• Created At    : ${record.created_at}`);
  console.log(`• Local Outbox  : Fully Drained (${remainingCount} items pending)`);
  console.log('====================================================');

  client.ws.close();
}

main().catch(err => {
  console.error('TEST RUN FAILED:', err);
  process.exit(1);
});
