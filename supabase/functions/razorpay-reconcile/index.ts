// Admin-only reconciliation: list every captured Razorpay payment in a date
// range and join against the `bookings` table by `payment_id`. Surfaces:
//   • orphans  — captured payments with NO bookings row (lost money)
//   • mismatches — bookings row exists but status indicates failure
//   • matched  — fully reconciled
//
// Auth: requires the caller to be an active admin in admin_users.
// Razorpay creds: re-uses RAZORPAY_PROD_KEY_ID / SECRET (live env only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

interface RzpPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string | null;
  method: string;
  email: string | null;
  contact: string | null;
  created_at: number;
  fee: number;
  tax: number;
  amount_refunded: number;
  refund_status: string | null;
  notes: Record<string, string> | unknown[] | null;
}

interface RzpRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  created_at: number;
  notes: Record<string, string> | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: standard Supabase session (admin uses email/password login).
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the JWT and resolve the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Service-role client for everything else
    const supabase = createClient(supabaseUrl, serviceKey);

    // Confirm admin
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id, role, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { from, to, action, payment_id, amount } = (await req.json().catch(() => ({}))) as {
      from?: string; // ISO date or unix seconds
      to?: string;
      action?: "list" | "refund" | "create_audit_row" | "ca_report";
      payment_id?: string;
      amount?: number;
    };

    const env = getEnvironmentFromRequest(req);
    const razorpayConfig = getRazorpayConfig(env);
    if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
      return new Response(
        JSON.stringify({ error: `Razorpay not configured for ${env}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const rzpAuth = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);

    const parseBoundary = (value: string | undefined, fallback: number) => {
      if (!value) return fallback;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : NaN;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const fromSec = parseBoundary(from, nowSec - 14 * 86400);
    const toSec = parseBoundary(to, nowSec);
    if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || fromSec > toSec) {
      return new Response(JSON.stringify({ error: "A valid reporting period is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpayGet = async (path: string) => {
      const response = await fetch(`https://api.razorpay.com/v1${path}`, {
        headers: { Authorization: `Basic ${rzpAuth}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.description || `Razorpay request failed (${response.status})`);
      }
      return data;
    };

    const pagedRazorpay = async <T>(resource: "payments" | "refunds") => {
      const rows: T[] = [];
      const count = 100;
      for (let skip = 0; skip < 5000; skip += count) {
        const data = await razorpayGet(`/${resource}?from=${fromSec}&to=${toSec}&count=${count}&skip=${skip}`);
        const items = (data?.items || []) as T[];
        rows.push(...items);
        if (items.length < count) break;
      }
      return rows;
    };

    if (action === "ca_report") {
      try {
        const [periodPayments, refunds] = await Promise.all([
          pagedRazorpay<RzpPayment>("payments"),
          pagedRazorpay<RzpRefund>("refunds"),
        ]);
        const captured = periodPayments.filter((payment) => payment.status === "captured");
        const paymentMap = new Map(captured.map((payment) => [payment.id, payment]));

        // A refund in this month can relate to a sale from an earlier month.
        for (const refund of refunds) {
          if (paymentMap.has(refund.payment_id)) continue;
          try {
            const original = await razorpayGet(`/payments/${encodeURIComponent(refund.payment_id)}`) as RzpPayment;
            paymentMap.set(original.id, original);
          } catch (error) {
            console.error("[razorpay-reconcile] original payment lookup failed", refund.payment_id, error);
          }
        }

        const payments = Array.from(paymentMap.values());
        const paymentIds = payments.map((payment) => payment.id);
        const bookingColumns = [
          "id", "payment_id", "payment_status", "status", "courier_name", "courier_price", "courier_rate",
          "base_fare", "platform_fee", "consumer_platform_fee", "gst", "packaging_amount", "insurance_amount",
          "sender_name", "sender_phone", "sender_city", "sender_state", "sender_pincode", "receiver_name",
          "receiver_city", "receiver_state", "receiver_pincode", "tracking_id", "prayog_awb", "booking_source",
          "account_type", "box_count", "refund_id", "refund_reason", "created_at",
        ].join(",");

        const bookingMap = new Map<string, any>();
        for (let index = 0; index < paymentIds.length; index += 200) {
          const batch = paymentIds.slice(index, index + 200);
          if (batch.length === 0) continue;
          const { data, error } = await supabase.from("bookings").select(bookingColumns).in("payment_id", batch);
          if (error) throw error;
          for (const booking of data || []) {
            if (booking.payment_id) bookingMap.set(booking.payment_id, booking);
          }
        }

        // Operational status detail follows booking creation date, while tax sales follow capture date.
        const { data: periodBookings, error: periodError } = await supabase
          .from("bookings")
          .select(bookingColumns)
          .gte("created_at", new Date(fromSec * 1000).toISOString())
          .lte("created_at", new Date(toSec * 1000).toISOString())
          .order("created_at", { ascending: true });
        if (periodError) throw periodError;
        for (const booking of periodBookings || []) {
          if (booking.payment_id && !bookingMap.has(booking.payment_id)) bookingMap.set(booking.payment_id, booking);
        }
        const bookings = Array.from(new Map(
          Array.from(bookingMap.values()).concat(periodBookings || []).map((booking) => [booking.id, booking]),
        ).values());

        const cancellationEvents: Record<string, string> = {};
        const bookingIds = bookings.map((booking: any) => booking.id);
        for (let index = 0; index < bookingIds.length; index += 200) {
          const batch = bookingIds.slice(index, index + 200);
          if (batch.length === 0) continue;
          const { data: events } = await supabase
            .from("shipment_status_events")
            .select("booking_id,event_time,normalized_status")
            .in("booking_id", batch)
            .eq("normalized_status", "CANCELLED")
            .order("event_time", { ascending: true });
          for (const event of events || []) {
            if (event.booking_id && !cancellationEvents[event.booking_id]) {
              cancellationEvents[event.booking_id] = event.event_time;
            }
          }
        }

        const exceptions: Array<Record<string, unknown>> = [];
        for (const payment of captured) {
          const booking = bookingMap.get(payment.id);
          const capturedAmount = payment.amount / 100;
          if (!booking) {
            exceptions.push({
              type: "ORPHAN_PAYMENT", payment_id: payment.id, amount: capturedAmount,
              detail: "Captured Razorpay payment has no booking record and is excluded from GST totals.",
            });
            continue;
          }
          const storedTotal = Number(booking.courier_price) || 0;
          if (Math.abs(capturedAmount - storedTotal) > 1) {
            exceptions.push({
              type: "PAYMENT_AMOUNT_MISMATCH", payment_id: payment.id, booking_id: booking.id,
              amount: capturedAmount - storedTotal,
              detail: `Captured ₹${capturedAmount.toFixed(2)} but stored booking total is ₹${storedTotal.toFixed(2)}.`,
            });
          }
          const split = (Number(booking.base_fare) || 0) + (Number(booking.gst) || 0) +
            (Number(booking.packaging_amount) || 0) + (Number(booking.insurance_amount) || 0);
          if (Math.abs(split - storedTotal) > 1) {
            exceptions.push({
              type: "STORED_SPLIT_MISMATCH", payment_id: payment.id, booking_id: booking.id,
              amount: split - storedTotal,
              detail: `Stored components total ₹${split.toFixed(2)} versus order total ₹${storedTotal.toFixed(2)}.`,
            });
          }
        }
        for (const refund of refunds) {
          const booking = bookingMap.get(refund.payment_id);
          if (!booking) {
            exceptions.push({
              type: "UNMATCHED_REFUND", payment_id: refund.payment_id, amount: refund.amount / 100,
              detail: `Refund ${refund.id} has no matching booking and is excluded from GST reversal totals.`,
            });
          }
        }
        for (const booking of periodBookings || []) {
          const status = String(booking.status || "").toLowerCase();
          if ((booking.payment_status === "refunded" || booking.payment_status === "refund_failed") && !booking.refund_id) {
            exceptions.push({
              type: "MISSING_REFUND_REFERENCE", booking_id: booking.id, payment_id: booking.payment_id,
              amount: Number(booking.courier_price) || 0,
              detail: "Booking is marked refunded/refund failed but has no stored refund ID.",
            });
          }
          if ((status.includes("cancel") || status.includes("failed")) && !cancellationEvents[booking.id]) {
            exceptions.push({
              type: "UNVERIFIED_CANCELLATION_DATE", booking_id: booking.id, payment_id: booking.payment_id,
              amount: Number(booking.courier_price) || 0,
              detail: "No reliable courier cancellation event timestamp is stored; booking date was not substituted.",
            });
          }
          if (["external_settled", "cop_pending"].includes(booking.payment_status)) {
            exceptions.push({
              type: "NON_RAZORPAY_COLLECTION", booking_id: booking.id, payment_id: booking.payment_id,
              amount: Number(booking.courier_price) || 0,
              detail: `Payment status ${booking.payment_status} requires CA review and is excluded from Razorpay sales totals.`,
            });
          }
        }

        const { data: balancePayments } = await supabase
          .from("booking_balance_payments")
          .select("id,booking_id,payment_id,amount_due,status,paid_at,created_at")
          .eq("status", "paid")
          .gte("paid_at", new Date(fromSec * 1000).toISOString())
          .lte("paid_at", new Date(toSec * 1000).toISOString());
        for (const balance of balancePayments || []) {
          exceptions.push({
            type: "BALANCE_PAYMENT_REVIEW", payment_id: balance.payment_id, booking_id: balance.booking_id,
            amount: Number(balance.amount_due) || 0,
            detail: "Additional booking balance was collected; tax allocation requires review because no separate GST split is stored.",
          });
        }

        return new Response(JSON.stringify({
          range: { from: new Date(fromSec * 1000).toISOString(), to: new Date(toSec * 1000).toISOString() },
          payments, refunds, bookings, exceptions, cancellation_events: cancellationEvents,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[razorpay-reconcile] CA report failed", error);
        return new Response(JSON.stringify({
          error: "Could not generate a complete report from Razorpay. No partial report was produced.",
          details: String(error),
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Refund action ─────────────────────────────────────────────
    if (action === "refund") {
      if (!payment_id) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const refundPayload: Record<string, unknown> = {};
      if (amount && amount > 0) refundPayload.amount = Math.round(amount * 100);
      refundPayload.notes = { reason: "admin_reconciliation_refund", admin_user_id: userId };

      const resp = await fetch(
        `https://api.razorpay.com/v1/payments/${payment_id}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${rzpAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(refundPayload),
        },
      );
      const data = await resp.json();
      if (!resp.ok) {
        return new Response(
          JSON.stringify({ error: data?.error?.description || "Refund failed", razorpay: data }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Update existing booking row if any
      await supabase
        .from("bookings")
        .update({
          payment_status: "refunded",
          refund_id: data.id,
          refund_reason: "admin_reconciliation_refund",
          status: "FAILED",
        })
        .eq("payment_id", payment_id);

      return new Response(
        JSON.stringify({
          refunded: true,
          refund_id: data.id,
          amount: data.amount / 100,
          status: data.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Create audit row for an orphan ────────────────────────────
    if (action === "create_audit_row") {
      if (!payment_id) {
        return new Response(JSON.stringify({ error: "payment_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Pull the payment from Razorpay for context
      const pResp = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` },
      });
      const pData = await pResp.json();
      if (!pResp.ok) {
        return new Response(
          JSON.stringify({ error: pData?.error?.description || "Payment not found" }),
          { status: pResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const row = {
        user_id: userId, // admin row — not a real customer row
        payment_id,
        payment_status: pData.amount_refunded >= pData.amount ? "refunded" : "paid",
        status: "ORPHAN_AUDIT",
        sender_name: "(admin audit)",
        sender_phone: pData.contact || "",
        sender_address: "Created from reconciliation",
        sender_city: "",
        sender_state: "",
        sender_pincode: "",
        receiver_name: "(unknown)",
        receiver_phone: "",
        receiver_address: "",
        receiver_city: "",
        receiver_state: "",
        receiver_pincode: "",
        goods_type: "unknown",
        package_weight: "0",
        urgency: "standard",
        courier_name: "(none)",
        courier_price: pData.amount / 100,
        delivery_time: "n/a",
        base_fare: 0,
        platform_fee: 0,
        gst: 0,
        booking_source: "admin_audit",
        refund_reason: "admin_audit_marked_resolved",
      };
      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert(row)
        .select()
        .single();
      if (insertErr) {
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ booking: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Default: list ─────────────────────────────────────────────
    // Default range: last 14 days
    // Page through Razorpay /payments
    const allPayments: RzpPayment[] = [];
    let skip = 0;
    const count = 100;
    let safety = 0;
    while (safety++ < 50) {
      const url = `https://api.razorpay.com/v1/payments?from=${fromSec}&to=${toSec}&count=${count}&skip=${skip}`;
      const resp = await fetch(url, { headers: { Authorization: `Basic ${rzpAuth}` } });
      const data = await resp.json();
      if (!resp.ok) {
        return new Response(
          JSON.stringify({ error: data?.error?.description || "Razorpay list failed", razorpay: data }),
          { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const items: RzpPayment[] = data.items || [];
      allPayments.push(...items);
      if (items.length < count) break;
      skip += count;
    }

    // Only count captured (i.e. money actually moved)
    const captured = allPayments.filter((p) => p.status === "captured");

    // Pull matching bookings rows in one query
    const ids = captured.map((p) => p.id);
    const { data: bookingsRows } = await supabase
      .from("bookings")
      .select(
        "id, payment_id, payment_status, status, courier_name, courier_price, sender_name, receiver_name, created_at, refund_id, refund_reason, user_id, booking_source",
      )
      .in("payment_id", ids.length ? ids : ["__none__"]);

    const bookingByPayment = new Map<string, any>();
    (bookingsRows || []).forEach((b) => {
      if (b.payment_id) bookingByPayment.set(b.payment_id, b);
    });

    const items = captured.map((p) => {
      const booking = bookingByPayment.get(p.id) || null;
      const amountRupees = p.amount / 100;
      const refundedRupees = (p.amount_refunded || 0) / 100;
      const fullyRefunded = p.amount_refunded >= p.amount && p.amount > 0;

      let category: "matched" | "orphan" | "failed" | "refunded";
      if (fullyRefunded) {
        category = "refunded";
      } else if (!booking) {
        category = "orphan";
      } else if (
        booking.status === "FAILED" ||
        booking.status === "PAYMENT_RECEIVED" ||
        booking.payment_status === "refund_failed"
      ) {
        category = "failed";
      } else {
        category = "matched";
      }

      return {
        payment_id: p.id,
        order_id: p.order_id,
        amount: amountRupees,
        amount_refunded: refundedRupees,
        currency: p.currency,
        method: p.method,
        contact: p.contact,
        email: p.email,
        captured_at: new Date(p.created_at * 1000).toISOString(),
        category,
        booking,
      };
    });

    const summary = {
      range: {
        from: new Date(fromSec * 1000).toISOString(),
        to: new Date(toSec * 1000).toISOString(),
      },
      total_payments: captured.length,
      total_amount: items.reduce((s, i) => s + i.amount, 0),
      orphan_count: items.filter((i) => i.category === "orphan").length,
      orphan_amount: items.filter((i) => i.category === "orphan").reduce((s, i) => s + i.amount, 0),
      failed_count: items.filter((i) => i.category === "failed").length,
      failed_amount: items.filter((i) => i.category === "failed").reduce((s, i) => s + i.amount, 0),
      matched_count: items.filter((i) => i.category === "matched").length,
      refunded_count: items.filter((i) => i.category === "refunded").length,
      refunded_amount: items.reduce((s, i) => s + i.amount_refunded, 0),
    };

    return new Response(JSON.stringify({ summary, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[razorpay-reconcile] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
