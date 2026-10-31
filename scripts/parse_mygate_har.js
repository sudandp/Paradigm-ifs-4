const fs = require('fs');

const raw = fs.readFileSync('download.devtools', 'utf8');
const har = JSON.parse(raw);

console.log('Total entries:', har.log.entries.length);

const apis = [];

for (const entry of har.log.entries) {
  const req = entry.request;
  const res = entry.response;
  const url = req.url;

  // Filter out google analytics, static chunks, fonts, images
  if (
    url.includes('google-analytics') ||
    url.includes('googletagmanager') ||
    url.includes('sentry.io') ||
    url.includes('.png') ||
    url.includes('.jpg') ||
    url.includes('.woff') ||
    url.includes('.css') ||
    url.includes('.chunk.js') ||
    url.includes('.ico')
  ) {
    continue;
  }

  let resBody = null;
  if (res.content && res.content.text) {
    try {
      resBody = JSON.parse(res.content.text);
    } catch (e) {
      resBody = res.content.text.substring(0, 300);
    }
  }

  let reqPost = null;
  if (req.postData && req.postData.text) {
    try {
      reqPost = JSON.parse(req.postData.text);
    } catch (e) {
      reqPost = req.postData.text;
    }
  }

  apis.push({
    method: req.method,
    url: req.url,
    status: res.status,
    headers: req.headers.filter(h => 
      ['authorization', 'x-auth-token', 'content-type', 'society-id', 'cookie', 'token'].some(k => h.name.toLowerCase().includes(k))
    ),
    requestData: reqPost,
    responseData: resBody
  });
}

console.log('Filtered API calls count:', apis.length);
fs.writeFileSync('mygate_extracted_apis.json', JSON.stringify(apis, null, 2));

apis.forEach((api, i) => {
  console.log(`\n[${i + 1}] ${api.method} ${api.url} -> Status: ${api.status}`);
  if (api.requestData) {
    console.log('Request Payload:', JSON.stringify(api.requestData).substring(0, 200));
  }
  if (api.responseData) {
    console.log('Response Payload:', JSON.stringify(api.responseData).substring(0, 300));
  }
});
