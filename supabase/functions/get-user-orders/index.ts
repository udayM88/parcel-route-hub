import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-prayog-auth, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const prayogAuthHeader = req.headers.get('x-prayog-auth');
    if (!prayogAuthHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userId: string;
    try {
      const prayogAuth = JSON.parse(prayogAuthHeader);
      userId = prayogAuth.user_id;
      if (!userId) throw new Error('Missing user_id');
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('get-user-orders db error:', error);
      throw error;
    }

    // Hide un-paid checkout drafts (rows pre-created before Razorpay checkout).
    // Assisted payment-link rows stay visible so the customer can still pay.
    const visible = (data || []).filter((b: any) =>
      !(!b.payment_id && !b.payment_link_id &&
        ["PENDING_PAYMENT", "PAYMENT_ABANDONED"].includes(String(b.status || "")))
    );

    // Normalize Supabase rows into the same shape as Prayog orders (subset used by History UI)
    const orders = visible.map((b: any) => {

      const docs = b.label_url
        ? [{ id: 1, type: 'label', url: b.label_url, is_active: true }]
        : [];

      return {
        // Prefer prayog_order_id when present; fall back to local id so dedupe still works
        orderId: b.prayog_order_id || b.id,
        _localBookingId: b.id,
        orderDate: b.created_at,
        orderStatus: b.status || 'CREATED',
        carrierName: b.courier_name,
        carrierId: b.booking_source || 'local',
        parcelCategory: b.goods_type,
        shipments: [{
          awbNumber: b.prayog_awb || b.tracking_id || '',
          partnerName: b.courier_name,
          shipmentStatus: b.status || 'CREATED',
          physicalWeight: b.package_weight ? Number(b.package_weight) : undefined,
          dimensions: (b.length || b.width || b.height) ? {
            length: Number(b.length) || 0,
            width: Number(b.width) || 0,
            height: Number(b.height) || 0,
          } : undefined,
          items: [{
            name: b.goods_type,
            description: b.goods_type,
            declaredValue: b.shipment_value ? Number(b.shipment_value) : undefined,
          }],
          documents: docs,
        }],
        addresses: [
          {
            type: 'PICKUP',
            name: b.sender_name,
            phone: b.sender_phone,
            street: b.sender_address,
            city: b.sender_city,
            state: b.sender_state,
            zip: b.sender_pincode,
            country: 'India',
          },
          {
            type: 'DELIVERY',
            name: b.receiver_name,
            phone: b.receiver_phone,
            street: b.receiver_address,
            city: b.receiver_city,
            state: b.receiver_state,
            zip: b.receiver_pincode,
            country: 'India',
          },
        ],
        payment: {
          // courier_price already includes GST (stores grand total). Don't re-add GST.
          finalAmount: Number(b.courier_price || 0) + Number(b.packaging_amount || 0) + Number(b.insurance_amount || 0),
        },
        // Booking metadata used by Cancel/Label/Details buttons (avoids a second roundtrip)
        _booking: {
          id: b.id,
          booking_source: b.booking_source || 'prayog',
          status: b.status || 'CREATED',
          payment_status: b.payment_status || null,
          prayog_order_id: b.prayog_order_id || null,
          prayog_awb: b.prayog_awb || null,
          tracking_id: b.tracking_id || null,
          label_url: b.label_url || null,
          awb: b.prayog_awb || b.tracking_id || null,
          failure_reason: b.failure_reason || null,
          failure_step: b.failure_step || null,
          refund_id: b.refund_id || null,
        },
        statusReason: b.failure_reason || null,
      };
    });

    return new Response(JSON.stringify({ orders }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('get-user-orders error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
