# Normalise Delhivery rate to pre-GST, keep one rate path for both models

## Problem

Every partner feeds a pre-tax `courier_rate` into pricing except Delhivery, which returns
a GST-inclusive `total_amount`. Since both consumer (`rate x 1.70 x 1.18`) and business
(`(rate + 15) x 1.18`) add 18% on top, Delhivery quotes carry GST twice and land ~18%
above the other partners.

## Fix

In `delhivery-serviceability`, take the pre-tax figure from the rate response instead of
the tax-inclusive one:

- Use `gross_amount` as the rate; fall back to `total_amount / 1.18` only if `gross_amount`
  is absent, and log when that fallback triggers.
- Keep the existing rate-card verification/fallback (`resolvePrice`) untouched — the cards
  are already pre-GST, so the API-vs-card delta becomes meaningful again instead of showing
  a permanent +24% skew.
- Expose the raw values in the service `metadata` (`api_gross`, `api_total`) for debugging.

## GST is then applied exactly once, on both sides

No change to the pricing formulas — they already add GST, and after this fix their input is
consistently GST-exclusive for all five partners:

- Consumer: `round(rate x 1.70 x 1.18)` — displayed price is GST-inclusive.
- Business: `round((rate + 15) x 1.18)` — displayed price is GST-inclusive.

## Rate fetching is already shared

Both the consumer booking flow and the business booking flow call the same five
`*-serviceability` edge functions with the same payload shape, so this single change fixes
Delhivery pricing everywhere (consumer quotes, business quotes, admin assisted booking) with
no duplicate logic to keep in sync. `business-create-shipment` recomputes from the same
partner rate, so its stored `base_fare` / `gst` / `margin_amount` follow automatically.

## Verification

Re-quote 364003 → 400059, 1 kg after the change and confirm Delhivery surface comes through
at the pre-tax figure (~73-74 rather than ~87), and that consumer and business displayed
totals for the same partner rate differ only by the intended margin.
