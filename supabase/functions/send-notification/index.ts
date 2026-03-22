// @ts-nocheck: This file is a Supabase Edge Function using Deno. 
// Node.js IDEs will report "errors" for URL imports and the Deno global.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { JWT } from "https://esm.sh/google-auth-library@9"

const SERVICE_ACCOUNT_JSON = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "*" } })
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
      console.error("[SendNotification] FIREBASE_SERVICE_ACCOUNT secret is missing!");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 })
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
      return new Response(JSON.stringify({ success: true, message: "No tokens found, nothing to send" }), { status: 200 })
    }

    // 2. Get Access Token for FCM v1
    const accessToken = await getAccessToken(SERVICE_ACCOUNT_JSON)

    // 3. Send to each token
    console.log(`[SendNotification] Sending to ${tokens.length} tokens...`);
    const results = await Promise.all(tokens.map(async (t: { token: string, user_id?: string }) => {
      let unreadCount = 0;
      
      // If we have a user_id, fetch their actual unread count to show on the app icon badge
      if (t.user_id && !broadcast) {
        try {
          const { count, error } = await supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", t.user_id)
            .eq("is_read", false);
          
          if (!error) unreadCount = count || 0;
        } catch (e) {
          console.warn(`Failed to fetch unread count for user ${t.user_id}:`, e);
        }
      }

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
            data: data || {},
            android: {
              notification: { 
                icon: "notification_icon", 
                color: "#10b981", 
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                // This updates the launcher badge on Android
                notification_count: unreadCount > 0 ? unreadCount : undefined
              }
            },
            webpush: {
              notification: { icon: "/icon-192x192.png" }
            }
          }
        })
      }).then(res => res.json());
    }))

    return new Response(JSON.stringify({ success: true, tokenCount: tokens.length, results }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })

  } catch (err: any) {
    console.error("[SendNotification] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
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
