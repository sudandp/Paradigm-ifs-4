import { sendEmailLogic } from '../api/send-email';
import dotenv from 'dotenv';
import fs from 'fs';
import * as nodemailer from 'nodemailer';

dotenv.config({ path: '../.env.local' });

const originalCreateTransport = nodemailer.createTransport;
(nodemailer as any).createTransport = function(options: any) {
  return {
    sendMail: async function(mailOptions: any) {
      console.log('Intercepted sendMail!');
      fs.writeFileSync('C:/Users/sudhan/.gemini/antigravity-ide/brain/483948d5-2302-49b6-9c3c-eacb7cc76dc2/scratch/last_email_sent.html', mailOptions.html);
      console.log(`Saved HTML of length ${mailOptions.html.length}`);
      return { messageId: 'mock-123' };
    }
  };
};

async function run() {
  console.log('Running test with mocked nodemailer...');
  try {
    await sendEmailLogic({
      ruleId: 'b164accc-47be-487b-8420-7e99a8192407',
      test: true,
      testEmail: 'test@example.com',
      triggerType: 'automatic'
    });
    console.log('Finished sendEmailLogic.');
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
