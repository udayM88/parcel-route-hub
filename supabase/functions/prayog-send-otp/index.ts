
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, phone } = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TENANT_ID = Deno.env.get('PRAYOG_TENANT_ID');
    const API_KEY = Deno.env.get('PRAYOG_API_KEY');
    
    if (!TENANT_ID || !API_KEY) {
      console.error('PRAYOG_TENANT_ID or PRAYOG_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending OTP to:', phone);

    const response = await fetch('https://sandbox-apis.prayog.io/auth/signup-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TENANT-ID': TENANT_ID,
        'api-key': API_KEY,
      },
      body: JSON.stringify({
        name: name || 'User',
        username: phone,
        signupType: 'MOBILE',
        role: 'USER'
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Prayog API error:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Failed to send OTP' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OTP sent successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: data.message,
        session: data.session,
        user_id: data.user_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in prayog-send-otp:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
