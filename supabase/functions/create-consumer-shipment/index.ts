import { dispatchSms } from "../_shared/notify-sms.ts";
import { dispatchEmail } from "../_shared/notify-email.ts";
// Server-side consumer shipment creation.
//
// Called (a) by razorpay-verify-payment in the background right after a
// payment is verified, and (b) by retry-pending-shipments (sweeper / admin).
//
// It takes a bookings row that is at PAYMENT_RECEIVED with no AWB, fires the
// correct partner booking edge function, and persists the AWB / label /
// status. On partner failure it auto-refunds through confirm-booking-or-refund
// so money is never held without a shipment.
//
// Auth: internal only — caller must present the service role key in the
// `x-internal-key` header (or an Authorization bearer with the same value).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment, x-internal-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function pickPartnerFn(row: { partner_id?: string | null; courier_name?: string | null; booking_source?: string | null }): string | null {
  const s = `${row.partner_id || ""} ${row.booking_source || ""} ${row.courier_name || ""}`
    .toLowerCase();
  if (s.includes("shadowfax")) return "shadowfax-booking";
  if (s.includes("delhivery")) return "delhivery-booking";
  if (s.includes("urbanebolt") || s.includes("urbane bolt")) return "urbanebolt-booking";
  if (s.includes("xpressbees") || s.includes("xpress bees")) return "xpressbees-booking";
  if (s.includes("maruti") || s.includes("smile")) return "shree-maruti-booking";
  return null;
}

function partnerIdFromFn(fn: string): string {
  return fn.replace(/-booking$/, "").replace(/-/g, "_") + "_direct";
}

function genOrderId(): string {
  const now = new Date();
  const ts = [
    now.getFullYear().toString().slice(-2),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0"),
  ].join("");
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = Array.from({ length: 6 }, () => cs[Math.floor(Math.random() * cs.length)]).join("");
  return ts + rand;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Internal auth ────────────────────────────────────────────────
  const provided = req.headers.get("x-internal-key") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!provided || provided !== serviceKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "");
    const env = (req.headers.get("x-environment") || body?.environment || "production") as string;
    if (!bookingId) return json({ error: "booking_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: row, error: rowErr } = await admin
      .from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (rowErr || !row) return json({ error: "Booking not found" }, 404);

    // Already booked → nothing to do.
    if (row.prayog_awb || row.tracking_id) {
      return json({
        booked: true, already: true,
        awb_number: row.prayog_awb, tracking_id: row.tracking_id, label_url: row.label_url,
      });
    }
    // 'external_settled' = admin-created booking where the customer paid
    // outside ViaSetu; there is no Razorpay payment to verify or refund.
    if (row.payment_status !== "paid" && row.payment_status !== "external_settled") {
      return json({ booked: false, error: `Payment not settled (payment_status=${row.payment_status})` });
    }

    // ── Claim the row so two concurrent runs can't double-book ──────
    const { data: claimed } = await admin
      .from("bookings")
      .update({ status: "BOOKING_IN_PROGRESS" })
      .eq("id", bookingId)
      .in("status", ["PAYMENT_RECEIVED", "PENDING", "BOOKING_RETRY"])
      .is("prayog_awb", null)
      .select("id")
      .maybeSingle();

    if (!claimed) {
      return json({ booked: false, skipped: true, reason: `status=${row.status} (not claimable)` });
    }

    const partnerFn = pickPartnerFn(row);
    if (!partnerFn) {
      await admin.from("bookings").update({
        status: "PAYMENT_RECEIVED",
        failure_step: "manifest",
        failure_reason: `Could not determine courier partner for '${row.courier_name}'. Awaiting manual booking.`,
      }).eq("id", bookingId);
      return json({ booked: false, error: "Unknown partner — manual booking required" });
    }

    const orderId = row.prayog_order_id || genOrderId();
    const partnerPayload = {
      order_id: orderId,
      sender_name: row.sender_name,
      sender_phone: row.sender_phone,
      sender_address: row.sender_address,
      sender_pincode: row.sender_pincode,
      sender_city: row.sender_city,
      sender_state: row.sender_state,
      receiver_name: row.receiver_name,
      receiver_phone: row.receiver_phone,
      receiver_address: row.receiver_address,
      receiver_pincode: row.receiver_pincode,
      receiver_city: row.receiver_city,
      receiver_state: row.receiver_state,
      package_weight: parseFloat(String(row.package_weight || "1")) || 1,
      goods_type: row.goods_type || "Package",
      shipment_value: row.shipment_value ? Number(row.shipment_value) : 0,
      length: row.length ? parseFloat(String(row.length)) || 10 : 10,
      width: row.width ? parseFloat(String(row.width)) || 10 : 10,
      height: row.height ? parseFloat(String(row.height)) || 10 : 10,
      service_code: row.service_code || undefined,
    };

    // ── Multi-parcel orders ─────────────────────────────────────────
    // One courier, one partner booking call per parcel, so every parcel gets
    // its own AWB and its own shipping label. Parcels that the courier
    // rejects are refunded individually; accepted parcels stay live.
    const { data: boxRows } = await admin
      .from("booking_boxes")
      .select("*")
      .eq("booking_id", bookingId)
      .order("box_index", { ascending: true });

    if (boxRows && boxRows.length > 1) {
      const results: any[] = [];
      for (const box of boxRows) {
        if (box.tracking_id) {
          results.push({ box_index: box.box_index, success: true, tracking_id: box.tracking_id, label_url: box.label_url });
          continue;
        }
        const boxOrderId = box.partner_order_id || `${orderId}${String(box.box_index).padStart(2, "0")}`;
        let ok = false;
        let awb: string | null = null;
        let labelUrl: string | null = null;
        let errorMessage: string | null = null;
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/${partnerFn}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
              "x-environment": env,
            },
            body: JSON.stringify({
              ...partnerPayload,
              order_id: boxOrderId,
              package_weight: Number(box.weight_kg) || partnerPayload.package_weight,
              length: Number(box.length_cm) || partnerPayload.length,
              width: Number(box.width_cm) || partnerPayload.width,
              height: Number(box.height_cm) || partnerPayload.height,
            }),
          });
          const text = await res.text();
          let payload: any;
          try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
          if (res.ok && payload?.success) {
            ok = true;
            awb = payload.awbNumber || payload.awb || payload.awb_number || payload.orderId || boxOrderId;
            labelUrl = payload.label_url || payload.labelUrl || null;
          } else {
            errorMessage = String(payload?.error || payload?.message || text).slice(0, 400);
          }
        } catch (e) {
          errorMessage = String((e as Error)?.message || e).slice(0, 400);
        }

        await admin.from("booking_boxes").update({
          status: ok ? "booked" : "failed",
          tracking_id: awb,
          partner_order_id: boxOrderId,
          label_url: labelUrl,
          error_message: errorMessage,
        }).eq("id", box.id);

        results.push({ box_index: box.box_index, success: ok, tracking_id: awb, label_url: labelUrl, error: errorMessage });
      }

      const booked = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      // All parcels rejected → full refund through the standard path.
      if (booked.length === 0) {
        let refunded = false;
        let refundId: string | null = null;
        if (row.payment_id) {
          try {
            const refRes = await fetch(`${supabaseUrl}/functions/v1/confirm-booking-or-refund`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
                "x-environment": env,
                "x-prayog-auth": JSON.stringify({ user_id: row.user_id }),
              },
              body: JSON.stringify({
                payment_id: row.payment_id,
                reason: `${partnerFn.replace("-booking", "")}_booking_failed`,
                error_detail: String(failed[0]?.error || "All parcels rejected").slice(0, 1500),
              }),
            });
            const refJson = await refRes.json().catch(() => ({}));
            refunded = !!refJson?.refunded;
            refundId = refJson?.refund_id || null;
          } catch (e) {
            console.error("[create-consumer-shipment] multi refund threw:", e);
          }
        }
        if (!refunded) {
          await admin.from("bookings").update({
            status: "PAYMENT_RECEIVED",
            failure_step: "manifest",
            failure_reason: "Courier could not accept any parcel. Our team is on it.",
            partner_error_raw: String(failed[0]?.error || "").slice(0, 2000),
          }).eq("id", bookingId);
        }
        dispatchEmail("order_rejected", bookingId, { failure_reason: String(failed[0]?.error || "").slice(0, 500) });
        dispatchSms("ORDER_FAILED", bookingId, { vars: { failure_reason: String(failed[0]?.error || "").slice(0, 120) } });
        if (refunded) dispatchEmail("order_refunded", bookingId, { refund_reason: "Partner booking failed" });
        return json({ booked: false, boxes: results, refunded, refund_id: refundId });
      }

      // Partial failure → refund only the rejected parcels' amounts.
      let partialRefundId: string | null = null;
      if (failed.length > 0 && row.payment_id) {
        const failedAmount = failed.reduce((sum, r) => {
          const bx = boxRows.find((b: any) => b.box_index === r.box_index);
          return sum + (Number(bx?.price) || 0);
        }, 0);
        if (failedAmount > 0) {
          try {
            const refRes = await fetch(`${supabaseUrl}/functions/v1/razorpay-refund`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
                "x-environment": env,
              },
              body: JSON.stringify({
                payment_id: row.payment_id,
                amount: Math.round(failedAmount),
                reason: `parcels_rejected:${failed.map((f) => f.box_index).join(",")}`,
              }),
            });
            const refJson = await refRes.json().catch(() => ({}));
            partialRefundId = refJson?.refund?.refund_id || refJson?.refund_id || null;
          } catch (e) {
            console.error("[create-consumer-shipment] partial refund threw:", e);
          }
        }
      }

      const firstBooked = booked[0];
      const { data: updatedMulti } = await admin.from("bookings").update({
        status: "CREATED",
        prayog_awb: firstBooked.tracking_id,
        tracking_id: firstBooked.tracking_id,
        label_url: firstBooked.label_url,
        prayog_order_id: orderId,
        partner_id: row.partner_id || partnerIdFromFn(partnerFn),
        booking_source: partnerIdFromFn(partnerFn),
        box_count: boxRows.length,
        failure_reason: failed.length
          ? `${failed.length} of ${boxRows.length} parcels were rejected by the courier and refunded.`
          : null,
        failure_step: failed.length ? "manifest_partial" : null,
        refund_id: partialRefundId || row.refund_id || null,
        refund_reason: failed.length ? "partial_parcel_rejection" : row.refund_reason,
        partner_error_raw: failed.length ? String(failed[0]?.error || "").slice(0, 2000) : null,
      }).eq("id", bookingId).select().single();

      try {
        fetch(`${supabaseUrl}/functions/v1/send-order-admin-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ booking_id: bookingId }),
        }).catch(() => {});
      } catch { /* ignore */ }
      dispatchEmail("order_confirmed", bookingId);
      dispatchSms("ORDER_CONFIRMED", bookingId);

      return json({
        booked: true,
        multi: true,
        awb_number: firstBooked.tracking_id,
        tracking_id: firstBooked.tracking_id,
        label_url: firstBooked.label_url,
        boxes: results,
        failed_count: failed.length,
        partial_refund_id: partialRefundId,
        booking: updatedMulti || null,
      });
    }

    console.log(`[create-consumer-shipment] ${bookingId} → ${partnerFn}`, JSON.stringify(partnerPayload));

    let partnerJson: any = null;
    let partnerOk = false;
    let partnerText = "";
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${partnerFn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          "x-environment": env,
        },
        body: JSON.stringify(partnerPayload),
      });
      partnerText = await res.text();
      try { partnerJson = JSON.parse(partnerText); } catch { partnerJson = { raw: partnerText }; }
      partnerOk = res.ok && !!partnerJson?.success;
    } catch (e) {
      partnerText = String(e);
      console.error("[create-consumer-shipment] partner call threw:", e);
    }

    if (!partnerOk) {
      const errDetail =
        partnerJson?.error || partnerJson?.message || partnerText.slice(0, 800) || "Unknown partner error";
      console.error(`[create-consumer-shipment] ${bookingId} partner failed:`, errDetail);

      // Auto-refund + FAILED audit via the centralized refund function.
      let refunded = false;
      let refundId: string | null = null;
      if (row.payment_id) {
        try {
          const refRes = await fetch(`${supabaseUrl}/functions/v1/confirm-booking-or-refund`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
              "x-environment": env,
              "x-prayog-auth": JSON.stringify({ user_id: row.user_id }),
            },
            body: JSON.stringify({
              payment_id: row.payment_id,
              reason: `${partnerFn.replace("-booking", "")}_booking_failed`,
              error_detail: String(errDetail).slice(0, 1500),
            }),
          });
          const refJson = await refRes.json().catch(() => ({}));
          refunded = !!refJson?.refunded;
          refundId = refJson?.refund_id || null;
        } catch (e) {
          console.error("[create-consumer-shipment] refund threw:", e);
        }
      }

      if (!refunded) {
        // Leave it recoverable for the sweeper / admin instead of losing the payment silently.
        await admin.from("bookings").update({
          status: "PAYMENT_RECEIVED",
          failure_step: "manifest",
          failure_reason: "Courier could not accept the booking. Our team is on it.",
          partner_error_raw: String(errDetail).slice(0, 2000),
        }).eq("id", bookingId);
      }

      dispatchEmail("order_rejected", bookingId, { failure_reason: String(errDetail).slice(0, 500) });
      dispatchSms("ORDER_FAILED", bookingId, { vars: { failure_reason: String(errDetail).slice(0, 120) } });
      if (refunded) dispatchEmail("order_refunded", bookingId, { refund_reason: "Partner booking failed" });

      return json({ booked: false, error: String(errDetail).slice(0, 500), refunded, refund_id: refundId });
    }

    const awb: string | null = partnerJson.awbNumber || partnerJson.awb || null;
    const labelUrl: string | null = partnerJson.label_url || partnerJson.labelUrl || null;
    const trackingId: string = awb || partnerJson.orderId || orderId;

    const { data: updated, error: updErr } = await admin.from("bookings").update({
      status: "CREATED",
      prayog_awb: awb,
      tracking_id: trackingId,
      label_url: labelUrl,
      prayog_order_id: partnerJson.orderId || orderId,
      partner_id: row.partner_id || partnerIdFromFn(partnerFn),
      booking_source: partnerIdFromFn(partnerFn),
      failure_reason: null,
      failure_step: null,
      partner_error_raw: null,
    }).eq("id", bookingId).select().single();

    if (updErr) console.error("[create-consumer-shipment] update error:", updErr);

    // Admin notification (best effort).
    try {
      fetch(`${supabaseUrl}/functions/v1/send-order-admin-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ booking_id: bookingId }),
      }).catch(() => {});
    } catch { /* ignore */ }
    dispatchEmail("order_confirmed", bookingId);
      dispatchSms("ORDER_CONFIRMED", bookingId);

    console.log(`[create-consumer-shipment] ${bookingId} booked, awb=${awb}`);

    return json({
      booked: true,
      awb_number: awb,
      tracking_id: trackingId,
      label_url: labelUrl,
      booking: updated || null,
    });
  } catch (err) {
    console.error("[create-consumer-shipment] error:", err);
    return json({ error: "Internal server error", details: String(err) }, 500);
  }
});
