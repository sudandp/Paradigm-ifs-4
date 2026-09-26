import { createClient } from '@supabase/supabase-js';

const url = 'https://fmyafuhxlorbafbacywa.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU';
const supabase = createClient(url, key);

async function fetchLogs() {
  let { data, error } = await supabase
    .from('attendance_events') 
    .select('*')
    .limit(1);
    
  if (error) {
     console.error('Error:', error.message);
  } else {
     console.log('RECORDS:', JSON.stringify(data, null, 2));
  }
}

fetchLogs();
