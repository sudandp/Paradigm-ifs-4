import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Minimal dotenv parser to avoid requiring the 'dotenv' package
const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        env[match[1].trim()] = val;
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE config in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPush() {
    console.log("🔍 Checking for registered FCM tokens...");
    const { data: tokens, error } = await supabase.from('fcm_tokens').select('user_id, token, platform').limit(5);
    
    if (error) {
        console.error("❌ Database error retrieving tokens:", error.message);
        return;
    }

    if (!tokens || tokens.length === 0) {
        console.log("⚠️ No FCM tokens found in the database!");
        console.log("👉 Please open the app in your browser or phone, log in, and grant notification permissions so a token is generated.");
        return;
    }

    const testUser = tokens[0].user_id;
    console.log(`✅ Found token for User ID... targeting user: ${testUser}`);
    console.log(`🚀 Invoking the 'send-notification' Edge Function...`);

    const { data, error: invokeError } = await supabase.functions.invoke('send-notification', {
        body: {
            user_id: testUser,
            title: 'Test Notification 🚀',
            body: 'Direct FCM is working perfectly!',
            data: { test: 'true' }
        }
    });

    if (invokeError) {
        console.error("❌ Failed to invoke Edge Function:", invokeError.message);
        try {
            // supabase-js v2 error objects might have context that can be used to extract the response
            if ((invokeError as any).context && typeof (invokeError as any).context.json === 'function') {
                const errorData = await (invokeError as any).context.json();
                console.error("Error Detail (from response):", JSON.stringify(errorData, null, 2));
            } else {
                 console.error("Full error object:", JSON.stringify(invokeError, null, 2));
            }
        } catch (e) {
            console.error("Could not parse error response body.");
        }
    } else {
        console.log("🎉 Edge Function responded successfully!", data);
        console.log("Check your device/browser for the push notification!");
    }
}

testPush();
