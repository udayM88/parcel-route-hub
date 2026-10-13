import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isWalletPayment, refundWalletBooking, WALLET_PREFIX } from "../_shared/wallet.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-environment',
};

interface RefundRequest {
  payment_id: string;
  amount?: number; // Optional: partial refund amount in rupees. If omitted, full refund.
  notes?: Record<string, string>;
  reason?: string; // Optional reason for the refund
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RefundRequest = await req.json();
    const { payment_id, amount, notes, reason } = body;

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Wallet-paid business bookings: credit the prepaid wallet instead of Razorpay.
    if (isWalletPayment(payment_id)) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const bookingId = payment_id.slice(WALLET_PREFIX.length);
      const r = await refundWalletBooking(admin, bookingId, amount, reason || 'refund');
      if (!r.ok) {
        return new Response(JSON.stringify({ error: r.error || 'Wallet refund failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        refund_id: r.transaction_id ? `wallet_${r.transaction_id}` : `wallet_${bookingId}`,
        payment_id, amount: r.refunded ?? 0, status: 'processed', speed_processed: 'instant',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const env = getEnvironmentFromRequest(req);
    const razorpayConfig = getRazorpayConfig(env);

    console.log(`[razorpay-refund] Processing refund for payment: ${payment_id}, env: ${env}`);

    if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
      console.error(`Razorpay credentials not configured for ${env} environment`);
      return new Response(
        JSON.stringify({ error: `Payment service not configured for ${env} environment` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);

    // Build refund payload
    const refundPayload: Record<string, unknown> = {};
    if (amount) {
      // Razorpay expects amount in paise
      refundPayload.amount = Math.round(amount * 100);
    }
    if (notes) {
      refundPayload.notes = notes;
    }
    if (reason) {
      // Razorpay supports: duplicate, fraudulent, requested_by_customer, other (undocumented but works)
      refundPayload.speed = 'normal'; // 'normal' (5-7 days) or 'optimum' (instant if eligible)
    }

    console.log(`[razorpay-refund] Refund payload:`, refundPayload);

    // Call Razorpay Refunds API
    const response = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(refundPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[razorpay-refund] Refund API error:`, data);
      return new Response(
        JSON.stringify({ 
          error: data.error?.description || 'Failed to process refund',
          razorpay_error: data.error 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[razorpay-refund] Refund successful:`, {
      refund_id: data.id,
      payment_id: data.payment_id,
      amount: data.amount,
      status: data.status,
    });

    return new Response(
      JSON.stringify({
        refund_id: data.id,
        payment_id: data.payment_id,
        amount: data.amount / 100, // Convert paise back to rupees
        status: data.status,
        speed_processed: data.speed_processed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[razorpay-refund] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
