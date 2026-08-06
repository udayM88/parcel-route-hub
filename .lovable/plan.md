# Validate business rate-card pricing (364003 → 400059)

## What the logs and code show

For this exact lane, the Delhivery serviceability function logged:

```text
[rate-cards] tolerance exceeded partner=delhivery mode=surface zone=D1 api=87 card=70 delta=24.3%
[rate-cards] tolerance exceeded partner=delhivery mode=express zone=D1 api=133 card=107 delta=24.3%
```

So the live partner API is quoting 24.3% above the contracted card (ViaSetu_1.xlsx). The current
reconciliation rule in `resolvePrice` / `verifyAgainstCard` is:

- delta within ±20% → use API price
- delta above 20% but below 2x card → **still use API price** (only logs a warning)
- above 2x card → force card price

That is why the business user sees the higher number. Chain for 1 kg surface:

```text
card    70  → business (70+15) x 1.18 = 100
api     87  → business (87+15) x 1.18 = 120   <- what is displayed today
```

The business math itself (`courier rate + 15`, then 18% GST) is applied consistently in
`src/lib/pricing.ts` and in `business-create-shipment`, so the gap is entirely the courier rate
source, not the margin/GST layer.

## Two things to confirm before changing anything

1. **Which rate is "actual"** — is the contracted card (70) the number that ViaSetu is actually
   invoiced for this lane, or is the Delhivery API (87) correct and the card zone mapping wrong?
   Bhavnagar → Mumbai is currently classified as zone D1 (same region, not both metro). If the
   contract puts this lane in a cheaper zone, the card table lookup is what needs fixing.
2. **Whether the Delhivery API amount already includes GST.** If it does, the business flow adds
   18% on top of a tax-inclusive figure and every business quote is inflated regardless of zone.
   This will be checked by calling `delhivery-serviceability` for 364003 → 400059 and inspecting
   the raw API breakdown fields returned alongside `api_price`.

## Work

1. Run the serviceability functions for 364003 → 400059 at a few weights (0.5 / 1 / 2 / 5 kg)
   across all five partners and tabulate: raw API price, card price, delta, chosen price, and the
   resulting business total. This gives a concrete validation sheet rather than a single data point.
2. Confirm the GST question above from the raw Delhivery response.
3. Apply the fix indicated by the findings, one of:
   - **Card wins on breach** — change `verifyAgainstCard` so `delta_exceeds_tolerance` chooses the
     card price (currently it chooses API), making the contracted card authoritative and the API
     only a sanity check. This is the change if the card is the true contracted rate.
   - **Fix the zone** — correct the Delhivery zone mapping for the Gujarat ↔ Maharashtra
     (non-metro origin → metro destination) case if the card lookup is what is wrong.
   - **Strip GST** — de-duplicate GST in the business path if the API amount is already inclusive.
4. Re-run the same table after the fix and confirm the displayed business total matches the manual
   calculation for each weight.

## Technical notes

- `supabase/functions/_shared/rate-cards.ts`: `verifyAgainstCard` (tolerance branch returns
  `chosen: "api"`), `delhiveryZone`, `DELHIVERY_SURFACE` / `DELHIVERY_EXPRESS` slabs.
- `supabase/functions/delhivery-serviceability/index.ts`: already surfaces `api_price`,
  `card_price`, `rate_source`, `card_delta_pct` in service metadata — used for the validation table.
- `src/lib/pricing.ts`: `computeBusinessNet` / `computeBusinessPrice` /
  `computeBusinessBreakdown` — unchanged unless the GST-duplication case is confirmed.
- `supabase/functions/business-create-shipment/index.ts` mirrors the same formula and must stay in
  sync with any pricing change.
