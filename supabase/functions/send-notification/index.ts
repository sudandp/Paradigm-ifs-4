// @ts-nocheck: This file is a Supabase Edge Function using Deno. 
// Node.js IDEs will report "errors" for URL imports and the Deno global.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SERVICE_ACCOUNT_JSON = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}")

serve(async (req: Request) => {
  const { user_id, title, body, data } = await req.json()

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  // 1. Fetch tokens for this user
  const { data: tokens, error: tokenError } = await supabase
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", user_id)

  if (tokenError || !tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ error: "No tokens found for user" }), { status: 404 })
  }

  // 2. Get Access Token for FCM v1 (using Google Auth Library)
  // Note: In a real environment, you'd use a library to sign the JWT and get the token.
  // For brevity, this plan assumes you have a helper to get the token or use a standard OAuth flow.
  const accessToken = await getAccessToken(SERVICE_ACCOUNT_JSON)

  // 3. Send to each token
  const results = await Promise.all(tokens.map((t: { token: string }) => 
    fetch(`https://fcm.googleapis.com/v1/projects/${SERVICE_ACCOUNT_JSON.project_id}/messages:send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: t.token,
          notification: { title, body },
          data: data || {},
        }
      })
    }).then(res => res.json())
  ))

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json" },
  })
})

/**
 * Helper to get Google OAuth2 Access Token
 * You would normally use 'google-auth-library' or similar.
 */
async function getAccessToken(serviceAccount: any) {
    // Logic to generate JWT and swap for access token
    // This is a placeholder for the actual OAuth2 flow
    return "YOUR_ACCESS_TOKEN"; 
}
