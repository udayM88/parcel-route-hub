# Shree Maruti rate card: fix slabs and zoning

Validation result: the embedded Shree Maruti card in the code does **not** match the attached rate sheet, and the zone logic does not match the zone list you gave. Both the numbers and the zone rules need to be replaced.

## What's wrong today

**1. Slab prices are all different from the sheet.**

Surface, as coded vs. attached sheet:

| Slab | Local (code) | Local (sheet) | Metro (code) | Metro (sheet) | ROI (code) | ROI (sheet) |
|---|---|---|---|---|---|---|
| 0.5 kg | 25 | 29 | 42 | 40 | 48 | 43 |
| 1 kg | 40 | 51 | 65 | 74 | 83 | 83 |
| 2 kg | 60 | 76 | 95 | 117 | 111 | 135 |
| Add 1 kg | 32 | 17 | 52 | 28 | 64 | 31 |

The code also uses slabs the sheet doesn't have (a 0.25 kg slab) and is missing the sheet's 1–1.5, 1.5–2, 2–3, 3–4, 4–5 kg steps. Air is likewise a made-up table instead of the sheet's 0.5 kg / Add 0.5 kg / Upto 2 kg / Add 1 kg structure.

**2. Zoning does not follow your zone list.**
- "WithinZone" is currently computed as *same state*, not same regional zone (North/South/East/West).
- Madhya Pradesh and Chhattisgarh are mapped to a "central" region that doesn't exist in your list (should be West and East).
- Metro currently includes Pune, Thane and Navi Mumbai, which are not in your 7-city metro list.
- Special Zone currently includes J&K, Ladakh and the islands along with the North East; per your list, Surface Special Zone is North East only.

## What I'll change

All in `supabase/functions/_shared/rate-cards.ts` (the shared card used for both consumer and business quoting, and as fallback/verification against the live Innofulfill API).

**Surface table (exact sheet values):**

| Slab | Local | WithinZone | Metro | ROI | Special |
|---|---|---|---|---|---|
| 0.5 kg | 29 | 35 | 40 | 43 | 69 |
| 0.5–1 | 51 | 58 | 74 | 83 | 120 |
| 1–1.5 | 68 | 78 | 99 | 112 | 160 |
| 1.5–2 | 76 | 89 | 117 | 135 | 198 |
| 2–3 | 96 | 118 | 149 | 179 | 253 |
| 3–4 | 118 | 146 | 180 | 220 | 304 |
| 4–5 | 132 | 171 | 206 | 247 | 347 |
| Add 1 kg | 17 | 23 | 28 | 31 | 49 |

**Air table (exact sheet values):** first 0.5 kg 0 / 38 / 58 / 65 / 87; add 0.5 kg 0 / 29 / 49 / 54 / 70; upto 2 kg 0 / 128 / 165 / 186 / 255; add 1 kg 0 / 53 / 59 / 71 / 77. Local Air is 0 in the sheet, so Air is treated as unavailable for Local lanes (quote returns null and that option is dropped, rather than showing ₹0).

Air pricing rule: below 2 kg, price = first 0.5 kg + (extra 0.5 kg steps × add-0.5); at/above 2 kg, price = Upto-2 kg + (extra full kg × add-1). Surface: use the explicit slab up to 5 kg, then 4–5 kg price + (extra full kg × add-1).

**Zone resolution (in priority order):**
1. Special — either end in North East (Assam, Arunachal, Manipur, Meghalaya, Mizoram, Nagaland, Tripura, Sikkim). For **Air only**, Special also covers J&K and Kerala, per the Air sheet's column header.
2. Local — same city (or same pincode).
3. Metro — both ends in Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, Ahmedabad.
4. WithinZone — both ends in the same regional zone (North / South / East / West as you listed).
5. ROI — everything else.

Region map updated to your list: Madhya Pradesh → West, Chhattisgarh → East, Daman & Diu → West, Puducherry → South, J&K → North (Surface).

**Scope note:** this region map is shared with Delhivery, UrbaneBolt, XpressBees and Shadowfax zoning. To avoid silently repricing those partners, I'll keep the existing shared map as-is for them and give Shree Maruti its own zone map matching your list exactly.

## Verification after the change

Re-quote 364003 → 400059 (Gujarat → Maharashtra, both West, non-metro origin) at 0.5/1/2/5 kg on surface and air, confirm the zone comes out as WithinZone and the price matches the sheet, and compare against the live Innofulfill API price to see the new delta.

## Not changed

Weight rounding uses chargeable weight = max(actual, L×W×H/5000). GST and the consumer/business margins stay where they are — this card stays pre-tax.
