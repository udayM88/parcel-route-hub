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

    // Persist a PENDING_PAYMENT booking row *before* the customer pays, keyed by
    // the Razorpay order id. If the browser dies after payment, the sweeper can
    // still match the captured payment to this row and complete the shipment —
    // no captured payment can end up orphaned.
    let bookingRowId: string | null = null;
    const prayogAuthHeader = req.headers.get('x-prayog-auth');
    if (prayogAuthHeader && booking_draft) {
      try {
        const userId = JSON.parse(prayogAuthHeader)?.user_id;
        if (userId) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          );
          const { data: inserted, error: insErr } = await supabase
            .from('bookings')
            .insert({
              ...buildBookingRow(booking_draft, userId),
              razorpay_order_id: data.id,
              status: 'PENDING_PAYMENT',
              payment_status: 'pending',
            })
            .select('id')
            .single();
          if (insErr) console.error('[create-order] draft persist failed:', insErr);
          else {
            bookingRowId = inserted.id;
            console.log('[create-order] pre-payment booking row:', bookingRowId);
          }
        }
      } catch (e) {
        console.error('[create-order] draft persist threw:', e);
      }
    }

    return new Response(
      JSON.stringify({
        orderId: data.id,
        amount: data.amount,
        currency: data.currency,
        keyId: razorpayConfig.keyId, // Send key ID to frontend for checkout
        booking_id: bookingRowId,
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
