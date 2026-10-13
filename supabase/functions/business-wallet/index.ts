// Business prepaid wallet: Razorpay top-ups + admin adjustments.
// Actions (POST JSON { action }):
//   create_topup  { amount }                         -> Razorpay order (business user)
//   verify_topup  { razorpay_order_id, razorpay_payment_id, razorpay_signature } -> credits wallet
//   admin_adjust  { business_account_id, amount, reason }  (super_admin / operations)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";
import { walletApply } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MIN_TOPUP = 100;
const MAX_TOPUP = 500000;

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await authClient.auth.getUser();
    if (!u?.user) return json({ error: "Invalid session" }, 401);
    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "admin_adjust") {
      const { data: au } = await admin.from("admin_users").select("role,email")
        .eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
      if (!au || !["super_admin", "operations"].includes(au.role)) return json({ error: "Forbidden" }, 403);
      const amount = Number(body.amount);
      const reason = String(body.reason || "").trim();
      if (!body.business_account_id || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > MAX_TOPUP) {
        return json({ error: "Valid business_account_id and non-zero amount required" }, 400);
      }
      if (reason.length < 3) return json({ error: "Reason is required" }, 400);
      const r = await walletApply(admin, {
        business_account_id: body.business_account_id, amount, type: "adjustment",
        note: reason, actor: u.user.id, actor_email: au.email,
        idempotency_key: body.request_id ? `adjust:${body.request_id}` : null,
      });
      if (!r.ok) return json({ error: r.error === "insufficient_balance" ? "Debit is larger than the wallet balance" : r.error }, 400);
      return json({ success: true, balance: r.balance });
    }

    const { data: biz } = await admin.from("business_accounts").select("id,status,company_name")
      .eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    if (!biz || biz.status !== "approved") return json({ error: "Business account not approved" }, 403);

    const env = getEnvironmentFromRequest(req);
    const rz = getRazorpayConfig(env);
    if (!rz.keyId || !rz.keySecret) return json({ error: "Payment service not configured" }, 500);
    const basic = `Basic ${btoa(`${rz.keyId}:${rz.keySecret}`)}`;

    if (action === "create_topup") {
      const amount = Math.round(Number(body.amount));
      if (!(amount >= MIN_TOPUP && amount <= MAX_TOPUP)) {
        return json({ error: `Top-up must be between ₹${MIN_TOPUP} and ₹${MAX_TOPUP}` }, 400);
      }
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST", headers: { Authorization: basic, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * 100, currency: "INR", receipt: `wal_${Date.now()}`,
          notes: { purpose: "wallet_topup", business_account_id: biz.id },
        }),
      });
      const order = await res.json();
      if (!res.ok) return json({ error: order?.error?.description || "Could not create payment" }, 502);
      return json({ success: true, order_id: order.id, amount, key_id: rz.keyId, company: biz.company_name });
    }

    if (action === "verify_topup") {
      const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = body;
      if (!oid || !pid || !sig) return json({ error: "Missing payment details" }, 400);
      if ((await hmacHex(rz.keySecret, `${oid}|${pid}`)) !== sig) return json({ error: "Invalid payment signature" }, 400);

      const oRes = await fetch(`https://api.razorpay.com/v1/orders/${oid}`, { headers: { Authorization: basic } });
      const order = await oRes.json();
      if (!oRes.ok || order?.notes?.purpose !== "wallet_topup" || order?.notes?.business_account_id !== biz.id) {
        return json({ error: "Payment does not belong to this wallet" }, 400);
      }
      const pRes = await fetch(`https://api.razorpay.com/v1/payments/${pid}`, { headers: { Authorization: basic } });
      let pay = await pRes.json();
      if (!pRes.ok || pay.order_id !== oid) return json({ error: "Payment not found" }, 400);
      if (pay.status === "authorized") {
        const cRes = await fetch(`https://api.razorpay.com/v1/payments/${pid}/capture`, {
          method: "POST", headers: { Authorization: basic, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: pay.amount, currency: "INR" }),
        });
        pay = await cRes.json();
        if (!cRes.ok) return json({ error: pay?.error?.description || "Capture failed" }, 502);
      }
      if (pay.status !== "captured") return json({ error: `Payment status is ${pay.status}` }, 400);

      const r = await walletApply(admin, {
        business_account_id: biz.id, amount: pay.amount / 100, type: "topup",
        note: "Wallet top-up via Razorpay", idempotency_key: `topup:${pid}`,
        razorpay_order_id: oid, payment_id: pid, actor: u.user.id,
      });
      if (!r.ok) return json({ error: r.error }, 500);
      return json({ success: true, credited: pay.amount / 100, balance: r.balance, duplicate: !!r.duplicate });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[business-wallet]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
