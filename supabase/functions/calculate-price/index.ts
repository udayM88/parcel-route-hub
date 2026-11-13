import { getEnvironmentFromRequest, getPrayogConfig } from "../_shared/environment.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-environment',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { weight, source_postal_code, destination_postal_code, urgency, rate_card_id } = await req.json();
    
    if (!weight || !source_postal_code || !destination_postal_code || !urgency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: weight, source_postal_code, destination_postal_code, urgency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment-specific Prayog config
    const env = getEnvironmentFromRequest(req);
    const prayogConfig = getPrayogConfig(env);
    
    console.log(`Using ${env} environment for price calculation`);

    const TENANT_ID = prayogConfig.tenantId;
    
    if (!TENANT_ID) {
      console.error(`PRAYOG_TENANT_ID not configured for ${env} environment`);
      return new Response(
        JSON.stringify({ error: `Server configuration error for ${env} environment` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calculating price for:', { weight, source_postal_code, destination_postal_code, urgency });

    // Fetch the rate card (using default if no specific ID provided)
    const rateCardUrl = rate_card_id 
      ? `${prayogConfig.apiBaseUrl}/ratecard/${rate_card_id}`
      : `${prayogConfig.apiBaseUrl}/ratecard`;
    
    const rateCardResponse = await fetch(rateCardUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-TENANT-ID': TENANT_ID,
      },
    });

    if (!rateCardResponse.ok) {
      const errorData = await rateCardResponse.json();
      console.error('Rate card fetch error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch rate card' }),
        { status: rateCardResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rateCard = await rateCardResponse.json();
    console.log('Rate card fetched successfully');

    // Map urgency to service type
    const serviceTypeMap: Record<string, string> = {
      'express': 'fastTrack',
      'standard': 'standard',
    };
    const serviceType = serviceTypeMap[urgency.toLowerCase()] || 'standard';

    // Determine weight range
    const weightInGrams = parseFloat(weight) * 1000; // Convert kg to grams
    let weightRange = '';
    
    if (weightInGrams <= 50) weightRange = '0-50g';
    else if (weightInGrams <= 100) weightRange = '51-100g';
    else if (weightInGrams <= 250) weightRange = '101-250g';
    else if (weightInGrams <= 500) weightRange = '251-500g';
    else if (weightInGrams <= 750) weightRange = '501-750g';
    else if (weightInGrams <= 1000) weightRange = '751-1000g';
    else if (weightInGrams <= 2000) weightRange = '1001-2000g';
    else if (weightInGrams <= 5000) weightRange = '2001-5000g';
    else weightRange = '5000g+';

    // For now, we'll use 'metro' as default location type
    // In a real implementation, you'd determine this based on postal codes
    const locationType = 'metro';

    // Calculate price from rate card
    let basePrice = 0;
    
    if (rateCard.data?.pricingMatrix) {
      const pricing = rateCard.data.pricingMatrix[serviceType]?.[locationType]?.[weightRange];
      if (pricing) {
        basePrice = pricing;
      }
    }

    // Add convenience fee (example: 10% of base price, min 20)
    const convenienceFee = Math.max(basePrice * 0.1, 20);
    const totalPrice = basePrice + convenienceFee;

    console.log('Price calculation result:', {
      basePrice,
      convenienceFee,
      totalPrice,
      serviceType,
      weightRange,
      locationType
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          basePrice,
          convenienceFee,
          totalPrice,
          serviceType,
          weightRange,
          locationType,
          currency: 'INR'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in calculate-price:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
