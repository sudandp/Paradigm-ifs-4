
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      // @ts-ignore: Deno env
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno env
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Find User ID for 'Nakul'
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, biometric_id')
      .ilike('name', '%Nakul%')

    if (userError) throw userError
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "User Nakul not found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []

    for (const user of users) {
      // 2. Query events for this user on 2026-01-10
      // We'll query purely by date range.
      const startOfDay = '2026-01-10T00:00:00.000Z'
      const endOfDay = '2026-01-10T23:59:59.999Z'

      const { data: events, error: attError } = await supabaseAdmin
        .from('attendance_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay)
        .order('timestamp', { ascending: true })

      if (attError) throw attError
      
      results.push({
        user: user.name,
        biometric_id: user.biometric_id,
        events: events
      })
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
