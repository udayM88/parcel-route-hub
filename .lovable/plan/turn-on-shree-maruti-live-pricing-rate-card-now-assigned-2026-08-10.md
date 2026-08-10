# Turn on Shree Maruti live pricing (rate card now assigned)

The Api-Key auth path is already live in the code. The last test failed only because Innofulfill returned "No active COURIER rate card assignment found for tenant". Now that the rate card is assigned on the portal, the next step is verification, not new code.

## Steps

1. Re-test the live rate call for a few lanes (e.g. 364003 → 400059 surface and air, 1 kg and 5 kg) and read the response metadata: `rate_source`, `api_price`, `card_price`, `card_delta_pct`.
2. If `rate_source` comes back as `api`, live pricing is on — no code change needed.
3. Compare API price vs the embedded card price on those lanes and report the delta so you can confirm the numbers look right before customers see them.
4. Check the serviceability path too, since it quotes through the same helper and must show the same live price as the rate endpoint.
5. If anything still returns `card_fallback`, read the edge function logs to see the exact gateway response and fix accordingly (likely a payload field the rate engine expects, e.g. service/mode naming or declared value).

## Tolerance guardrail

Today the live price is accepted only when it is within tolerance of the embedded card, with a hard cap at 2x the card price; outside that it falls back to the card. Once we see real API numbers across lanes, decide whether to keep that guardrail, widen it, or trust the API outright. Recommendation: keep it for a first week of live data, then loosen.

## Technical notes

- Helper: `supabase/functions/_shared/shree-maruti-rate-api.ts` (Api-Key preferred, Bearer + TenantId fallback).
- Consumers: `shree-maruti-rate`, `shree-maruti-serviceability`.
- Secret in place: `SHREE_MARUTI_INNO_API_KEY`. No new secrets expected unless they move you to Bearer auth.
