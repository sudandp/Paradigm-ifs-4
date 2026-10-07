import { sendEmailLogic } from '../api/send-email';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Triggering sendEmailLogic for BD Report rule...');
  try {
    const result = await sendEmailLogic({
      ruleId: '1c3dd098-1423-4a91-a5fa-6451dff6494d',
      test: true,
      testEmail: 'sudhan@paradigmfms.com'
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error during sendEmailLogic:', err);
  }
}

main();
