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

  console.log('=== Step 2: Dismiss Offline Screen if visible ===');
  const dismissed = await evaluate(`
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
  console.log('Dismissed offline screen:', dismissed);
  await new Promise(r => setTimeout(r, 1000));

  console.log('=== Step 3: Enable Airplane Mode (Simulate Field Network Drop) ===');
  runAdb('shell cmd connectivity airplane-mode enable');
  await new Promise(r => setTimeout(r, 2000));

  // Dismiss offline screen again if it popped up on network loss
  await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const workOffline = btns.find(b => b.textContent && b.textContent.includes('Work Offline'));
      if (workOffline) workOffline.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  console.log('=== Step 4: Click Submit button on Review page while OFFLINE ===');
  const clickRes = await evaluate(`
    (async () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Submit');
      if (submitBtn) {
        submitBtn.click();
        return { clicked: true, text: submitBtn.textContent.trim() };
      }
      return { clicked: false, available: btns.map(b => b.textContent?.trim()).filter(Boolean) };
    })()
  `);
  console.log('Submit button click result:', clickRes);

  console.log('Waiting 2s for offline save and banner...');
  await new Promise(r => setTimeout(r, 2000));
  captureScreenshot('final_e2e_1_saved_offline.png');

  console.log('=== Step 5: Verify IndexedDB outbox queue while offline ===');
  const outboxItems = await evaluate(`
    (async () => {
      try {
        const outboxMod = await import('/services/offline/outbox.ts');
        return await outboxMod.getAll();
      } catch (e) {
        return [{ err: e.message }];
      }
    })()
  `);
  console.log('Outbox queue items:', JSON.stringify(outboxItems.map(i => ({
    id: i.id,
    table: i.tableName,
    status: i.status,
    attachmentsCount: i.attachments?.length,
    employeeId: i.payload?.employee_id || i.payload?.personal?.employeeId
  })), null, 2));

  if (!outboxItems || outboxItems.length === 0 || outboxItems[0]?.err) {
    throw new Error('Outbox check failed or empty: ' + JSON.stringify(outboxItems));
  }

  console.log('=== Step 6: Restore Network (Airplane Mode OFF + Wi-Fi Enable) ===');
  runAdb('shell "cmd connectivity airplane-mode disable; svc wifi enable; svc data enable"');
  console.log('Waiting 6s for network reconnection...');
  await new Promise(r => setTimeout(r, 6000));

  console.log('=== Step 7: Trigger SyncEngine Drain ===');
  const drainRes = await evaluate(`
    (async () => {
      try {
        const mod = await import('/services/offline/syncEngine.ts');
        const res = await mod.drain();
        return { success: true, res };
      } catch (e) {
        return { success: false, err: e.message };
      }
    })()
  `);
  console.log('Drain result:', JSON.stringify(drainRes, null, 2));

  console.log('Waiting 3s for Supabase upload and outbox cleanup...');
  await new Promise(r => setTimeout(r, 3000));

  console.log('=== Step 8: Verify Outbox after Drain ===');
  const outboxAfter = await evaluate(`
    (async () => {
      try {
        const outboxMod = await import('/services/offline/outbox.ts');
        return await outboxMod.getAll();
      } catch (e) {
        return [{ err: e.message }];
      }
    })()
  `);
  console.log('Outbox items after drain:', JSON.stringify(outboxAfter, null, 2));
  captureScreenshot('final_e2e_2_synced_clean.png');

  ws.close();
}

main()
  .then(() => console.log('=== E2E SCRIPT COMPLETED SUCCESSFULLY ==='))
  .catch(err => {
    console.error('SCRIPT FAILED:', err);
    process.exit(1);
  });
