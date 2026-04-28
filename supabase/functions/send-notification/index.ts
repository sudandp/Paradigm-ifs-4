// @ts-nocheck: This file is a Supabase Edge Function using Deno. 
// Node.js IDEs will report "errors" for URL imports and the Deno global.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// Removed Node-based google-auth-library which causes "Not implemented: crypto.Sign" in Deno

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
    const { user_id, userIds, title, body: msgBody, message, data, broadcast, metadata, platforms } = body
    const finalMessage = msgBody || message
    const finalTitle = title || "Paradigm Office"
    
    const ruleId = metadata?.rule_id
    const _isTestMode = metadata?.test_mode
    
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
      let query = supabase.from("fcm_tokens").select("token, user_id, platform")
      if (platforms && platforms.length > 0) {
        query = query.in("platform", platforms)
      }
      const { data: allTokens, error } = await query
      if (error) throw error
      tokens = allTokens || []
    } else {
      console.log(`[SendNotification] Fetching tokens for users: ${targetUserIds.join(', ')}${platforms ? ` on platforms: ${platforms.join(', ')}` : ''}`);
      let query = supabase
        .from("fcm_tokens")
        .select("token, user_id, platform")
        .in("user_id", targetUserIds)
      
      if (platforms && platforms.length > 0) {
        query = query.in("platform", platforms)
      }

      const { data: userTokens, error } = await query
      if (error) throw error
      tokens = userTokens || []
    }

    if (tokens.length === 0) {
      console.log("[SendNotification] No FCM tokens found for targets matching criteria.");
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
    const isSilentPing = data?.type === 'SILENT_TRACKING_PING';
    console.log(`[SendNotification] Sending to ${tokens.length} tokens (silent=${isSilentPing})...`);
    const results = await Promise.all(tokens.map(async (t: { token: string, user_id?: string }) => {
      const userUnreadCount = t.user_id ? (unreadMap.get(t.user_id) || 0) : 0;
      
      const payload: any = {
        token: t.token,
        // data-only payload — always present for all message types
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
          collapse_key: ruleId ? `rule_${ruleId}` : undefined,
          direct_boot_ok: true,
        },
        apns: {
          headers: {
            "apns-priority": isSilentPing ? "5" : "10",
            "apns-push-type": isSilentPing ? "background" : "alert",
          },
          payload: {
            aps: isSilentPing
              ? { "content-available": 1 }  // iOS background delivery (no sound/badge)
              : { "content-available": 1, badge: userUnreadCount, sound: "default" }
          }
        },
        webpush: isSilentPing ? {} : {
          notification: {
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png"
          }
        }
      };

      // Only attach a visible notification object for NON-silent messages.
      // For SILENT_TRACKING_PING we send data-only so no tray notification appears.
      if (!isSilentPing) {
        payload.notification = { title: finalTitle, body: finalMessage };
        payload.android.notification = {
          tag: ruleId ? `rule_${ruleId}` : undefined,
          icon: "ic_launcher",
          color: "#1d4ed8",
          channel_id: "default",
          notification_count: userUnreadCount > 0 ? userUnreadCount : undefined,
          default_sound: true,
          default_vibrate_timings: true,
          click_action: "FCM_PLUGIN_ACTIVITY"
        };
      }

      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${SERVICE_ACCOUNT_JSON.project_id}/messages:send`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: payload })
      });
      return response.json();
    }))

    return new Response(JSON.stringify({ success: true, tokenCount: tokens.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
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

async function getAccessToken(serviceAccount: Record<string, string>) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const pem = serviceAccount.private_key;
  const pemContents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${encodedSignature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Failed to get access token: ${result.error_description || result.error}`);
  }
  return result.access_token;
}
