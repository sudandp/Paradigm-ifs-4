import { sendEmailLogic } from '../api/send-email';
import dotenv from 'dotenv';
dotenv.config({ path: 'E:/backup/onboarding all files/Paradigm Office 4/.env.local' });

async function run() {
  console.log('--- Triggering Test of Monthly Report V2 ---');
  try {
    await sendEmailLogic({
      ruleId: 'b164accc-47be-487b-8420-7e99a8192407',
      test: true,
      testEmail: 'sudhan@paradigmfms.com',
      triggerType: 'automatic'
    });
    console.log('Test execution finished successfully!');
  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

run();
