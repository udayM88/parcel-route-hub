import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeResult {
  pincode: string;
  city: string;
  state: string;
  country: string;
}

// India Post is authoritative for Indian pincode -> district mapping.
// Google often returns a small locality/village name (e.g. 461001 -> "Raipur"
// instead of "Hoshangabad"), so we try India Post first and fall back to Google.
async function lookupIndiaPost(pincode: string): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) return null;
    const json = await res.json();
    const entry = json?.[0];
    if (entry?.Status !== "Success") return null;
    const offices: any[] = entry.PostOffice || [];
    if (!offices.length) return null;
    // Prefer a Head Office name if it matches the district; otherwise use district.
    const district = offices[0].District || "";
    const state = offices[0].State || "";
    if (!district) return null;
    return { city: district, state };
  } catch (e) {
    console.warn("India Post lookup failed", pincode, String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pincodes } = await req.json();

    if (!pincodes || !Array.isArray(pincodes) || pincodes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'pincodes array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: GeocodeResult[] = [];

    // Fetch city names for all pincodes in parallel
    const geocodePromises = pincodes.map(async (pincode: string) => {
      try {
        const postal = await lookupIndiaPost(pincode);
        if (postal?.city) {
          return { pincode, city: postal.city, state: postal.state || 'Unknown', country: 'India' };
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${pincode}+India&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          const addressComponents = result.address_components || [];

          let locality = '';
          let district = '';
          let sublocality = '';
          let sublocalityLevel2 = '';
          let adminLevel3 = '';
          let neighborhood = '';
          let state = '';
          let country = '';

          // First pass: collect all relevant components
          for (const component of addressComponents) {
            const types = component.types || [];
            
            if (types.includes('locality')) {
              locality = component.long_name;
            }
            if (types.includes('administrative_area_level_2')) {
              district = component.long_name;
            }
            if (types.includes('administrative_area_level_3')) {
              adminLevel3 = component.long_name;
            }
            if (types.includes('sublocality_level_1')) {
              sublocality = component.long_name;
            }
            if (types.includes('sublocality_level_2')) {
              sublocalityLevel2 = component.long_name;
            }
            if (types.includes('neighborhood')) {
              neighborhood = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
            if (types.includes('country')) {
              country = component.long_name;
            }
          }

          // Priority order for Indian pincodes:
          // 1. locality (actual city name like "Mumbai", "Pune")
          // 2. sublocality_level_1 (area within city)
          // 3. administrative_area_level_3 (smaller admin unit, often town/taluka)
          // 4. sublocality_level_2 or neighborhood
          // 5. district (administrative_area_level_2) - but filter out "Division" names
          // 6. For small states like Goa, use state name as city if nothing else available
          let city = locality || sublocality || adminLevel3 || sublocalityLevel2 || neighborhood;
          
          if (!city && district && !district.includes('Division')) {
            city = district;
          }
          
          // For small states/UTs like Goa, if no city found, use a meaningful fallback
          if (!city && state) {
            // Use state name for small states/UTs as they often don't have distinct city names
            const smallStates = ['Goa', 'Sikkim', 'Chandigarh', 'Puducherry', 'Andaman and Nicobar Islands', 'Lakshadweep', 'Dadra and Nagar Haveli and Daman and Diu'];
            if (smallStates.includes(state)) {
              city = state;
            }
          }

          return {
            pincode,
            city: city || 'Unknown',
            state: state || 'Unknown',
            country: country || 'India'
          };
        } else {
          console.warn(`No geocode results for pincode: ${pincode}`, data.status);
          return {
            pincode,
            city: 'Unknown',
            state: 'Unknown',
            country: 'India'
          };
        }
      } catch (error) {
        console.error(`Error geocoding pincode ${pincode}:`, error);
        return {
          pincode,
          city: 'Unknown',
          state: 'Unknown',
          country: 'India'
        };
      }
    });

    const geocodeResults = await Promise.all(geocodePromises);
    results.push(...geocodeResults);

    console.log('Geocode results:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to geocode pincodes' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
