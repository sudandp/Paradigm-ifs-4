
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
    console.log('Fetching columns for "entities" table...')
    const { data: cols, error: colError } = await supabase.from('entities').select('*').limit(1);
    if (colError) {
      console.error('Error fetching columns:', colError);
    } else if (cols && cols.length > 0) {
      console.log('Columns in entities table:', Object.keys(cols[0]));
    } else {
      console.log('No data in entities table to check columns.');
      // Try to get one record without limit just in case
        const { data: allCols } = await supabase.from('entities').select('*').limit(1);
        if (allCols && allCols.length > 0) {
             console.log('Columns in entities table (attempt 2):', Object.keys(allCols[0]));
        } else {
             console.log('Still no data. Cannot infer columns from select *.');
        }
    }
}

checkColumns();
