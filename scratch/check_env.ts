import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

console.log("Database environment variables:");
for (const key of Object.keys(process.env)) {
  if (key.includes('DB') || key.includes('POSTGRES') || key.includes('SUPABASE') || key.includes('KEY') || key.includes('URL')) {
    console.log(`${key}: ${process.env[key] ? (process.env[key]?.startsWith('http') || process.env[key]?.startsWith('postgres') ? process.env[key] : '[SET]') : '[EMPTY]'}`);
  }
}
