const https = require('https');
const fs = require('fs');

// Parse .env.local manually - handle Windows \r\n
const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const idx = line.indexOf('=');
  if (idx === -1) return;
  const k = line.substring(0, idx).trim();
  let v = line.substring(idx + 1).trim();
  v = v.replace(/^["']|["']$/g, '');
  env[k] = v;
});

const apiKey = env.EXOTEL_API_KEY || '';
const apiToken = env.EXOTEL_API_TOKEN || '';
const accountSid = env.EXOTEL_ACCOUNT_SID || '';

console.log("=== EXOTEL CREDENTIAL DEBUG ===");
console.log("API Key       :", JSON.stringify(apiKey));
console.log("API Key length:", apiKey.length);
console.log("API Token     :", JSON.stringify(apiToken));
console.log("Token length  :", apiToken.length);
console.log("Account SID   :", JSON.stringify(accountSid));
console.log("");

// Test BOTH subdomains
const subdomains = ['api.in.exotel.com', 'api.exotel.com'];

function testSubdomain(subdomain) {
  return new Promise((resolve) => {
    const auth = Buffer.from(apiKey + ':' + apiToken).toString('base64');
    
    const postData = new URLSearchParams({
      From: "09513886363",
      To: "09513886363",
      CallerId: "09513886363"
    }).toString();

    const options = {
      hostname: subdomain,
      port: 443,
      path: `/v1/Accounts/${accountSid}/Calls/connect.json`,
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`--- Testing ${subdomain} (V1) ---`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`RESPONSE: ${data.substring(0, 200)}`);
        if (res.statusCode === 401) {
          console.log(`=> UNAUTHORIZED\n`);
        } else {
          console.log(`=> OK (Status ${res.statusCode})\n`);
        }
        resolve(res.statusCode);
      });
    });

    req.on('error', (e) => {
      console.error(`Error: ${e.message}\n`);
      resolve(0);
    });

    req.write(postData);
    req.end();
  });
}

function testV2(subdomain) {
  return new Promise((resolve) => {
    const auth = Buffer.from(apiKey + ':' + apiToken).toString('base64');

    console.log(`--- Testing ${subdomain} (V2) ---`);

    const req = https.request({
      hostname: subdomain,
      port: 443,
      path: `/v2/accounts/${accountSid}`,
      method: 'GET',
      headers: { 'Authorization': 'Basic ' + auth }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`RESPONSE: ${data.substring(0, 200)}`);
        if (res.statusCode !== 401) {
          console.log("=> Your credentials work on V2!\n");
        } else {
          console.log("=> UNAUTHORIZED on V2 too\n");
        }
        resolve(res.statusCode);
      });
    });
    req.on('error', (e) => { console.error(e.message); resolve(0); });
    req.end();
  });
}

(async () => {
  // Test V1 on both subdomains
  for (const sub of subdomains) {
    await testSubdomain(sub);
  }
  
  // Test V2 on both subdomains
  for (const sub of subdomains) {
    await testV2(sub);
  }
  
  console.log("=== DONE ===");
})();
