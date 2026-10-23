import http from 'http';
import WebSocket from 'ws';

async function main() {
  console.log('Querying targets on port 9222...');
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  console.log('Found targets:', targets.map(t => ({ title: t.title, url: t.url })));
  const pageTarget = targets.find(t => t.type === 'page' || t.webSocketDebuggerUrl?.includes('/page/')) || targets[0];
  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    console.error('No valid page target found');
    process.exit(1);
  }

  console.log('Connecting to WebSocket...');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log('Connected to WebView!');
  let id = 1;
  const evalJs = (expr) => new Promise((resolve) => {
    const curId = id++;
    const handler = (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.id === curId) {
        ws.off('message', handler);
        resolve(parsed.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({
      id: curId,
      method: 'Runtime.evaluate',
      params: { expression: expr, returnByValue: true, awaitPromise: true }
    }));
  });

  const url = await evalJs('window.location.href');
  console.log('Current URL in app:', url?.value);

  // Check outbox count in IndexedDB
  const outboxCount = await evalJs(`
    new Promise((resolve) => {
      const req = indexedDB.open('paradigm_offline_db');
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('outbox')) return resolve(0);
        const tx = db.transaction('outbox', 'readonly');
        const countReq = tx.objectStore('outbox').count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(-1);
      };
      req.onerror = () => resolve(-2);
    })
  `);
  console.log('Offline outbox count in app:', outboxCount?.value);

  ws.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
