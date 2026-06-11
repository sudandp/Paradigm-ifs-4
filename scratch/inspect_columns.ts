import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

async function inspectSchema() {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/`;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  console.log("Fetching root OpenAPI schema definition from PostgREST using service role key...");
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/openapi+json'
      }
    });

    console.log("Response status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Raw Response length:", text.length);
    if (text.length > 0) {
       const data = JSON.parse(text);
       if (data.definitions && data.definitions.support_tickets) {
          const properties = data.definitions.support_tickets.properties;
          console.log("Properties in support_tickets definition:", Object.keys(properties));
       } else {
          console.log("Definitions found:", Object.keys(data.definitions || {}));
       }
    } else {
       console.log("Empty response body.");
    }
  } catch (err) {
    console.error("Failed to fetch OpenAPI schema:", err);
  }
}

inspectSchema();
