# Why the business changes aren't showing (and how to fix it)

## What I verified

The requested changes **are already in the code and already live on the Lovable-published site**. They are **not** on `www.viasetu.com`, because that domain is served by a **separate Vercel deployment**, not by Lovable.

Evidence from the live sites:

| Check | viasetu1.lovable.app (Lovable) | www.viasetu.com (Vercel) |
|---|---|---|
| Server header | Cloudflare / Lovable | `server: Vercel` |
| Dashboard contains "₹15 per box" internal line | No (removed) | Yes (old build) |
| Booking page has "Shipping charges / GST" breakdown | Yes | No (old build) |
| Booking page has rate-first "Get courier rates" step | Yes | Older variant |

So the work is done; `www.viasetu.com` is simply serving an older build from a different pipeline. Publishing from Lovable updates `viasetu1.lovable.app` only — it cannot update a Vercel-hosted domain.

## Decision needed

Pick one:

1. **Point `www.viasetu.com` at Lovable** — connect the custom domain in Project settings > Domains and remove the Vercel deployment for that domain. From then on, every Lovable publish goes live on the real domain. Recommended.
2. **Keep Vercel** — the Vercel project must redeploy from the latest repo commit. Lovable can't trigger that; you (or whoever owns the Vercel project) must redeploy, and this manual step repeats on every change.

## Small cleanup I will make either way

- `src/pages/admin/BusinessManagement.tsx` still shows the internal line "Business pricing: courier rate + ₹15 per box, all inclusive." Even though it is admin-only, the margin figure should not be printed in the UI. Replace it with "All business rates are shown inclusive of GST."

No pricing logic changes: `src/lib/pricing.ts` already computes `round((rate + 15) * 1.18)` with GST added on top, and `business-create-shipment` matches it.

## Technical detail

`vercel.json` in the repo indicates the project was at some point deployed to Vercel; the live headers confirm `www.viasetu.com` is still served from there with build hash `index-BsI6-9Ly.js`, while Lovable serves `index-COisPj74.js`.
