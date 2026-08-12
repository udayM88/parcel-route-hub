// Customer-facing balance collection for orders that were re-booked with a
// different courier at a higher price.
//
// Auth: Prayog session header `x-prayog-auth` ({ user_id }).
//
// Actions (POST body { action }):
//   list          → open/paid balance rows for the signed-in customer
//   create-order  → creates a Razorpay order for the outstanding balance
//   verify        → verifies the signature, marks the balance paid and (when
//                   the admin chose "book after payment") fires the partner
//                   shipment creation server-side.
import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment, x-prayog-auth",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("x-prayog-auth");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    let userId = "";
    try {
      userId = String(JSON.parse(authHeader)?.user_id || "");
    } catch { /* handled below */ }
    if (!userId) return json({ error: "Invalid authentication" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    // ── list ────────────────────────────────────────────────────────
    if (action === "list") {
      const { data, error } = await db
        .from("booking_balance_payments")
        .select(
          "id,booking_id,status,amount_due,previous_amount,new_amount,previous_courier_name,new_courier_name,reason,collection_mode,razorpay_payment_link_url,book_after_payment,created_at,paid_at",
        )
        .eq("user_id", userId)
        .in("status", ["pending", "paid"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ balances: data || [] });
    }

    const balanceId = String(body?.balance_id || "").trim();
    if (!balanceId) return json({ error: "balance_id is required" }, 400);

    const { data: bal } = await db
      .from("booking_balance_payments").select("*").eq("id", balanceId).maybeSingle();
    if (!bal || bal.user_id !== userId) return json({ error: "Balance not found" }, 404);
    if (bal.status !== "pending") {
      return json({ error: `This balance is already ${bal.status}` }, 409);
    }

    const env = getEnvironmentFromRequest(req);
    const rz = getRazorpayConfig(env);
    if (!rz.keyId || !rz.keySecret) {
      return json({ error: `Payment service not configured for ${env}` }, 500);
    }

    // ── create-order ────────────────────────────────────────────────
    if (action === "create-order") {
      const amountPaise = Math.round(Number(bal.amount_due) * 100);
      if (!amountPaise || amountPaise < 100) return json({ error: "Invalid balance amount" }, 400);

      const basic = btoa(`${rz.keyId}:${rz.keySecret}`);
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `bal_${balanceId.slice(0, 20)}`,
          notes: { balance_id: balanceId, booking_id: bal.booking_id, type: "booking_balance" },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[booking-balance] razorpay order failed", data);
        return json({ error: data?.error?.description || "Failed to create order" }, 502);
      }
      await db.from("booking_balance_payments")
        .update({ razorpay_order_id: data.id }).eq("id", balanceId);
      return json({
        orderId: data.id, amount: data.amount, currency: data.currency, keyId: rz.keyId,
      });
    }

    // ── verify ──────────────────────────────────────────────────────
    if (action === "verify") {
      const orderId = String(body?.razorpay_order_id || "");
      const paymentId = String(body?.razorpay_payment_id || "");
      const signature = String(body?.razorpay_signature || "");
      if (!orderId || !paymentId || !signature) {
        return json({ error: "Missing payment verification fields" }, 400);
      }
      const hmac = createHmac("sha256", rz.keySecret);
      hmac.update(`${orderId}|${paymentId}`);
      if (hmac.digest("hex") !== signature) {
        return json({ verified: false, error: "Payment signature verification failed" }, 400);
      }

      await db.from("booking_balance_payments").update({
        status: "paid",
        payment_id: paymentId,
        razorpay_order_id: orderId,
        paid_at: new Date().toISOString(),
      }).eq("id", balanceId);

      // Fire the partner shipment when the admin held it back until payment.
      let booked = false;
      if (bal.book_after_payment) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/create-consumer-shipment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-key": serviceKey,
              "x-environment": env,
            },
            body: JSON.stringify({ booking_id: bal.booking_id }),
          });
          booked = res.ok;
        } catch (e) {
          console.error("[booking-balance] shipment creation failed:", e);
        }
      }

      return json({ verified: true, booked });
    }

    return json({ error: `Unknown action '${action}'` }, 400);
  } catch (err) {
    console.error("[booking-balance] error:", err);
    return json({ error: "Internal server error", details: String(err) }, 500);
  }
});
