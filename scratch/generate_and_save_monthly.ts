import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { reportGenerators } from '../utils/reportGenerators';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  console.log('--- Running Local Monthly Report Generator ---');
  try {
    const nowIST = new Date();
    // Simulate generation for June 2026 (assuming today is July 2026)
    const reportData = await reportGenerators.attendance_monthly(supabase, nowIST);
    console.log(`Generated for: ${reportData.date}`);
    console.log(`Total Employees: ${reportData.totalEmployees}`);
    
    fs.writeFileSync('scratch/generated_table.html', reportData.table || '');
    console.log('Saved generated table to scratch/generated_table.html');
  } catch (err) {
    console.error('Failed to generate report:', err);
  }
}

run();
