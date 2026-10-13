// Shared prepaid-wallet helpers for business accounts.
// All balance movements go through the `wallet_apply` DB function, which locks
// the wallet row, refuses to go negative and is idempotent per key.
// Wallet-paid bookings store payment_id = "wallet:<booking_id>".
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const WALLET_PREFIX = "wallet:";
export const isWalletPayment = (paymentId?: string | null) =>
  !!paymentId && paymentId.startsWith(WALLET_PREFIX);

export type WalletResult = { ok: boolean; error?: string; balance?: number; required?: number; transaction_id?: string; duplicate?: boolean };

export async function walletApply(
  admin: SupabaseClient,
  args: {
    business_account_id: string; amount: number; type: string;
    booking_id?: string | null; note?: string | null; idempotency_key?: string | null;
    razorpay_order_id?: string | null; payment_id?: string | null;
    actor?: string | null; actor_email?: string | null;
  },
): Promise<WalletResult> {
  const { data, error } = await admin.rpc("wallet_apply", {
    _business_account_id: args.business_account_id,
    _amount: Math.round(args.amount * 100) / 100,
    _type: args.type,
    _booking_id: args.booking_id ?? null,
    _note: args.note ?? null,
    _idempotency_key: args.idempotency_key ?? null,
    _razorpay_order_id: args.razorpay_order_id ?? null,
    _payment_id: args.payment_id ?? null,
    _actor: args.actor ?? null,
    _actor_email: args.actor_email ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return data as WalletResult;
}

/** Refund (part of) a wallet-paid booking back to the business wallet. Never refunds more than was charged. */
export async function refundWalletBooking(
  admin: SupabaseClient, bookingId: string, amount: number | undefined, reason: string,
): Promise<WalletResult & { refunded?: number }> {
  const { data: txs } = await admin.from("wallet_transactions")
    .select("business_account_id,type,amount").eq("booking_id", bookingId);
  const charge = (txs || []).filter((t: any) => t.type === "charge");
  if (!charge.length) return { ok: false, error: "No wallet charge found for this booking" };
  const charged = -charge.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const refunded = (txs || []).filter((t: any) => t.type === "refund").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const remaining = Math.max(0, charged - refunded);
  const amt = Math.min(remaining, amount && amount > 0 ? amount : remaining);
  if (amt <= 0) return { ok: true, duplicate: true, refunded: 0 };
  const res = await walletApply(admin, {
    business_account_id: charge[0].business_account_id, amount: amt, type: "refund",
    booking_id: bookingId, note: reason, idempotency_key: `refund:${bookingId}:${reason}:${amt}`,
  });
  return { ...res, refunded: amt };
}
