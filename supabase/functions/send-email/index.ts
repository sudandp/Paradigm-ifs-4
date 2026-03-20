declare const Deno: any;

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { to, subject, html, attachments } = await req.json();
    
    if (!RESEND_API_KEY) {
       console.error("Missing RESEND_API_KEY");
       return new Response(JSON.stringify({ error: 'Server configuration error: Missing RESEND_API_KEY' }), {
         status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Paradigm FMS <onboarding@resend.dev>',
        to,
        subject,
        html,
        attachments 
      }),
    });

    const data = await res.json();

    if (!res.ok) {
       return new Response(JSON.stringify({ error: data }), {
         status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
