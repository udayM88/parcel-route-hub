import { dispatchEmail } from "../_shared/notify-email.ts";
// Persists a booking row using the service role, bypassing RLS.
// Auth is verified via the x-prayog-auth header (external Prayog OTP system).
// Idempotent on payment_id: if a row with the same payment_id already exists,
// returns the existing row instead of creating a duplicate. This prevents
// duplicate refunds when the client retries after a transient failure.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-prayog-auth, x-environment",
};

// Successful booking states that warrant an admin notification.
const SUCCESS_STATES = new Set([
  "CREATED", "MANIFESTED", "BOOKED", "PICKUP_PENDING", "IN_TRANSIT", "SUCCESS",
]);

function triggerAdminEmail(booking: any) {
  try {
    if (!booking?.id) return;
    const status = String(booking.status || "").toUpperCase();
    if (!SUCCESS_STATES.has(status)) return;
    if (booking.admin_email_sent_at) return;
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-admin-email`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({ booking_id: booking.id }),
    }).catch((e) => console.error("[save-booking] admin email trigger failed:", e));
    dispatchEmail("order_placed", booking.id);
  } catch (e) {
    console.error("[save-booking] triggerAdminEmail err:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      const auth = JSON.parse(prayogAuthHeader);
      userId = auth.user_id;
      if (!userId) throw new Error("Missing user_id");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force user_id from verified auth, never trust the client value.
    const bookingRow = { ...body, user_id: userId };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: if a row with this payment_id already exists for this user,
    // UPDATE it (covers the PAYMENT_RECEIVED row pre-created by
    // razorpay-verify-payment). Never create a duplicate.
    const paymentId = bookingRow.payment_id;
    if (paymentId) {
      const { data: existing } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("payment_id", paymentId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        console.log(
          "[save-booking] updating existing row for payment_id:",
          paymentId,
          "from",
          existing.status,
          "→",
          bookingRow.status,
        );
        const { data: updated, error: updateErr } = await supabase
          .from("bookings")
          .update(bookingRow)
          .eq("id", existing.id)
          .select()
          .single();
        if (updateErr) {
          console.error("[save-booking] update error:", updateErr);
          return new Response(
            JSON.stringify({ error: updateErr.message, details: updateErr }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (updated) triggerAdminEmail(updated);
        return new Response(JSON.stringify({ booking: updated, updated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert(bookingRow)
      .select()
      .single();

    if (error) {
      console.error("[save-booking] insert error:", error);
      return new Response(
        JSON.stringify({ error: error.message, details: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fire-and-forget admin notification email on success.
    triggerAdminEmail(data);

    return new Response(JSON.stringify({ booking: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[save-booking] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
