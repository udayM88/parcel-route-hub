// Verifies the Razorpay signature AND immediately persists a booking row
// with status=PAYMENT_RECEIVED, payment_status=paid. This guarantees that
// every captured payment is auditable from the admin dashboard, even if the
// browser closes before the courier API call. The client later updates the
// row to CREATED on success, or confirm-booking-or-refund flips it to FAILED
// and refunds it.
import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment, x-prayog-auth",
};

interface BookingDraft {
  // Buyer / sender
  sender_name?: string;
  sender_phone?: string;
  sender_address?: string;
  sender_city?: string;
  sender_state?: string;
  sender_pincode?: string;
  // Receiver
  receiver_name?: string;
  receiver_phone?: string;
  receiver_address?: string;
  receiver_city?: string;
  receiver_state?: string;
  receiver_pincode?: string;
  // Package
  goods_type?: string;
  package_weight?: string | number;
  length?: string | number | null;
  width?: string | number | null;
  height?: string | number | null;
  shipment_value?: number | null;
  urgency?: string;
  // Courier
  courier_name?: string;
  courier_price?: number;
  delivery_time?: string;
  base_fare?: number;
  platform_fee?: number;
  gst?: number;
  packaging_amount?: number;
  insurance_amount?: number;
  booking_source?: string;
  partner_id?: string;
  service_code?: string;
  courier_rate?: number;
  retail_price?: number;
  margin_amount?: number;
  account_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      booking_draft,
    } = body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      booking_draft?: BookingDraft;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error("Missing required payment verification fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields for payment verification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const env = getEnvironmentFromRequest(req);
    const razorpayConfig = getRazorpayConfig(env);
    console.log(`Using ${env} environment for Razorpay verification`);

    if (!razorpayConfig.keySecret) {
      console.error(`Razorpay secret not configured for ${env} environment`);
      return new Response(
        JSON.stringify({ error: `Payment service not configured for ${env} environment` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
    const hmac = createHmac("sha256", razorpayConfig.keySecret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expectedSignature = hmac.digest("hex");
    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.error("Payment signature verification failed");
      return new Response(
        JSON.stringify({ verified: false, error: "Payment signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Payment verified successfully:", razorpay_payment_id);

    // ── Persist a PAYMENT_RECEIVED booking row immediately ──
    // Requires Prayog auth header to know which user this row belongs to.
    let bookingRowId: string | null = null;
    let persistError: string | null = null;
    const prayogAuthHeader = req.headers.get("x-prayog-auth");

    if (prayogAuthHeader && booking_draft) {
      try {
        const auth = JSON.parse(prayogAuthHeader);
        const userId = auth?.user_id;
        if (!userId) throw new Error("Missing user_id in prayog auth");

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        // Idempotency: if a row already exists for this payment_id, reuse it.
        const { data: existing } = await supabase
          .from("bookings")
          .select("id")
          .eq("payment_id", razorpay_payment_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existing?.id) {
          bookingRowId = existing.id;
          console.log("[verify-payment] reusing existing booking row:", bookingRowId);
        } else {
          const row = {
            user_id: userId,
            payment_id: razorpay_payment_id,
            payment_status: "paid",
            status: "PAYMENT_RECEIVED",
            // sender
            sender_name: booking_draft.sender_name ?? "",
            sender_phone: booking_draft.sender_phone ?? "",
            sender_address: booking_draft.sender_address ?? "",
            sender_city: booking_draft.sender_city ?? "",
            sender_state: booking_draft.sender_state ?? "",
            sender_pincode: booking_draft.sender_pincode ?? "",
            // receiver
            receiver_name: booking_draft.receiver_name ?? "",
            receiver_phone: booking_draft.receiver_phone ?? "",
            receiver_address: booking_draft.receiver_address ?? "",
            receiver_city: booking_draft.receiver_city ?? "",
            receiver_state: booking_draft.receiver_state ?? "",
            receiver_pincode: booking_draft.receiver_pincode ?? "",
            // package
            goods_type: booking_draft.goods_type ?? "Package",
            package_weight: String(booking_draft.package_weight ?? "1"),
            length: booking_draft.length != null ? String(booking_draft.length) : null,
            width: booking_draft.width != null ? String(booking_draft.width) : null,
            height: booking_draft.height != null ? String(booking_draft.height) : null,
            shipment_value: booking_draft.shipment_value ?? null,
            urgency: booking_draft.urgency ?? "standard",
            // courier + financials
            courier_name: booking_draft.courier_name ?? "",
            courier_price: booking_draft.courier_price ?? 0,
            delivery_time: booking_draft.delivery_time ?? "Standard",
            base_fare: booking_draft.base_fare ?? 0,
            platform_fee: booking_draft.platform_fee ?? 0,
            gst: booking_draft.gst ?? 0,
            packaging_amount: booking_draft.packaging_amount ?? 0,
            insurance_amount: booking_draft.insurance_amount ?? 0,
            booking_source: booking_draft.booking_source ?? "unknown",
            partner_id: booking_draft.partner_id ?? null,
            service_code: booking_draft.service_code ?? null,
            courier_rate: booking_draft.courier_rate ?? null,
            retail_price: booking_draft.retail_price ?? null,
            margin_amount: booking_draft.margin_amount ?? null,
            account_type: booking_draft.account_type ?? "consumer",
          };

          const { data: inserted, error: insertErr } = await supabase
            .from("bookings")
            .insert(row)
            .select("id")
            .single();

          if (insertErr) {
            persistError = insertErr.message;
            console.error("[verify-payment] failed to insert booking row:", insertErr);
          } else {
            bookingRowId = inserted.id;
            console.log("[verify-payment] inserted PAYMENT_RECEIVED row:", bookingRowId);
          }
        }
      } catch (e: any) {
        persistError = String(e?.message || e);
        console.error("[verify-payment] persist threw:", e);
      }
    } else {
      // Not fatal — payment is still verified. Reconciliation will catch it.
      console.warn(
        "[verify-payment] skipping booking row insert (missing prayog auth or draft)",
      );
    }

    // ── Create the partner shipment server-side ──────────────────
    // Runs independently of the browser: even if the tab closes right after
    // payment, the shipment still gets manifested (and auto-refunded on
    // partner failure). The client polls get-booking-detail for the result.
    if (bookingRowId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const shipmentTask = fetch(`${supabaseUrl}/functions/v1/create-consumer-shipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": serviceKey,
          "x-environment": env,
        },
        body: JSON.stringify({ booking_id: bookingRowId }),
      })
        .then(async (r) => {
          console.log(
            "[verify-payment] create-consumer-shipment:",
            r.status,
            (await r.text()).slice(0, 500),
          );
        })
        .catch((e) => console.error("[verify-payment] shipment trigger failed:", e));

      // Keep the isolate alive until the shipment call finishes.
      try {
        // deno-lint-ignore no-explicit-any
        (globalThis as any).EdgeRuntime?.waitUntil?.(shipmentTask);
      } catch { /* ignore */ }
    }


    return new Response(
      JSON.stringify({
        verified: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        booking_id: bookingRowId,
        persist_error: persistError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in razorpay-verify-payment:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
