
const fetch = require('node-fetch');

async function testFetch() {
  const url = 'https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/avatars/4fa5865a-9d8f-4af9-b9f5-c24dd9b93ecc/1769077908210.jpeg';
  console.log('Fetching:', url);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify([...response.headers.entries()], null, 2));
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}

testFetch();
