
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhoto() {
  console.log('Checking photo for user...');
  // Let's find a user who has a photo
  const { data: users, error } = await supabase.from('users').select('id, name, photo_url').not('photo_url', 'is', null).limit(5);
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('No users found with a photo_url');
    return;
  }
  
  for (const user of users) {
    console.log(`User: ${user.name} (${user.id})`);
    console.log(`Photo URL: ${user.photo_url}`);
    
    // Test if the photo_url starts with /api/view-file
    if (user.photo_url.startsWith('/api/view-file/')) {
       console.log('Detected proxy URL. Attempting to resolve path...');
       const storagePath = user.photo_url.replace('/api/view-file/', '');
       console.log(`Storage Path: ${storagePath}`);
       
       const bucket = storagePath.split('/')[0];
       const pathInBucket = storagePath.split('/').slice(1).join('/');
       
       console.log(`Bucket: ${bucket}, Path in Bucket: ${pathInBucket}`);
       
       const { data, error: storageError } = await supabase.storage.from(bucket).download(pathInBucket);
       if (storageError) {
         console.error(`Error downloading from storage: ${storageError.message}`);
       } else {
         console.log(`Successfully downloaded ${data.size} bytes`);
       }
    } else {
      console.log('Photo URL is not a proxy URL.');
    }
    console.log('---');
  }
}

checkPhoto();
