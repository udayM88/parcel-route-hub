// Verifies the Razorpay signature AND immediately persists a booking row
// with status=PAYMENT_RECEIVED, payment_status=paid. This guarantees that
// every captured payment is auditable from the admin dashboard, even if the
// browser closes before the courier API call. The client later updates the
// row to CREATED on success, or confirm-booking-or-refund flips it to FAILED
// and refunds it.
import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";
import { buildBookingRow, type BookingDraft } from "../_shared/booking-draft.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment, x-prayog-auth",
};


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

        // Otherwise claim the PENDING_PAYMENT row pre-created at order time.
        const { data: preRow } = existing?.id ? { data: null } : await supabase
          .from("bookings")
          .select("id")
          .eq("razorpay_order_id", razorpay_order_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existing?.id) {
          bookingRowId = existing.id;
          console.log("[verify-payment] reusing existing booking row:", bookingRowId);
        } else if (preRow?.id) {
          const { error: updErr } = await supabase
            .from("bookings")
            .update({
              payment_id: razorpay_payment_id,
              payment_status: "paid",
              status: "PAYMENT_RECEIVED",
            })
            .eq("id", preRow.id);
          if (updErr) {
            persistError = updErr.message;
            console.error("[verify-payment] failed to claim pre-payment row:", updErr);
          } else {
            bookingRowId = preRow.id;
            console.log("[verify-payment] claimed pre-payment row:", bookingRowId);
          }
        } else {

          const row = {
            ...buildBookingRow(booking_draft, userId),
            payment_id: razorpay_payment_id,
            razorpay_order_id: razorpay_order_id,
            payment_status: "paid",
            status: "PAYMENT_RECEIVED",
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
