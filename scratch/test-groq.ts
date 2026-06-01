import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { groqTranscribeLogic } from '../api/groq-transcribe.js';
import { groqSummariseLogic } from '../api/groq-summarise.js';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function runTests() {
  console.log('=== STARTING GROQ PHASE 2 TESTS ===');
  
  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY is not set in .env');
    process.exit(1);
  }
  
  console.log('1. Testing Transcription Route...');
  try {
    const audioPath = path.join(process.cwd(), 'public/sounds/beep.wav');
    if (fs.existsSync(audioPath)) {
      const audioBuffer = fs.readFileSync(audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      
      console.log(`Sending audio file: beep.wav (${audioBuffer.length} bytes)`);
      const transcribeResult = await groqTranscribeLogic(audioBase64, 'beep.wav');
      console.log('Transcription Result:');
      console.log(JSON.stringify(transcribeResult, null, 2));
    } else {
      console.log('Skipping transcription test: public/sounds/beep.wav not found.');
    }
  } catch (err: any) {
    console.error('Transcription Test Failed:', err.message);
  }

  console.log('\n----------------------------------------\n');

  console.log('2. Testing Summarisation Route...');
  try {
    const dummyTranscript = `
HR: Hi John, thanks for taking the time to speak today. How are you doing?
John: I'm doing well, thanks!
HR: Great. I'm calling about the Delivery Executive role. What is your current CTC and notice period?
John: Currently I'm making 3 LPA. My notice period is 15 days.
HR: We provide uniforms and need to know your t-shirt size. What size do you wear?
John: I wear a Large.
HR: Are you comfortable working in the Whitefield location?
John: Yes, Whitefield is fine by me.
HR: Perfect. I'll pass your resume to the hiring manager and we'll schedule a formal interview next week. We'll be in touch!
John: Awesome, looking forward to it.
    `;
    
    console.log('Sending dummy transcript to LLM...');
    const summaryResult = await groqSummariseLogic(
      dummyTranscript,
      'John Doe',
      'Delivery Executive'
    );
    
    console.log('Summarisation JSON Output:');
    console.log(JSON.stringify(summaryResult, null, 2));
  } catch (err: any) {
    console.error('Summarisation Test Failed:', err.message);
  }

  console.log('\n=== GROQ PHASE 2 TESTS COMPLETE ===');
}

runTests();
