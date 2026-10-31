// @ts-nocheck: Supabase Edge Function (Deno) for Dual Visitor Approval & Exotel IVR Fallback
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const EXOTEL_API_KEY = Deno.env.get("EXOTEL_API_KEY") ?? ""
const EXOTEL_API_TOKEN = Deno.env.get("EXOTEL_API_TOKEN") ?? ""
const EXOTEL_ACCOUNT_SID = Deno.env.get("EXOTEL_ACCOUNT_SID") ?? ""
const EXOTEL_CALLER_ID = Deno.env.get("EXOTEL_CALLER_ID") ?? "09513886363"
const EXOTEL_SUBDOMAIN = Deno.env.get("EXOTEL_SUBDOMAIN") ?? "api.in.exotel.com"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const url = new URL(req.url)

  // 1. Exotel Webhook Handler for DTMF Response (1 = Approve, 2 = Deny)
  if (url.searchParams.get("action") === "ivr_callback" || req.method === "GET") {
    const entryId = url.searchParams.get("entry_id")
    const digits = url.searchParams.get("Digits") || url.searchParams.get("digits") || ""
    const callSid = url.searchParams.get("CallSid") || ""
    const callStatus = url.searchParams.get("Status") || "completed"

    console.log(`[Exotel Webhook] Entry: ${entryId}, Digits: ${digits}, CallSid: ${callSid}, Status: ${callStatus}`)

    if (entryId) {
      let approvalStatus = 'pending'
      if (digits === '1' || digits.startsWith('1')) {
        approvalStatus = 'approved'
      } else if (digits === '2' || digits.startsWith('2')) {
        approvalStatus = 'denied'
      }

      if (approvalStatus !== 'pending') {
        await supabase
          .from("gate_entries")
          .update({
            approval_status: approvalStatus,
            approval_channel: 'exotel_ivr',
            ivr_call_status: callStatus,
            approval_timestamp: new Date().toISOString()
          })
          .eq("id", entryId)
      }
    }

    // Return standard Twilio/Exotel XML response
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you. Your response has been recorded.</Say><Hangup/></Response>`,
      { headers: { "Content-Type": "application/xml" } }
    )
  }

  // 2. Main Trigger: Process Entry & Schedule 45s Exotel Fallback
  try {
    const { entry_id } = await req.json()

    if (!entry_id) {
      return new Response(JSON.stringify({ error: "entry_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Fetch gate entry details
    const { data: entry, error: entryErr } = await supabase
      .from("gate_entries")
      .select("*, gate_units(block_tower, unit_number)")
      .eq("id", entry_id)
      .single()

    if (entryErr || !entry) {
      return new Response(JSON.stringify({ error: "Entry not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Fetch unit's primary residents
    const { data: residents } = await supabase
      .from("gate_residents")
      .select("*")
      .eq("unit_id", entry.unit_id)
      .eq("active", true)

    if (!residents || residents.length === 0) {
      console.warn(`[ApprovalEngine] No registered residents for unit ${entry.unit_id}`)
      return new Response(JSON.stringify({ warning: "No residents registered for this flat" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const primaryResident = residents.find(r => r.is_primary) || residents[0]

    // 1. Send High-Priority FCM In-App Push Notification
    const tokens = residents.map(r => r.fcm_device_token).filter(Boolean)
    if (tokens.length > 0) {
      console.log(`[ApprovalEngine] Sending push to ${tokens.length} tokens`)
      // Call internal notification dispatcher
      await supabase.functions.invoke("send-notification", {
        body: {
          broadcast: false,
          userIds: residents.map(r => r.user_id).filter(Boolean),
          title: `Visitor at Gate: ${entry.visitor_name}`,
          message: `${entry.company_name ? entry.company_name + ' - ' : ''}${entry.visitor_name} requested entry for Flat ${entry.gate_units?.block_tower || ''} ${entry.gate_units?.unit_number || ''}`,
          data: {
            type: "visitor_approval",
            entry_id: entry.id,
            visitor_name: entry.visitor_name,
            visitor_type: entry.visitor_type
          }
        }
      })
    }

    // 2. Start Background 45-Second Timer for Exotel IVR Fallback
    // In Deno Deploy / Edge Functions, EdgeRuntime.waitUntil runs asynchronous tasks in background
    const executeFallback = async () => {
      console.log(`[ApprovalEngine] Waiting 45 seconds for resident app approval... (Entry ${entry.id})`)
      await new Promise(res => setTimeout(res, 45000))

      // Re-check current approval status
      const { data: currentEntry } = await supabase
        .from("gate_entries")
        .select("approval_status")
        .eq("id", entry.id)
        .single()

      if (currentEntry?.approval_status === "pending") {
        console.log(`[ApprovalEngine] 45s expired without app action. Initiating Exotel IVR call to ${primaryResident.phone}...`)

        if (!EXOTEL_API_KEY || !EXOTEL_API_TOKEN || !EXOTEL_ACCOUNT_SID) {
          console.warn("[ApprovalEngine] Exotel credentials missing. Skipping IVR fallback.")
          return
        }

        const auth = btoa(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`)
        const cleanPhone = primaryResident.phone.replace(/[^0-9]/g, "")
        const toPhone = cleanPhone.length === 10 ? `0${cleanPhone}` : cleanPhone

        const callbackUrl = `${SUPABASE_URL}/functions/v1/gate-visitor-approval-engine?action=ivr_callback&entry_id=${entry.id}`

        const postBody = new URLSearchParams({
          From: toPhone,
          To: toPhone,
          CallerId: EXOTEL_CALLER_ID,
          Url: callbackUrl,
          CallType: "trans"
        }).toString()

        try {
          const exotelRes = await fetch(`https://${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_ACCOUNT_SID}/Calls/connect.json`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: postBody
          })

          const exotelData = await exotelRes.json()
          const callSid = exotelData?.Call?.Sid || ""

          await supabase
            .from("gate_entries")
            .update({
              exotel_call_sid: callSid,
              ivr_call_status: "ringing",
              ivr_call_timestamp: new Date().toISOString()
            })
            .eq("id", entry.id)

          console.log(`[ApprovalEngine] Exotel Call Initiated: Sid ${callSid}`)
        } catch (callErr) {
          console.error("[ApprovalEngine] Exotel call failed:", callErr)
        }
      } else {
        console.log(`[ApprovalEngine] Resident responded via app (${currentEntry?.approval_status}). Exotel call aborted.`)
      }
    }

    // Run in background without blocking response to client
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(executeFallback())
    } else {
      executeFallback()
    }

    return new Response(JSON.stringify({
      success: true,
      entry_id: entry.id,
      resident_contacted: primaryResident.full_name,
      timer_seconds: 45
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err: any) {
    console.error("[ApprovalEngine Error]", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
