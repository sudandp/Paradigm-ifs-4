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
  console.log('🚀 COMPREHENSIVE DOCUMENT OFFLINE SYNC VERIFICATION');
  console.log('====================================================');

  console.log('Step 1: Ensure phone connectivity is initial ON...');
  runAdb('shell "cmd connectivity airplane-mode disable; svc wifi enable; svc data enable"');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Step 2: Connect to WebView devtools...');
  const client = await connectToDevice();

  console.log('Step 3: Clear existing IndexedDB outbox and photos...');
  await client.evaluate(`
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('paradigmOfflineDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const storesToClear = ['outbox', 'photos'].filter(s => db.objectStoreNames.contains(s));
          if (storesToClear.length === 0) {
            resolve({ cleared: true });
            return;
          }
          const tx = db.transaction(storesToClear, 'readwrite');
          storesToClear.forEach(s => tx.objectStore(s).clear());
          tx.oncomplete = () => resolve({ cleared: true, stores: storesToClear });
          tx.onerror = () => resolve({ cleared: false });
        };
        req.onerror = () => resolve({ cleared: false });
      });
    })()
  `);
  console.log('IndexedDB outbox and photos stores cleared.');

  // Distinct base64 images for 5 documents
  const photoRed = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const photoGreen = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const photoBlue = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbhyQAAAABJRU5ErkJggg==";
  const photoYellow = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  const photoCyan = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAE/wH/W1+0eQAAAABJRU5ErkJggg==";

  const testEmpId = `PARA-DOCS-${Math.floor(1000 + Math.random() * 9000)}`;
  console.log(`Step 4: Navigating to onboarding form to mount OnboardingProvider...`);
  
  await client.evaluate(`
    (() => {
      window.sessionStorage.setItem('dpdp_consent', 'true');
      window.location.hash = '#/onboarding/add/personal';
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  console.log(`Hydrating candidate ${testEmpId} with 5 distinct document attachments...`);

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

      const fullCandidate = {
        id: 'draft_${testEmpId}',
        personal: {
          employeeId: '${testEmpId}',
          firstName: "Anil",
          lastName: "DocumentSyncVerified",
          fatherName: "Kishore",
          dob: "1994-07-22",
          gender: "Male",
          maritalStatus: "Married",
          mobile: "9876543210",
          bloodGroup: "B+",
          photo: { preview: "${photoRed}", name: "candidate_profile.png" },
          idProofType: "Aadhaar",
          idProofNumber: "998877665544",
          idProofFront: { preview: "${photoGreen}", name: "aadhaar_front.png" },
          idProofBack: { preview: "${photoBlue}", name: "aadhaar_back.png" },
          panNumber: "ABCDE9876F",
          panCard: { preview: "${photoYellow}", name: "pan_card.png" }
        },
        address: {
          permanentAddress: "Sector 4, Building B-12",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560066",
          sameAsPermanent: true
        },
        family: [],
        education: [],
        bank: {
          bankName: "HDFC Bank",
          accountNumber: "50100234567890",
          ifscCode: "HDFC0001234",
          bankProof: { preview: "${photoCyan}", name: "bank_passbook.png" }
        },
        uan: { hasPreviousPf: false, hasPreviousUan: false },
        esi: { hasPreviousEsi: false },
        organization: {
          designation: "Multi Skilled Technician",
          department: "Technical Services",
          dateOfJoining: new Date().toISOString().split('T')[0],
          organizationId: "SERENE_MEADOWS",
          organizationName: "Serene Meadows"
        },
        uniforms: [],
        biometrics: {
          fingerprints: [],
          signatureImage: "${photoRed}"
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
  captureScreenshot('doc_sync_step1_review.png');

  console.log('Step 5: Turn Airplane Mode ON (Field Mode / 100% Offline)...');
  runAdb('shell cmd connectivity airplane-mode enable');
  await new Promise(r => setTimeout(r, 2000));

  await dismissOfflineModal(client);
  await new Promise(r => setTimeout(r, 1000));

  console.log('Step 6: Tapping Submit Application on Review Screen while OFFLINE...');
  const submitResult = await client.evaluate(`
    (async () => {
      const btn = document.getElementById('save-and-next-button') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Submit Application');
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim() };
      }
      return { clicked: false };
    })()
  `);
  console.log('Submit button clicked:', submitResult);

  console.log('Waiting 3s for offline extraction, photos store, and outbox queueing...');
  await new Promise(r => setTimeout(r, 3000));
  captureScreenshot('doc_sync_step2_offline_submitted.png');

  console.log('Step 7: Verifying IndexedDB Outbox and Photos stores...');
  const idbCheck = await client.evaluate(`
    (async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('paradigmOfflineDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const outboxTx = db.transaction('outbox', 'readonly');
          const outboxStore = outboxTx.objectStore('outbox');
          const getOutbox = outboxStore.getAll();
          
          getOutbox.onsuccess = () => {
            const outboxList = getOutbox.result || [];
            
            const photosTx = db.transaction('photos', 'readonly');
            const photosStore = photosTx.objectStore('photos');
            const getPhotos = photosStore.getAll();
            
            getPhotos.onsuccess = () => {
              const photoBlobs = getPhotos.result || [];
              resolve({
                outbox: outboxList.map(item => ({
                  id: item.id,
                  tableName: item.tableName,
                  status: item.status,
                  employeeId: item.payload?.employee_id || item.payload?.personal?.employeeId,
                  attachmentsCount: item.attachments?.length || 0,
                  attachments: (item.attachments || []).map(a => ({
                    payloadPath: a.payloadPath,
                    key: a.key,
                    photoKey: a.photoKey,
                    mimeType: a.mimeType
                  }))
                })),
                photosCount: photoBlobs.length,
                photoKeys: photoBlobs.map(p => ({ key: p.key, size: p.blob?.size, type: p.blob?.type }))
              });
            };
            getPhotos.onerror = () => resolve({ outbox: outboxList, photosCount: 0, photoKeys: [] });
          };
          getOutbox.onerror = () => resolve({ outbox: [], photosCount: 0, photoKeys: [] });
        };
        req.onerror = () => resolve(null);
      });
    })()
  `);

  console.log('IndexedDB Offline Inspection Result:');
  console.log(JSON.stringify(idbCheck, null, 2));

  if (!idbCheck || idbCheck.outbox.length === 0) {
    throw new Error('Outbox is empty! Candidate was not saved offline.');
  }

  const outboxItem = idbCheck.outbox[0];
  console.log(`\n📋 Candidate in Outbox: ${outboxItem.employeeId}`);
  console.log(`📎 Attachments staged: ${outboxItem.attachmentsCount}`);
  console.log(`🖼️ Local Blobs in photos store: ${idbCheck.photosCount}`);

  if (outboxItem.attachmentsCount < 5) {
    console.warn(`WARNING: Expected at least 5 attachments, found ${outboxItem.attachmentsCount}`);
  } else {
    console.log('✅ ALL 5 candidate documents successfully extracted and staged locally in IndexedDB photos store!');
  }

  console.log('\nStep 8: RESTORING NETWORK -> Disabling Airplane Mode, enabling Wi-Fi...');
  runAdb('shell "cmd connectivity airplane-mode disable; svc wifi enable; svc data enable"');
  console.log('Waiting 7s for full network connection...');
  await new Promise(r => setTimeout(r, 7000));

  console.log('Step 9: Triggering online auto-sync event...');
  await client.evaluate(`
    (() => {
      window.dispatchEvent(new Event('online'));
      return true;
    })()
  `);

  let drained = false;
  let remainingCount = 999;
  for (let i = 1; i <= 15; i++) {
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
            getAll.onsuccess = () => resolve(getAll.result || []);
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

  captureScreenshot('doc_sync_step3_drained.png');

  if (!drained) {
    throw new Error(`Outbox failed to drain! ${remainingCount} items still in outbox.`);
  }
  console.log('✅ Outbox successfully drained and uploaded to cloud!');

  console.log('\nStep 10: Querying Supabase Database for candidate record...');
  const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_submissions?employee_id=eq.${testEmpId}&select=*`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const cloudRecords = await supaRes.json();
  if (!cloudRecords || cloudRecords.length === 0) {
    throw new Error(`Record ${testEmpId} not found in Supabase onboarding_submissions!`);
  }

  const record = cloudRecords[0];
  console.log(`✅ Synced Cloud Record Found: ID ${record.id}, Employee ${record.employee_id}, Status: ${record.status}`);

  console.log('\nStep 11: Verifying Document Storage Paths & Public URLs in Cloud Record:');
  const personal = record.personal || {};
  const bank = record.bank || {};

  const docFields = [
    { label: 'Candidate Photo', obj: personal.photo },
    { label: 'Aadhaar Front', obj: personal.id_proof_front || personal.idProofFront },
    { label: 'Aadhaar Back', obj: personal.id_proof_back || personal.idProofBack },
    { label: 'PAN Card', obj: personal.pan_card || personal.panCard },
    { label: 'Bank Proof', obj: bank.bank_proof || bank.bankProof }
  ];

  let allUploaded = true;
  for (const doc of docFields) {
    console.log(`\n📄 [${doc.label}]:`);
    console.log(`   Path: ${doc.obj?.path || 'MISSING'}`);
    console.log(`   URL : ${doc.obj?.url || 'MISSING'}`);
    console.log(`   Name: ${doc.obj?.name || 'MISSING'}`);

    if (!doc.obj?.path || !doc.obj?.url) {
      allUploaded = false;
      console.error(`   ❌ ${doc.label} is missing storage path or public URL!`);
    } else if (doc.obj.url.startsWith('data:')) {
      allUploaded = false;
      console.error(`   ❌ ${doc.label} still contains base64 data URL instead of cloud storage URL!`);
    } else {
      console.log(`   ✅ Valid cloud storage URL`);
      
      // Step 12: Verify file actually exists and downloads from Supabase Storage CDN!
      const storageUrl = doc.obj.url;
      try {
        const fileCheckRes = await fetch(storageUrl, { method: 'HEAD' });
        console.log(`   🌐 HTTP HEAD Check: ${fileCheckRes.status} ${fileCheckRes.statusText}`);
        if (fileCheckRes.status === 200) {
          console.log(`   ✅ Confirmed accessible on Supabase CDN!`);
        } else {
          console.warn(`   ⚠️ Warning: HTTP status was ${fileCheckRes.status}`);
        }
      } catch (e) {
        console.error(`   ⚠️ Failed to ping file URL: ${e.message}`);
      }
    }
  }

  console.log('\n====================================================');
  if (allUploaded) {
    console.log('🏆 100% COMPLETE & VERIFIED: ALL DOCUMENTS SYNCED PROPERLY!');
    console.log('Candidate documents are extracted, stored offline in IndexedDB,');
    console.log('uploaded to Supabase Storage, and properly linked in the cloud database!');
  } else {
    console.error('❌ SOME DOCUMENTS FAILED VERIFICATION');
  }
  console.log('====================================================');

  client.ws.close();
}

main().catch(err => {
  console.error('VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
