
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input, pincode } = await req.json();

    if (!input) {
      return new Response(
        JSON.stringify({ error: 'Input is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bias search toward the user's Step-2 pincode by appending it to the input.
    // Google's autocomplete weights results by the query text strongly, so this
    // heavily prefers addresses inside that pincode area.
    const validPincode = typeof pincode === 'string' && /^\d{6}$/.test(pincode) ? pincode : null;
    const biasedInput = validPincode ? `${input} ${validPincode}` : input;

    // Using the new Places API (New)
    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input: biasedInput,
          includedRegionCodes: ['in'], // Restrict to India
          languageCode: 'en',
        }),
      }
    );

    const data = await response.json();
    console.log('Places API response:', JSON.stringify(data));

    // Transform the new API response to match our expected format
    let predictions = data.suggestions?.map((suggestion: any) => ({
      place_id: suggestion.placePrediction?.placeId,
      description: suggestion.placePrediction?.text?.text,
      structured_formatting: {
        main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || '',
        secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || '',
      },
    })).filter((p: any) => p.place_id) || [];

    // Hard-filter: when a pincode is provided, prefer suggestions whose text
    // contains that pincode. If at least one match exists, keep only matches.
    // Otherwise fall back to the full list (so the user still sees something
    // and the client-side mismatch dialog can warn them).
    if (validPincode && predictions.length > 0) {
      const matching = predictions.filter((p: any) =>
        (p.description || '').includes(validPincode) ||
        (p.structured_formatting?.secondary_text || '').includes(validPincode)
      );
      if (matching.length > 0) {
        predictions = matching;
      }
    }

    return new Response(
      JSON.stringify({ predictions, status: 'OK' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
