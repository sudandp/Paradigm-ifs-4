// @ts-nocheck: This file is a Supabase Edge Function using Deno. 
// Node.js IDEs will report "errors" for URL imports and the Deno global.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { JWT } from "npm:google-auth-library@9.4.1"

let SERVICE_ACCOUNT_JSON = {};
try {
  SERVICE_ACCOUNT_JSON = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}");
} catch (e) {
  console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", e);
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

console.log("[SendNotification] Edge Function loaded or restarted.");
console.log(`[SendNotification] Service Account project_id: ${SERVICE_ACCOUNT_JSON.project_id || 'NOT_FOUND'}`);

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { user_id, userIds, title, body: msgBody, message, data, broadcast } = body
    const finalMessage = msgBody || message
    const finalTitle = title || "Paradigm Office"
    
    // Normalize target users into an array
    let targetUserIds = []
    if (broadcast) {
      // For broadcast, we fetch all users or all tokens
      targetUserIds = ['BROADCAST'] 
    } else {
      targetUserIds = userIds || (user_id ? [user_id] : [])
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ error: "No target users or broadcast flag provided" }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (!SERVICE_ACCOUNT_JSON.project_id) {
      console.warn("[SendNotification] FIREBASE_SERVICE_ACCOUNT secret is missing! Skipping push notification.");
      return new Response(JSON.stringify({ success: false, warning: "Firebase not configured" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      })
    }

    // 1. Fetch tokens
    let tokens = []
    if (broadcast) {
      console.log("[SendNotification] Processing broadcast to all users...");
      const { data: allTokens, error } = await supabase.from("fcm_tokens").select("token, user_id")
      if (error) throw error
      tokens = allTokens || []
    } else {
      console.log(`[SendNotification] Fetching tokens for users: ${targetUserIds.join(', ')}`);
      const { data: userTokens, error } = await supabase
        .from("fcm_tokens")
        .select("token, user_id")
        .in("user_id", targetUserIds)
      if (error) throw error
      tokens = userTokens || []
    }

    if (tokens.length === 0) {
      console.log("[SendNotification] No FCM tokens found for targets.");
      // Even if no tokens, we should still insert to DB for targeted users so they see it when they login on web
    }

    // 2. Database insertion is now handled exclusively by the client applications (e.g., api.ts & notificationService.ts)
    // to bypass early aborts and ensure reliable event delivery.

    // 3. Fetch unread counts for all relevant users in one batch
    const distinctUserIds = [...new Set(tokens.map(t => t.user_id).filter(Boolean))];
    const unreadMap = new Map();
    
    if (distinctUserIds.length > 0) {
      try {
        const { data: counts, error: countsError } = await supabase
          .from("notifications")
          .select("user_id")
          .in("user_id", distinctUserIds)
          .eq("is_read", false);
        
        if (!countsError && counts) {
          counts.forEach(row => {
            const current = unreadMap.get(row.user_id) || 0;
            unreadMap.set(row.user_id, current + 1);
          });
        }
      } catch (e) {
        console.warn("[SendNotification] Failed to batch fetch unread counts:", e);
      }
    }

    // 3. Get Access Token for FCM v1
    console.log(`[SendNotification] Retrieving access token for project ${SERVICE_ACCOUNT_JSON.project_id}...`);
    const accessToken = await getAccessToken(SERVICE_ACCOUNT_JSON)
    console.log("[SendNotification] Access token retrieved successfully.");

    // 4. Send to each token
    console.log(`[SendNotification] Sending to ${tokens.length} tokens...`);
    const results = await Promise.all(tokens.map(async (t: { token: string, user_id?: string }) => {
      const userUnreadCount = t.user_id ? (unreadMap.get(t.user_id) || 0) : 0;
      
      return fetch(`https://fcm.googleapis.com/v1/projects/${SERVICE_ACCOUNT_JSON.project_id}/messages:send`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: { title: finalTitle, body: finalMessage },
            data: {
              ...data,
              title: finalTitle,
              body: finalMessage,
              notification_count: userUnreadCount.toString(), 
              badge: userUnreadCount.toString(),
              type: data?.type || 'info', 
            },
            android: {
              priority: "high",
              notification: { 
                icon: "ic_launcher", 
                color: "#1d4ed8", 
                channel_id: "default",
                notification_count: userUnreadCount > 0 ? userUnreadCount : undefined,
                default_sound: true,
                default_vibrate_timings: true,
                click_action: "TOP_STORY_ACTIVITY" // Standard boilerplate for Capacitor
              }
            },
            webpush: {
              notification: { 
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png"
              }
            }
          }
        })
      }).then(res => res.json());
    }))

    return new Response(JSON.stringify({ success: true, tokenCount: tokens.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    console.error("[SendNotification] CRITICAL ERROR:", errorMsg);
    if (err.stack) console.error(err.stack);

    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMsg,
      debug: {
        step: "Execution failed",
        hasServiceAccount: !!SERVICE_ACCOUNT_JSON.project_id
      }
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500 
    })
  }
})

async function getAccessToken(serviceAccount: any) {
  const jwt = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const tokens = await jwt.authorize();
  return tokens.access_token;
}
