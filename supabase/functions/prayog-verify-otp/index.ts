
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, session, otp } = await req.json();
    
    if (!phone || !session || !otp) {
      return new Response(
        JSON.stringify({ error: 'Phone, session, and OTP are required' }),
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

    console.log('Verifying OTP for:', phone);
    console.log('Session token (first 50 chars):', session.substring(0, 50));
    console.log('OTP length:', otp.length);

    const response = await fetch('https://sandbox-apis.prayog.io/auth/verify-mfa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TENANT-ID': TENANT_ID,
        'api-key': API_KEY,
      },
      body: JSON.stringify({
        username: phone,
        session: session,
        confirmationCode: otp
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Prayog verify OTP error:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Invalid OTP' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OTP verified successfully:', data);

    // Return the auth data from Prayog
    return new Response(
      JSON.stringify({
        success: true,
        ...data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in prayog-verify-otp:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
