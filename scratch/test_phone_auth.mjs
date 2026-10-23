import WebSocket from 'ws';
import { execSync } from 'child_process';

const ADB = process.env.LOCALAPPDATA + '\\Android\\Sdk\\platform-tools\\adb.exe';

async function main() {
  const sockets = execSync(`"${ADB}" -s R9ZL20MN6SD shell cat /proc/net/unix`).toString();
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
      (async () => {
        try {
          // Import supabase client from bundle or test direct fetch
          const { Preferences } = window.Capacitor?.Plugins || {};
          const { value } = await Preferences.get({ key: 'sb-fmyafuhxlorbafbacywa-auth-token' });
          const parsed = JSON.parse(value);
          const token = parsed.access_token;
          const uid = parsed.user.id;

          const testBlob = new Blob(['Test storage content'], { type: 'text/plain' });
          const res = await fetch('https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/onboarding-documents/' + uid + '/test_doc.txt', {
            method: 'POST',
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU',
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'text/plain',
              'x-upsert': 'true'
            },
            body: testBlob
          });

          const resultJson = await res.json().catch(() => null);
          return {
            status: res.status,
            statusText: res.statusText,
            resultJson
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('WebView Storage Upload Test:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
