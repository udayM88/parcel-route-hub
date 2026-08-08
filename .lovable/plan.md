# Fix and sync viasetu.com/sitemap.xml

## What's wrong today

- `https://viasetu.com/sitemap.xml` currently returns only **6 URLs** with a stale `lastmod` of `2026-05-27` (home, booking, tracking, blog, faq, support).
- The full sitemap logic lives in the Supabase edge function `generate-sitemap`, but it was only reachable through a **Vercel rewrite** in `vercel.json`. The domain now points at Lovable hosting, so that rewrite no longer runs — the live file is an old published artifact.
- There is no `public/sitemap.xml` in the project, so nothing in the build keeps it up to date.
- Result: service pages, city pages, about/contact/how-it-works/careers/courier-partners, legal pages and all CMS blog/page/partner URLs are missing from the sitemap Google reads.

## The fix

Move sitemap generation into the build, so the file Lovable hosting serves is always the complete, current one.

1. Add `scripts/generate-sitemap.ts` that writes `public/sitemap.xml` with base URL `https://www.viasetu.com`:
   - All public static routes read from the app's routing: `/`, `/booking`, `/tracking`, `/blog`, `/faq`, `/support`, `/about`, `/contact`, `/how-it-works`, `/careers`, `/courier-partners`, `/Termsandconditions`, `/Privacypolicy`.
   - Every service page from the `SERVICES` list (`/services/<slug>`, including `/services/parcel-tracking`) and every city page from the `CITIES` list (`/courier-service-in-<slug>`) — generated from the same source arrays the routes use, so new pages are picked up automatically.
   - All published CMS content from `cms_content`: posts at `/blog/<slug>`, pages at `/p/<slug>`, partners at `/courier/<slug>`, using the same `status = 'published'` filter the pages use.
   - Excluded (kept out of the index): `/login`, `/onboarding`, `/history`, `/settings`, `/order/:id`, `/admin/*`, `/ops/*`, `/cms/*`, `/viasetuforbusinesses/*`, and redirect-only paths `/home`, `/terms`, `/privacy`, `/about-us`.
2. `lastmod`: only emitted for CMS entries, from each row's real `updated_at`/`published_at`. Static pages get **no** `lastmod` — the current file stamps every URL with the build date, which is not a real page-change signal and gets discounted by Google.
3. Wire `predev` and `prebuild` scripts in `package.json` so the file regenerates on every preview and every publish. If the CMS fetch fails at build time, keep the static routes and log a warning rather than emitting a broken file.
4. Point `public/robots.txt`'s `Sitemap:` line at `https://www.viasetu.com/sitemap.xml` (already correct) and leave the existing disallows intact.
5. Leave the `generate-sitemap` edge function in place as a fallback, but it stops being the source of truth for the domain.

## Technical notes

- Script runs with `bunx tsx`, imports `SERVICES` from `src/pages/ServicePage.tsx` and `CITIES` from `src/pages/CityPage.tsx`, and queries Supabase with the anon key from the existing client config.
- `vercel.json` rewrites are dead on the Lovable-hosted domain; the `/sitemap.xml` rewrite there will be noted as inactive (no removal needed unless you want the file cleaned up).
- After this ships you'll need to **publish**, then resubmit the sitemap in Google Search Console so it re-crawls the added URLs.

## Note on crawler-visible content

Blog posts served to social/crawler user agents also relied on the Vercel rewrite to `cms-prerender`, which is likewise inactive on the Lovable domain. That's a separate issue from the sitemap; say the word and I'll plan that fix too.
