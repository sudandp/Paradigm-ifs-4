
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFile() {
    const bucket = 'logo';
    const filePath = '1776773154591_logo paradigm sudhan.png';
    
    console.log(`Checking if file exists: ${bucket}/${filePath}`);
    const { data, error } = await supabase.storage.from(bucket).list('', {
        search: filePath
    });

    if (error) {
        console.error('Error listing:', error);
    } else {
        console.log('Files found:', data);
    }

    // Try to download
    const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(filePath);
    if (downloadError) {
        console.error('Download error:', downloadError);
    } else {
        console.log('Download success, content length:', fileData.size);
    }
}

checkFile();
