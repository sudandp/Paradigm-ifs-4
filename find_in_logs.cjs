const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function findInEmailLogs() {
  const { data, error } = await supabase
    .from('email_logs')
    .select('id, subject, html, created_at')
    .ilike('subject', '%Nakul%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching email_logs:', error.message);
  } else {
    console.log('--- FOUND EMAIL LOGS FOR NAKUL ---');
    (data || []).forEach(log => {
      // Find the KM in html content using regex
      const kmMatch = (log.html || '').match(/(\d+\.?\d*)\s*(?:km|kms|kilometres)/i) || 
                      (log.html || '').match(/travel(?:led)?\s*(?::)?\s*(\d+\.?\d*)/i);
      console.log(`Subject: ${log.subject} | Created At: ${log.created_at} | KM Match:`, kmMatch ? kmMatch[0] : 'None');
      if (log.html && log.html.includes('77.28')) {
        console.log('  *** FOUND EXACT VALUE 77.28 in HTML! ***');
      }
      // Print first 500 chars of HTML
      console.log('  Preview:', log.html ? log.html.replace(/<[^>]*>/g, ' ').substring(0, 150).trim() : 'No content');
    });
  }
}

findInEmailLogs();
