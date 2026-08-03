# ViaSetu for Businesses + New Pricing Strategy

Two connected pieces of work: a separate business portal with admin-created accounts and multi-box booking, and a full replacement of the pricing engine for both consumer and business shipments.

---

## 1. New pricing strategy (replaces the existing one)

The current formula (`3x card price + ₹50 zone fee`, then 18% GST added on top) is removed everywhere.

**Consumer / regular shipments**

- ViaSetu price = courier API rate x 1.70 (70% blanket margin), rounded to the rupee.
- That price is **all-inclusive** — GST to be added and displayed and partner charges are considered already inside it. No GST line is added on top.
- Retail (strike-through) price = courier API rate x 3, rounded.
- Savings shown as a percentage: `(retail − viasetu) / retail`, displayed next to the struck retail price.

Example, courier rate ₹100: retail ₹300, ViaSetu **₹170**, "You save 43%".

**Business shipments**

- Price per box = courier API rate + ₹15 flat, all-inclusive. ₹15 is the ViaSetu revenue per shipment.
- No 3x retail strike-through and no savings badge for business accounts.
- Order total = sum across all boxes in the booking.

Everywhere a price appears — courier comparison cards, smart ranking, comparison table, review step, payment, order details, invoices, admin revenue/reconciliation reporting — reads from the single new pricing module so the numbers always agree.

Stored per booking: courier rate, retail price, final price, margin amount, and account type (consumer vs business), so revenue reporting stays correct for both models.

---

## 2. ViaSetu for Businesses portal

**Accounts are created by admin only.** There is no public business signup.

*Admin side (new "Business Users" screen under Admin):*

- Create a business user: company name, contact person, email, phone, PAN, GST number, shop act / registration number, expected monthly shipment volume, and address.
- Upload / review the supporting documents attached to the company before approving.
- Approve, reject, deactivate or reactivate a business account.
- On approval the system creates the login and emails a set-your-password link.
- List view of all business accounts with status, volume and shipment count.

*Business side (`/viasetuforbusinesses`):*

- Its own branded login page (email + password, same mechanism as the admin/CMS/ops logins) with forgot-password.
- Only approved, active business accounts can get in; anyone else is bounced back to the login.
- Business dashboard: shipment stats, quick "New shipment" action, order history, and company profile (read-only, admin-managed).

---

## 3. Multi-box booking for business users

- In the business booking flow, one order can contain N boxes going to the **same destination pincode**.
- Each box has its own weight and dimensions; chargeable weight is computed per box (dead vs volumetric, existing logic retained).
- Serviceability and rates are fetched once for the route; the per-box price is `rate for that box + ₹15`.
- The review screen shows a per-box breakdown plus the order total.
- On confirmation, the partner API is called **once per box**, so each box receives its own AWB and label. The order shows all AWBs and offers all labels.
- If some boxes succeed and others fail, the order records partial success and the failed boxes are flagged for retry/refund rather than silently dropped.

---

## Technical notes

- **Pricing**: rewrite `src/lib/pricing.ts` around `computeConsumerPrice(rate)` → `{ retail, price, savingsPct }` and `computeBusinessPrice(rate)` → `rate + 15`. Update all call sites: `Booking.tsx`, `BookingStep2/5`, `ETACard`, `SmartRanking`, `PartnerComparisonTable`, `BookingReviewStep`, `OrderDetails`, plus the edge functions `calculate-price`, `calculate-platform-fee`, `save-booking`, `razorpay-create-order`, `razorpay-verify-payment`, `send-order-admin-email`, and admin revenue/reconciliation/analytics pages.
- **Database migration**: new `business_accounts` table (company details, KYC doc paths, status, monthly volume, linked `user_id`) with `is_business_user()` / `get_business_account()` security-definer helpers, RLS restricting a business user to their own record and admins to all; new `booking_boxes` table (booking_id, index, weight, dims, awb, label_url, status); new columns on `bookings` for `account_type`, `business_account_id`, `courier_rate`, `retail_price`, `margin_amount`, `box_count`; private storage bucket for business KYC documents with admin-only read.
- **Auth**: business login reuses the Supabase Auth email/password pattern in `StaffLogin.tsx`, but authorises against `business_accounts` instead of `admin_users` (a new `BusinessAuthContext` + `ProtectedBusinessRoute`, mirroring the admin ones). No `@viasetu.com` domain enforcement.
- **Edge functions**: `create-business-user` (admin-only; creates auth user, business_accounts row, sends password-reset invite), and a multi-box path in the booking pipeline that loops the existing per-partner booking functions once per box and aggregates results.
- **Routes**: `/viasetuforbusinesses` (login), `/viasetuforbusinesses/dashboard`, `/ship`, `/orders`, `/profile`, `/reset-password`; admin gets `/admin/business-users`.

## Out of scope

- Consumer users cannot self-upgrade to business — admin creates the account.
- Billing/credit terms and invoicing changes beyond reflecting the new prices.