import * as fs from 'fs';
import * as dotenv from 'dotenv';

console.log("=== .env keys ===");
if (fs.existsSync('.env')) {
  const env = dotenv.parse(fs.readFileSync('.env'));
  console.log(Object.keys(env));
}

console.log("=== .env.local keys ===");
if (fs.existsSync('.env.local')) {
  const envLocal = dotenv.parse(fs.readFileSync('.env.local'));
  console.log(Object.keys(envLocal));
}
