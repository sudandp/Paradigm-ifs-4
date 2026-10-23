import WebSocket from 'ws';
import { execSync } from 'child_process';
import fs from 'fs';

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
  console.log('=== Step 1: Forward webview and connect via CDP ===');
  const sockets = runAdb('shell "cat /proc/net/unix | grep webview_devtools"');
  const match = sockets.match(/@(webview_devtools_remote_\d+)/);
  if (!match) throw new Error('No webview socket');
  const socketName = match[1];
  runAdb(`forward tcp:9222 localabstract:${socketName}`);
  await new Promise(r => setTimeout(r, 600));

  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!pageTarget) throw new Error('No page target');

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

  console.log('=== Step 2: Accept Consent Gate if present ===');
  const consentHandled = await evaluate(`
    (() => {
      window.sessionStorage.setItem('dpdp_consent', 'true');
      const cbs = document.querySelectorAll('input[type="checkbox"]');
      cbs.forEach(cb => { if (!cb.checked) cb.click(); });
      const btns = Array.from(document.querySelectorAll('button'));
      const accept = btns.find(b => b.textContent && b.textContent.includes('Accept & Continue'));
      if (accept) {
        accept.click();
        return { clicked: true };
      }
      return { clicked: false, cbsCount: cbs.length };
    })()
  `);
  console.log('Consent handled:', consentHandled);
  await new Promise(r => setTimeout(r, 1000));

  console.log('=== Step 3: Populate Full Test Draft & Navigate to Review ===');
  const testEmpId = `PARA-OFFLINE-${Date.now().toString().slice(-4)}`;
  console.log('Generated Test Employee ID:', testEmpId);

  const draftSetup = await evaluate(`
    (async () => {
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
          idProofBack: { preview: dummyPhoto, name: "aadhaar_back.jpg" }
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
          documentProof: { preview: dummyPhoto, name: "bank_passbook.jpg" }
        },
        uan: { hasPreviousUan: false },
        esi: { hasPreviousEsi: false },
        organization: {
          designation: "Housekeeping Staff",
          department: "Housekeeping",
          dateOfJoining: new Date().toISOString().split('T')[0],
          organizationId: "SERENE_MEADOWS",
          organizationName: "Serene Meadows"
        },
        status: "pending"
      };

      window.localStorage.setItem('paradigm_onboarding_draft', JSON.stringify(testDraft));
      window.sessionStorage.setItem('dpdp_consent', 'true');
      window.location.hash = '#/onboarding/add/review';
      return { success: true, testEmpId: "${testEmpId}" };
    })()
  `);
  console.log('Draft setup:', draftSetup);
  await new Promise(r => setTimeout(r, 2500));
  captureScreenshot('phone_e2e_1_review_screen.png');

  console.log('=== Step 4: Turn Airplane Mode ON ===');
  runAdb('shell cmd connectivity airplane-mode enable');
  await new Promise(r => setTimeout(r, 1500));

  // Dismiss offline screen if shown by clicking "Work Offline"
  const offlineDismissed = await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const workOfflineBtn = btns.find(b => b.textContent && b.textContent.includes('Work Offline'));
      if (workOfflineBtn) {
        workOfflineBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log('Work offline clicked:', offlineDismissed);
  await new Promise(r => setTimeout(r, 1200));

  console.log('=== Step 5: Submit Application while OFFLINE ===');
  const submitResult = await evaluate(`
    (async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent && (b.textContent.includes('Submit Application') || b.textContent.includes('Submit')));
      if (submitBtn) {
        submitBtn.click();
        return { clicked: true, text: submitBtn.textContent };
      }
      return { clicked: false, available: btns.map(b => b.textContent?.trim()).filter(Boolean) };
    })()
  `);
  console.log('Submit button clicked:', submitResult);
  await new Promise(r => setTimeout(r, 2000));
  captureScreenshot('phone_e2e_2_submitted_offline.png');

  console.log('=== Step 6: Verify item is queued in IndexedDB outbox ===');
  const outboxCheck = await evaluate(`
    (async () => {
      const req = indexedDB.open('paradigm_offline_v2', 2);
      return new Promise((resolve) => {
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('outbox', 'readonly');
          const store = tx.objectStore('outbox');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => resolve([]);
        };
      });
    })()
  `);
  console.log('Outbox items while offline:', JSON.stringify(outboxCheck.map(i => ({
    id: i.id,
    tableName: i.tableName,
    status: i.status,
    attachmentsCount: i.attachments?.length,
    employeeId: i.payload?.employee_id || i.payload?.personal?.employeeId
  })), null, 2));

  if (!outboxCheck || outboxCheck.length === 0) {
    throw new Error('Outbox is empty! Offline save failed.');
  }

  console.log('=== Step 7: Restore Network (Airplane Mode OFF) ===');
  runAdb('shell cmd connectivity airplane-mode disable');
  console.log('Waiting 5s for network reconnection...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('=== Step 8: Trigger SyncEngine Drain ===');
  const syncResult = await evaluate(`
    (async () => {
      try {
        const mod = await import('/services/offline/syncEngine.ts');
        const drainStats = await mod.drain();
        return { success: true, drainStats };
      } catch (e) {
        return { success: false, err: e.message, stack: e.stack };
      }
    })()
  `);
  console.log('SyncEngine drain result:', JSON.stringify(syncResult, null, 2));

  console.log('=== Step 9: Verify outbox after sync ===');
  await new Promise(r => setTimeout(r, 2000));
  const outboxAfter = await evaluate(`
    (async () => {
      const req = indexedDB.open('paradigm_offline_v2', 2);
      return new Promise((resolve) => {
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('outbox', 'readonly');
          const store = tx.objectStore('outbox');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => resolve([]);
        };
      });
    })()
  `);
  console.log('Outbox items after drain:', JSON.stringify(outboxAfter, null, 2));
  captureScreenshot('phone_e2e_3_synced_cloud.png');

  ws.close();
  return testEmpId;
}

main()
  .then(id => console.log('=== SUCCESS! SUBMITTED & SYNCED EMPLOYEE ID:', id))
  .catch(err => {
    console.error('FAILED:', err);
    process.exit(1);
  });
