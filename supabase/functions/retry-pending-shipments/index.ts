// Sweeper: recovers bookings whose payment was captured but whose partner
// shipment never got created (browser closed, network drop, partner timeout),
// AND reconciles Razorpay Payment Links that were paid but never reported back
// to us (no webhook / customer closed the Razorpay page).
//
// - reconciles PENDING_PAYMENT rows whose payment link is now paid
// - reconciles pending booking_balance_payments links
// - resets rows stuck at BOOKING_IN_PROGRESS for > 10 minutes
// - retries create-consumer-shipment for paid rows with no AWB older than 3 min
//
// Safe to call repeatedly (cron every 5 minutes) — create-consumer-shipment
// claims each row atomically, so there is no double booking.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};

// Fetch a Razorpay Payment Link and return { status, paymentId } or null.
async function fetchPaymentLink(basic: string, linkId: string) {
  const res = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) {
    console.error("[retry] payment_link fetch failed", linkId, res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const data = await res.json();
  const paid = (data.payments || []).find((p: any) => p.status === "captured") ||
    (data.payments || [])[0] || null;
  return {
    status: String(data.status || ""),
    paymentId: paid?.payment_id || null,
    amount: typeof data.amount_paid === "number" ? data.amount_paid / 100 : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const env = (req.headers.get("x-environment") || "production") as "sandbox" | "production";

  try {
    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const threeMinAgo = new Date(now - 3 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 0. Reconcile Razorpay Payment Links that were paid but never reported.
    const rz = getRazorpayConfig(env);
    const linkResults: unknown[] = [];
    const orphans: Record<string, unknown>[] = [];
    if (rz.keyId && rz.keySecret) {
      const basic = btoa(`${rz.keyId}:${rz.keySecret}`);

      // 0a. Assisted bookings awaiting payment via link.
      const { data: pendingLinkRows } = await admin
        .from("bookings")
        .select("id,user_id,payment_link_id,payment_status,status,receiver_pincode,courier_price,created_at")
        .not("payment_link_id", "is", null)
        .neq("payment_status", "paid")
        .in("status", ["PENDING_PAYMENT", "BALANCE_DUE"])
        .gt("created_at", sevenDaysAgo)
        .limit(50);

      for (const row of pendingLinkRows || []) {
        const link = await fetchPaymentLink(basic, row.payment_link_id as string);
        if (!link) continue;
        if (link.status !== "paid" || !link.paymentId) {
          if (link.status && link.status !== row["payment_link_status" as never]) {
            await admin.from("bookings").update({ payment_link_status: link.status }).eq("id", row.id);
          }
          continue;
        }

        // Guard against double-booking a duplicate link for an order that is
        // already booked and paid (admin sometimes generates two links).
        const { data: sibling } = await admin
          .from("bookings")
          .select("id,prayog_awb")
          .eq("user_id", row.user_id)
          .eq("receiver_pincode", row.receiver_pincode)
          .eq("courier_price", row.courier_price)
          .eq("payment_status", "paid")
          .not("prayog_awb", "is", null)
          .neq("id", row.id)
          .gt("created_at", twoDaysAgo)
          .maybeSingle();

        const update: Record<string, unknown> = {
          payment_id: link.paymentId,
          payment_status: "paid",
          payment_link_status: "paid",
          status: sibling ? "DUPLICATE_PAYMENT_REVIEW" : "PAYMENT_RECEIVED",
        };
        if (sibling) {
          update.failure_reason =
            `Payment link paid but an identical shipment (${sibling.id}) is already booked. Needs manual review/refund.`;
          update.failure_step = "duplicate_payment_link";
        }
        const { error: updErr } = await admin.from("bookings").update(update).eq("id", row.id);
        linkResults.push({
          booking_id: row.id,
          payment_id: link.paymentId,
          duplicate_of: sibling?.id || null,
          error: updErr?.message || null,
        });
        console.log("[retry] reconciled payment link", row.payment_link_id, "→", row.id, link.paymentId);
      }

      // 0b. Balance-due payment links.
      const { data: pendingBalances } = await admin
        .from("booking_balance_payments")
        .select("id,booking_id,razorpay_payment_link_id,status,book_after_payment")
        .eq("status", "pending")
        .not("razorpay_payment_link_id", "is", null)
        .gt("created_at", sevenDaysAgo)
        .limit(50);

      for (const bal of pendingBalances || []) {
        const link = await fetchPaymentLink(basic, bal.razorpay_payment_link_id as string);
        if (!link || link.status !== "paid" || !link.paymentId) continue;
        await admin
          .from("booking_balance_payments")
          .update({ status: "paid", payment_id: link.paymentId, paid_at: new Date().toISOString() })
          .eq("id", bal.id);
        if (bal.book_after_payment && bal.booking_id) {
          await admin
            .from("bookings")
            .update({ status: "PAYMENT_RECEIVED", payment_status: "paid" })
            .eq("id", bal.booking_id)
            .eq("status", "BALANCE_DUE");
        }
        linkResults.push({ balance_payment_id: bal.id, payment_id: link.paymentId });
      }

      // 0c. Orphan captured payments: money taken but no bookings row at all.
      // Surfaced here (and logged) so support can refund or rebuild the order
      // instead of it silently disappearing.
      const fromSec = Math.floor((now - 7 * 24 * 60 * 60 * 1000) / 1000);
      const orphRes = await fetch(
        `https://api.razorpay.com/v1/payments?from=${fromSec}&to=${Math.floor(now / 1000)}&count=100`,
        { headers: { Authorization: `Basic ${basic}` } },
      );
      if (orphRes.ok) {
        const orphData = await orphRes.json();
        const captured = (orphData.items || []).filter((p: any) => p.status === "captured");
        const ids = captured.map((p: any) => p.id);
        const { data: known } = await admin
          .from("bookings")
          .select("payment_id")
          .in("payment_id", ids.length ? ids : ["__none__"]);
        const { data: knownBal } = await admin
          .from("booking_balance_payments")
          .select("payment_id")
          .in("payment_id", ids.length ? ids : ["__none__"]);
        const seen = new Set([
          ...(known || []).map((r: any) => r.payment_id),
          ...(knownBal || []).map((r: any) => r.payment_id),
        ]);
        for (const p of captured) {
          if (seen.has(p.id)) continue;
          orphans.push({
            payment_id: p.id,
            order_id: p.order_id,
            amount: p.amount / 100,
            contact: p.contact,
            email: p.email,
            amount_refunded: p.amount_refunded / 100,
            created_at: new Date(p.created_at * 1000).toISOString(),
            notes: p.notes,
          });
          console.warn("[retry] ORPHAN captured payment with no booking row:", p.id, p.amount / 100, p.contact);
        }
      }
    }


    // 1. Unstick abandoned in-progress claims.

    await admin.from("bookings")
      .update({ status: "PAYMENT_RECEIVED" })
      .eq("status", "BOOKING_IN_PROGRESS")
      .is("prayog_awb", null)
      .lt("updated_at", tenMinAgo);

    // 2. Find paid, AWB-less rows to retry.
    const { data: rows, error } = await admin
      .from("bookings")
      .select("id,created_at,courier_name,partner_id")
      .eq("payment_status", "paid")
      .in("status", ["PAYMENT_RECEIVED", "PENDING", "BOOKING_RETRY"])
      .is("prayog_awb", null)
      .lt("created_at", threeMinAgo)
      .gt("created_at", twoDaysAgo)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    const results: unknown[] = [];
    for (const row of rows || []) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/create-consumer-shipment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-key": serviceKey,
            "x-environment": env,
          },
          body: JSON.stringify({ booking_id: row.id }),
        });
        const out = await res.json().catch(() => ({}));
        results.push({ booking_id: row.id, status: res.status, ...out, booking: undefined });
      } catch (e) {
        results.push({ booking_id: row.id, error: String(e) });
      }
    }

    console.log(
      `[retry-pending-shipments] processed ${results.length} rows, reconciled ${linkResults.length} payment links`,
    );
    return new Response(
      JSON.stringify({ processed: results.length, results, payment_links: linkResults, orphan_payments: orphans }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[retry-pending-shipments] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
