// Admin-only: attach an AWB that was created manually on a courier portal to
// an existing (usually stuck / PAYMENT_RECEIVED) booking, so tracking, label
// download and cancellation all work through the normal partner plumbing.
//
// Input: { booking_id, partner, awb, partner_order_id?, label_url?, note? }
// partner ∈ delhivery | urbanebolt | xpressbees | shadowfax | shree_maruti
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const ALLOWED_ROLES = new Set(["super_admin", "operations", "support"]);

const PARTNERS: Record<string, string> = {
  delhivery: "Delhivery",
  urbanebolt: "UrbaneBolt",
  xpressbees: "XpressBees",
  shadowfax: "Shadowfax",
  shree_maruti: "Shree Maruti",
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
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("role,is_active,email")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminRow?.is_active || !ALLOWED_ROLES.has(adminRow.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "").trim();
    const partner = String(body?.partner || "").trim().toLowerCase();
    const awb = String(body?.awb || "").trim();
    const partnerOrderId = body?.partner_order_id ? String(body.partner_order_id).trim() : null;
    const labelUrl = body?.label_url ? String(body.label_url).trim() : null;
    const note = body?.note ? String(body.note).trim().slice(0, 500) : null;
    const replaceExisting = body?.replace === true;
    // Optional uploaded label file: { name, content_type, data(base64) }
    const labelFile = body?.label_file && body.label_file.data ? body.label_file : null;

    // ── Price difference handling ────────────────────────────────────
    // new_price = final customer-facing price with the new partner.
    const newPrice = body?.new_price != null && body.new_price !== ""
      ? Number(body.new_price)
      : null;
    const differenceAction = body?.difference_action
      ? String(body.difference_action).trim().toLowerCase() // link | in_app | waive
      : null;
    const waiveReason = body?.waive_reason ? String(body.waive_reason).trim().slice(0, 300) : null;
    const bookAfterPayment = body?.book_after_payment === true;

    if (!bookingId) return json({ error: "booking_id is required" }, 400);
    if (!PARTNERS[partner]) {
      return json({ error: `partner must be one of: ${Object.keys(PARTNERS).join(", ")}` }, 400);
    }
    // AWB is optional only when the shipment is deliberately held back until
    // the customer settles the balance.
    if (!bookAfterPayment && (!awb || awb.length < 4 || awb.length > 64)) {
      return json({ error: "awb must be between 4 and 64 characters" }, 400);
    }
    if (awb && (awb.length < 4 || awb.length > 64)) {
      return json({ error: "awb must be between 4 and 64 characters" }, 400);
    }
    if (labelUrl && !/^https?:\/\//i.test(labelUrl)) {
      return json({ error: "label_url must be a valid http(s) URL" }, 400);
    }
    if (differenceAction && !["link", "in_app", "waive"].includes(differenceAction)) {
      return json({ error: "difference_action must be link, in_app or waive" }, 400);
    }
    if (differenceAction === "waive" && !waiveReason) {
      return json({ error: "A reason is required to waive the difference" }, 400);
    }

    const { data: row } = await admin
      .from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!row) return json({ error: "Booking not found" }, 404);
    const existingAwb = row.prayog_awb || row.tracking_id;
    if (existingAwb && !replaceExisting) {
      return json({
        error: `This booking already has AWB ${existingAwb}`,
        existing_awb: existingAwb,
        requires_replace: true,
      }, 409);
    }


    // Upload a manually supplied label (PDF/image) to the private bucket and
    // keep a long-lived signed URL on the booking so admins and the customer
    // can download it from their usual screens.
    let uploadedLabelUrl: string | null = null;
    if (labelFile) {
      try {
        const contentType = String(labelFile.content_type || "application/pdf");
        const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
        if (!allowed.includes(contentType)) {
          return json({ error: "Label must be a PDF, PNG or JPG file" }, 400);
        }
        const bytes = Uint8Array.from(atob(String(labelFile.data)), (c) => c.charCodeAt(0));
        if (bytes.length > 5 * 1024 * 1024) {
          return json({ error: "Label file must be under 5 MB" }, 400);
        }
        const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1];
        const path = `${bookingId}/${awb}-${Date.now()}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("shipping-labels")
          .upload(path, bytes, { contentType, upsert: true });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await admin.storage
          .from("shipping-labels")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (signErr) throw signErr;
        uploadedLabelUrl = signed?.signedUrl || null;
      } catch (e) {
        console.error("[admin-attach-manual-awb] label upload failed:", e);
        return json({ error: `Label upload failed: ${String(e)}` }, 500);
      }
    }

    const auditTrail = [
      row.partner_error_raw || null,
      [
        `${existingAwb ? "AWB replaced" : "Manual AWB added"} by ${adminRow.email} at ${new Date().toISOString()}`,
        existingAwb ? `Previous AWB: ${existingAwb}` : null,
        note ? `Note: ${note}` : null,
      ].filter(Boolean).join(" | "),
    ].filter(Boolean).join("\n").slice(0, 2000);

    const { data: updated, error: updErr } = await admin.from("bookings").update({
      status: "CREATED",
      prayog_awb: awb,
      tracking_id: awb,
      prayog_order_id: partnerOrderId || row.prayog_order_id || awb,
      label_url: uploadedLabelUrl || labelUrl || (replaceExisting ? null : row.label_url),
      partner_id: `${partner}_direct`,
      // keep the standard `<partner>_direct` source so tracking/label lookups work
      booking_source: `${partner}_direct`,
      courier_name: PARTNERS[partner],
      failure_reason: null,
      failure_step: null,
      partner_error_raw: auditTrail,
    }).eq("id", bookingId).select().single();

    if (updErr) {
      console.error("[admin-attach-manual-awb] update failed:", updErr);
      return json({ error: updErr.message }, 500);
    }

    console.log(`[admin-attach-manual-awb] ${bookingId} → ${partner} ${awb} by ${adminRow.email}`);
    return json({ success: true, booking: updated });
  } catch (err) {
    console.error("[admin-attach-manual-awb] error:", err);
    return json({ error: "Internal server error", details: String(err) }, 500);
  }
});
