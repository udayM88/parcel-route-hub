import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-prayog-auth, x-environment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const prayogAuthHeader = req.headers.get("x-prayog-auth");
    if (!prayogAuthHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    try {
      const parsed = JSON.parse(prayogAuthHeader);
      userId = parsed.user_id;
      if (!userId) throw new Error("Missing user_id");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { booking_id, order_id } = await req.json().catch(() => ({}));
    if (!booking_id && !order_id) {
      return new Response(JSON.stringify({ error: "booking_id or order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase.from("bookings").select("*").eq("user_id", userId);
    if (booking_id) {
      query = query.eq("id", booking_id);
    } else {
      query = query.or(`prayog_order_id.eq.${order_id},tracking_id.eq.${order_id},prayog_awb.eq.${order_id}`);
    }

    const { data: b, error } = await query.maybeSingle();

    if (error) {
      console.error("get-booking-detail db error:", error);
      return new Response(JSON.stringify({ error: "Failed to load booking" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!b) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docs = b.label_url ? [{ id: 1, type: "label", url: b.label_url, is_active: true }] : [];

    // Multi-parcel orders: one AWB + one label per parcel.
    const { data: boxRows } = await supabase
      .from("booking_boxes")
      .select("*")
      .eq("booking_id", b.id)
      .order("box_index", { ascending: true });
    const parcels = (boxRows || []).map((bx: any) => ({
      id: bx.id,
      box_index: bx.box_index,
      weight_kg: Number(bx.weight_kg) || 0,
      length_cm: bx.length_cm != null ? Number(bx.length_cm) : null,
      width_cm: bx.width_cm != null ? Number(bx.width_cm) : null,
      height_cm: bx.height_cm != null ? Number(bx.height_cm) : null,
      price: bx.price != null ? Number(bx.price) : null,
      awb: bx.tracking_id || null,
      label_url: bx.label_url || null,
      status: bx.status,
      error_message: bx.error_message || null,
    }));

    const order = {
      orderId: b.prayog_order_id || b.id,
      orderDate: b.created_at,
      orderStatus: b.status || "CREATED",
      deliveryPromise: b.delivery_time || "Standard",
      carrierName: b.courier_name,
      carrierId: b.booking_source || "local",
      parcels,
      boxCount: Number(b.box_count || 1),
      shipments: parcels.length > 1
        ? parcels.map((p: any) => ({
          awbNumber: p.awb || "",
          partnerName: b.courier_name,
          shipmentStatus: p.status === "booked" ? (b.status || "CREATED") : "FAILED",
          physicalWeight: p.weight_kg,
          boxIndex: p.box_index,
          boxId: p.id,
          dimensions: (p.length_cm || p.width_cm || p.height_cm)
            ? { length: p.length_cm || 0, width: p.width_cm || 0, height: p.height_cm || 0 }
            : undefined,
          items: [{ name: b.goods_type, description: b.goods_type }],
          documents: p.label_url ? [{ id: p.box_index, type: "label", url: p.label_url, is_active: true }] : [],
        }))
        : [{
        awbNumber: b.prayog_awb || b.tracking_id || "",
        partnerName: b.courier_name,
        shipmentStatus: b.status || "CREATED",
        physicalWeight: b.package_weight ? Number(b.package_weight) : undefined,
        dimensions: (b.length || b.width || b.height)
          ? {
            length: Number(b.length) || 0,
            width: Number(b.width) || 0,
            height: Number(b.height) || 0,
          }
          : undefined,
        items: [{
          name: b.goods_type,
          description: b.goods_type,
          declaredValue: b.shipment_value ? Number(b.shipment_value) : undefined,
        }],
        documents: docs,
      }],
      addresses: [
        {
          type: "PICKUP",
          name: b.sender_name,
          phone: b.sender_phone,
          street: b.sender_address,
          city: b.sender_city,
          state: b.sender_state,
          zip: b.sender_pincode,
          country: "India",
        },
        {
          type: "DELIVERY",
          name: b.receiver_name,
          phone: b.receiver_phone,
          street: b.receiver_address,
          city: b.receiver_city,
          state: b.receiver_state,
          zip: b.receiver_pincode,
          country: "India",
        },
      ],
      payment: {
        // courier_price already stores the grand total charged to the user
        // (Base Fare + GST). Do NOT re-add GST here — it would double-count.
        // Add packaging/insurance only if they were charged on top.
        finalAmount: Number(b.courier_price || 0) +
          Number(b.packaging_amount || 0) + Number(b.insurance_amount || 0),
        type: b.payment_status === "cop_pending" ? "COP" : "PREPAID",
        breakdown: {
          otherCharges: [
            { name: "Base Fare", chargedAmount: Number(b.base_fare || 0) },
            { name: "GST (18%)", chargedAmount: Number(b.gst || 0) },
            ...(Number(b.packaging_amount || 0) > 0
              ? [{ name: "Packaging", chargedAmount: Number(b.packaging_amount) }]
              : []),
            ...(Number(b.insurance_amount || 0) > 0
              ? [{ name: "Insurance", chargedAmount: Number(b.insurance_amount) }]
              : []),
          ],
        },
      },
      metadata: {
        razorpay_payment_id: b.payment_id || undefined,
        source: b.booking_source || undefined,
        baseFare: Number(b.base_fare || 0),
        gstAmount: Number(b.gst || 0),
        totalAmount: Number(b.courier_price || 0),
        platformFee: Number(b.platform_fee || 0),
      },
      _booking: {
        id: b.id,
        booking_source: b.booking_source || "prayog",
        status: b.status || "CREATED",
        payment_status: b.payment_status || null,
        prayog_order_id: b.prayog_order_id || null,
        prayog_awb: b.prayog_awb || null,
        tracking_id: b.tracking_id || null,
        label_url: b.label_url || null,
        awb: b.prayog_awb || b.tracking_id || null,
        refund_id: b.refund_id || null,
        refund_reason: b.refund_reason || null,
        failure_reason: b.failure_reason || null,
        failure_step: b.failure_step || null,
        partner_error_raw: b.partner_error_raw || null,
      },
    };

    return new Response(JSON.stringify({ order }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-booking-detail error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
