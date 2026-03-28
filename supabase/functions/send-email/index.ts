declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // We proxy this to the Vercel SMTP API
    // The Vercel API URL should be configured in Supabase Env Vars
    const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://paradigm-office-4.vercel.app';
    const INTERNAL_API_KEY = Deno.env.get('INTERNAL_API_KEY');

    console.log(`[send-email-proxy] Proxying request to ${VERCEL_API_URL}/api/send-email`);

    const res = await fetch(`${VERCEL_API_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': INTERNAL_API_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
       console.error("[send-email-proxy] Error from Vercel:", data);
       return new Response(JSON.stringify({ error: data }), {
         status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("[send-email-proxy] Critical Error:", error.message);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
