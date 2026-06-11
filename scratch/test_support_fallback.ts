import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to snake_case payload (since PostgREST/Supabase schema is snake_case)
const toSnakeCase = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => toSnakeCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
    const snaked: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snaked[snakeKey] = toSnakeCase(data[key]);
      }
    }
    return snaked;
  }
  return data;
};

// Helper function to camelCase response
const toCamelCase = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => toCamelCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const camelCased: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
        camelCased[camelKey] = toCamelCase(data[key]);
      }
    }
    return camelCased;
  }
  return data;
};

const parseAttachmentFallback = (ticket: any): any => {
  if (ticket && !ticket.attachmentUrl && ticket.description) {
    const match = ticket.description.match(/\[Attachment:\s*([^\]]+)\]/);
    if (match) {
      ticket.attachmentUrl = match[1].trim();
      ticket.description = ticket.description.replace(/\[Attachment:\s*([^\]]+)\]/, '').trim();
    }
  }
  return ticket;
};

async function run() {
  console.log("Starting self-contained database fallback verification...");
  
  const testTicketNumber = "TEST-TKT-" + Date.now();
  const ticketData = {
    title: "Self-contained Test Fallback",
    description: "Verifying fallback attachment behaviour directly against Supabase database.",
    category: "Software Developer",
    priority: "Low",
    status: "Open",
    raisedById: "5321c6f6-578e-4168-9da8-060148e1587b",
    raisedByName: "Test Runner",
    ticketNumber: testTicketNumber,
    attachmentUrl: "https://example.com/direct-fallback-test-image.png"
  };

  let insertedId: string | null = null;

  try {
    console.log("Step 1: Attempting to insert ticket directly with attachment_url column...");
    const { data: firstInsert, error: firstError } = await supabase
      .from('support_tickets')
      .insert(toSnakeCase(ticketData))
      .select('*')
      .single();

    if (firstError) {
      console.log(`Received error as expected: Code = ${firstError.code}, Message = ${firstError.message}`);
      
      if (firstError.code === 'PGRST204' || firstError.message.includes('attachment_url')) {
        console.log("✅ verified: PGRST204/missing column error detected correctly.");
        
        console.log("Step 2: Running fallback logic (appending to description and omitting column)...");
        const fallbackTicketData = { ...ticketData };
        if (fallbackTicketData.attachmentUrl) {
          fallbackTicketData.description = `${fallbackTicketData.description}\n\n[Attachment: ${fallbackTicketData.attachmentUrl}]`;
          delete (fallbackTicketData as any).attachmentUrl;
        }

        console.log("Step 3: Retrying insert with fallback payload...");
        const { data: secondInsert, error: secondError } = await supabase
          .from('support_tickets')
          .insert(toSnakeCase(fallbackTicketData))
          .select('*')
          .single();

        if (secondError) {
          throw new Error(`Fallback insert failed: ${secondError.message}`);
        }

        console.log("✅ Fallback insert succeeded!");
        const camelResult = parseAttachmentFallback(toCamelCase(secondInsert));
        insertedId = camelResult.id;

        console.log("Parsed result check:");
        console.log(" - ID:", camelResult.id);
        console.log(" - Description:", JSON.stringify(camelResult.description));
        console.log(" - AttachmentUrl:", camelResult.attachmentUrl);

        if (camelResult.attachmentUrl === "https://example.com/direct-fallback-test-image.png") {
          console.log("✅ SUCCESS: Fallback parsed attachmentUrl back correctly from description!");
        } else {
          console.error("❌ FAILURE: Fallback attachmentUrl is mismatch:", camelResult.attachmentUrl);
        }
      } else {
        throw new Error(`Unexpected database error: ${firstError.message}`);
      }
    } else {
      console.log("⚠️ Note: Direct insert succeeded. This means the attachment_url column exists in the database schema.");
      insertedId = firstInsert.id;
    }

    if (insertedId) {
      console.log("Cleaning up test support ticket (ID:", insertedId, ")...");
      const { error: deleteError } = await supabase
        .from('support_tickets')
        .delete()
        .eq('id', insertedId);
      
      if (deleteError) {
        console.error("Failed to clean up test ticket:", deleteError.message);
      } else {
        console.log("✅ Cleanup successful!");
      }
    }

  } catch (err: any) {
    console.error("❌ Test script failed with exception:", err.message || err);
  }
}

run();
