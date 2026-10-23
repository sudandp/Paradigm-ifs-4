import WebSocket from 'ws';
import { execSync } from 'child_process';

const ADB = process.env.LOCALAPPDATA + '\\Android\\Sdk\\platform-tools\\adb.exe';

async function main() {
  const sockets = execSync(`"${ADB}" -s R9ZL20MN6SD shell "cat /proc/net/unix | grep webview_devtools"`).toString();
  const match = sockets.match(/@(webview_devtools_remote_\d+)/);
  if (!match) {
    console.error('No webview socket found');
    process.exit(1);
  }
  const socketName = match[1];
  console.log('Found webview socket:', socketName);
  execSync(`"${ADB}" -s R9ZL20MN6SD forward tcp:9222 localabstract:${socketName}`);
  await new Promise(r => setTimeout(r, 600));

  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!pageTarget) {
    console.error('No page target found', targets);
    process.exit(1);
  }

  console.log('Connecting to', pageTarget.title, pageTarget.url);
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

  // Check state
  const state = await evaluate(`
    (async () => {
      const auth = window.localStorage.getItem('paradigm_auth_storage');
      let outboxItems = [];
      try {
        const req = indexedDB.open('paradigm_offline_v2', 2);
        outboxItems = await new Promise((resolve) => {
          req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('outbox')) return resolve([]);
            const tx = db.transaction('outbox', 'readonly');
            const store = tx.objectStore('outbox');
            const getAll = store.getAll();
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => resolve([]);
          };
          req.onerror = () => resolve([]);
        });
      } catch (e) {
        outboxItems = ['err: ' + e.message];
      }

      return {
        href: window.location.href,
        online: navigator.onLine,
        user: auth ? JSON.parse(auth)?.state?.user?.name : null,
        userId: auth ? JSON.parse(auth)?.state?.user?.id : null,
        outboxCount: outboxItems.length,
        outboxItems: outboxItems.map(i => ({ id: i.id, table: i.tableName, status: i.status, error: i.lastError }))
      };
    })()
  `);

  console.log('App state:', JSON.stringify(state, null, 2));

  // If there's an item stuck in the outbox, let's trigger syncEngine.drain() now that the fix is applied!
  if (state.outboxCount > 0) {
    console.log('Triggering drain on existing outbox items with the new fix...');
    const drainResult = await evaluate(`
      (async () => {
        try {
          const mod = await import('/services/offline/syncEngine.ts');
          const res = await mod.drain();
          return { success: true, res };
        } catch (e) {
          return { success: false, err: e.message, stack: e.stack };
        }
      })()
    `);
    console.log('Drain result:', JSON.stringify(drainResult, null, 2));

    // Re-check outbox items
    const afterDrain = await evaluate(`
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
    console.log('Outbox items after drain:', JSON.stringify(afterDrain, null, 2));
  }

  ws.close();
}

main().catch(console.error);
