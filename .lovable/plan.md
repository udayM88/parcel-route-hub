# Prepaid Wallet + API Keys + Merchant Shipping API

## What the business customer gets
1. **Wallet tab (Business Portal)**: current balance, "Add Money" via Razorpay, full transaction history (top-ups, shipment charges, refunds), low-balance warning.
2. **API Keys tab (Business Portal)**: create a key (shown once), name it, see last-used time, revoke it. Choose Sandbox or Live key.
3. **Shipping API** their developers call from their website: check rates, create shipment, get label, track, cancel. Each shipment is charged from the wallet; cancellations/failures refund back to the wallet automatically.
4. **Developer docs page** inside the portal with copy-paste examples.

## What admins get
- Business Management: see each business's wallet balance and ledger, make manual credit/debit adjustments (reason required), see/revoke their API keys.

## Rules
- Shipment is booked only if the wallet covers the full GST-inclusive price; otherwise the API returns "insufficient balance" and nothing is booked.
- Money is reserved before booking the courier, then finalized on success or released on failure — no lost or double charges.
- Business pricing, partner enable/disable, and serviceability rules stay exactly as in the portal.
- Existing portal booking keeps working; portal bookings may optionally also pay from wallet (later step).
- Logins (OTP, business, admin) unchanged.

## Build order
1. Wallet + ledger + Razorpay top-up + admin adjustments.
2. API key create/revoke tab.
3. Merchant API: rates, create, label, track, cancel (wallet-charged).
4. Docs page + sandbox keys.
5. Later: webhooks to customer sites, Shopify/WooCommerce plugins.

## Technical details
- Tables: `business_wallets` (balance, one per business), `wallet_transactions` (append-only ledger: type topup/charge/refund/hold/release/adjustment, amount, booking_id, razorpay ids, idempotency key), `business_api_keys` (key prefix, SHA-256 hash only, env, name, last_used_at, revoked_at). RLS: business reads own rows; writes only via edge functions (service role). GRANTs included.
- Balance changes via a security-definer DB function with row lock so concurrent API calls cannot overspend.
- Edge functions: `wallet-topup` (create/verify Razorpay order, credit on verified capture; idempotent), `business-api-keys` (create/list/revoke), `merchant-api` (single endpoint, action routing; auth via `Authorization: Bearer vs_live_...`; per-key rate limit; `Idempotency-Key` header to prevent duplicate shipments), reusing `business-create-shipment` pricing/booking logic and `_shared/partner-key.ts`.
- Cancellation/failure paths credit refunds to wallet instead of Razorpay for wallet-paid bookings (`payment_status = 'wallet'`).
- Tests: wallet cannot go negative, insufficient balance blocks booking, failed booking releases hold, duplicate idempotency key returns same shipment.
