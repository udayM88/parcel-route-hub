import { getEnvironmentFromRequest, getPrayogConfig } from "../_shared/environment.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-environment',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { source_location, destination_location, packages } = requestBody;
    
    if (!source_location?.postal_code || !destination_location?.postal_code) {
      return new Response(
        JSON.stringify({ error: 'Both source and destination locations are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment-specific Prayog config
    const env = getEnvironmentFromRequest(req);
    const prayogConfig = getPrayogConfig(env);
    const userId = req.headers.get('x-user-id')?.trim() || 'viasetu-web';

    if (!prayogConfig.tenantId || !prayogConfig.apiKey) {
      return new Response(
        JSON.stringify({ error: `Prayog credentials are not configured for ${env}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Using ${env} environment for Prayog`);
    console.log('Checking serviceability v3:', {
      source_location,
      destination_location,
      env,
      hasUserId: Boolean(userId),
    });

    const prayogPayload = {
      source_location: {
        postal_code: source_location.postal_code,
        country_code: source_location.country_code || 'IN'
      },
      destination_location: {
        postal_code: destination_location.postal_code,
        country_code: destination_location.country_code || 'IN'
      },
      packages: packages || [{
        weight: { value: 1.0, unit: 'kg' },
        dimensions: { length: 10.0, width: 10.0, height: 10.0, unit: 'cm' }
      }]
    };

    console.log('Prayog API v3 payload:', JSON.stringify(prayogPayload));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': prayogConfig.apiKey || '',
    };

    const response = await fetch(`${prayogConfig.apiBaseUrl}/gateway/serviceability/v3/check`, {
      method: 'POST',
      headers,
      body: JSON.stringify(prayogPayload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Prayog API v3 error:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Failed to check serviceability', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Serviceability v3 check result:', JSON.stringify(data));

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in check-serviceability:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
