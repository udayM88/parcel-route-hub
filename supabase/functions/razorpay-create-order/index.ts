import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBookingRow, type BookingDraft } from "../_shared/booking-draft.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-environment, x-prayog-auth',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, currency = 'INR', receipt, notes, booking_draft } = await req.json() as {
      amount?: number; currency?: string; receipt?: string; notes?: Record<string, unknown>;
      booking_draft?: BookingDraft;
    };


    if (!amount || amount <= 0) {
      console.error('Invalid amount provided:', amount);
      return new Response(
        JSON.stringify({ error: 'Invalid amount. Amount must be greater than 0.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment-specific Razorpay config
    const env = getEnvironmentFromRequest(req);
    const razorpayConfig = getRazorpayConfig(env);
    
    console.log(`Using ${env} environment for Razorpay`);

    if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
      console.error(`Razorpay credentials not configured for ${env} environment`);
      return new Response(
        JSON.stringify({ error: `Payment service not configured for ${env} environment` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Amount should be in paise (smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    console.log('Creating Razorpay order:', { amountInPaise, currency, receipt, env });

    // Create Razorpay order
    const authHeader = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);
    
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: notes || {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Razorpay order creation failed:', data);
      return new Response(
        JSON.stringify({ error: data.error?.description || 'Failed to create order' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Razorpay order created successfully:', data.id);

    return new Response(
      JSON.stringify({
        orderId: data.id,
        amount: data.amount,
        currency: data.currency,
        keyId: razorpayConfig.keyId, // Send key ID to frontend for checkout
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in razorpay-create-order:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
