import WebSocket from 'ws';
import { execSync } from 'child_process';

const ADB = process.env.LOCALAPPDATA + '\\Android\\Sdk\\platform-tools\\adb.exe';

async function main() {
  const sockets = execSync(`"${ADB}" -s R9ZL20MN6SD shell "cat /proc/net/unix | grep webview_devtools"`).toString();
  const match = sockets.match(/@(webview_devtools_remote_\d+)/);
  const socketName = match[1];
  execSync(`"${ADB}" -s R9ZL20MN6SD forward tcp:9222 localabstract:${socketName}`);
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

  const res = await sendCommand('Runtime.evaluate', {
    expression: `
      (async () => {
        return new Promise((resolve) => {
          const req = indexedDB.open('paradigmOfflineDB');
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('outbox', 'readonly');
            const store = tx.objectStore('outbox');
            const getAll = store.getAll();
            getAll.onsuccess = () => resolve({
              version: db.version,
              stores: Array.from(db.objectStoreNames),
              items: getAll.result.map(i => ({
                id: i.id,
                tableName: i.tableName,
                status: i.status,
                empId: i.payload?.employee_id || i.payload?.personal?.employeeId,
                lastError: i.lastError,
                failureReason: i.failureReason
              }))
            });
            getAll.onerror = (err) => resolve({ error: err.target.error.message });
          };
          req.onerror = (err) => resolve({ openError: err.target.error.message });
        });
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('IDB Inspect:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
