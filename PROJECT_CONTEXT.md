# ViaSetu Project Context and Handoff

Last updated: 2026-11-28 (Asia/Kolkata)

This file is the persistent project handoff. Read it before making changes and update it after any material feature, database, architecture, deployment, or operational change. Do not store passwords, service-role keys, OAuth tokens, customer PII, or other secrets here.

## Project objective

Build the ViaSetu Merchant Console inside the existing ViaSetu/Lovable application. Merchants should be able to manage shipping operations, use the ViaSetu API from WooCommerce/WordPress or custom React/Next.js sites, maintain a prepaid wallet, and view tenant-scoped operational data.

A future master/admin console will manage merchants, roles, permissions, and operational controls. That master-console expansion is planned but must not be inferred as implemented.

## Repository and production services

- Repository: `https://github.com/udayM88/parcel-route-hub`
- Production branch: `main`
- Merchant-console release commit: `4d62dcf8a805bb1cf799c494d3b43487d2f08407`
- Supabase project ref: `tksfdvnogzsweteetjjw`
- Lovable-hosted app: `https://viasetu1.lovable.app`
- Primary site: `https://www.viasetu.com`
- Merchant login: `https://www.viasetu.com/viasetuforbusinesses/`
- Admin login: `https://www.viasetu.com/admin/login`
- Merchant management: `https://www.viasetu.com/admin/businesses`

The local working branch used during the merchant-console implementation was `feature/merchant-console-integration`. Its verified commit was pushed to GitHub `main`. Re-fetch `origin/main` before starting new work because Lovable and other developers also commit to the same branch.

## Non-negotiable safety rules

- The current Lovable application, existing merchants, existing orders, and existing data must remain intact.
- Prefer additive migrations. Do not delete, rename, truncate, or repurpose existing tables/columns/functions without an explicit reviewed migration and rollback plan.
- Never force-push `main`. Fetch first, preserve Lovable commits, resolve conflicts carefully, and rerun verification.
- Never expose the Supabase service-role key in frontend code. The publishable/anon key may be used only with correct RLS.
- Every live merchant query must be tenant-scoped through the authenticated user/business account and protected by RLS or a scoped server function.
- API keys must remain hashed, business-scoped, permission-scoped, revocable, rate-limited, and optionally expiring.
- Wallet debits/credits must remain server-calculated, row-locked, idempotent, and auditable.
- Demo/sample flows must not write to production data.
- Do not publish, deploy, or mutate production merely because a prototype changed. Verify scope and obtain explicit authorization for production-impacting work.
- Keep `_prototypes/` as reference material unless explicitly asked to publish it. It was intentionally excluded from the merchant-console production commit.

## What was implemented

The merchant portal remains under `/viasetuforbusinesses` and now uses a dedicated professional console shell with Public Sans, ViaSetu styling, responsive navigation, darker visible sidebar states, borders, transitions, and five theme choices.

Implemented routes and areas include:

- Dashboard with tenant-scoped shipment metrics, recent orders, onboarding state, and wallet summary.
- Orders table with search, filters, status display, and CSV export.
- Existing detailed shipment workflow retained on the dashboard: order/box details, tracking refresh, label generation/download, invoice download, and cancellation.
- Create Order using the existing courier/serviceability and `business-create-shipment` flow.
- Wallet balance, transaction history, Razorpay top-up creation, and top-up verification through the existing `business-wallet` function.
- Developer/API key management through the existing `business-api-keys` function.
- Integration catalogue for API, WooCommerce, WordPress, and custom application workflows.
- Rate calculator using the existing courier functions.
- Tracking lookup scoped to the current business.
- Profile using the authenticated `business_accounts` record.
- Support tickets and replies using existing support tables and policies.
- Finance/transaction and analytics views based on existing tenant data.
- Address Management using `saved_addresses` with authenticated owner-only policies.
- Local-only sample account and sample datasets for safe UI/E2E verification.

## Merchant quote pricing and comparison UI (2026-11-10)

- Historical rule, superseded for new B2B quotes by the tiered-pricing release below: merchant GST-exclusive quotes previously used the displayed consumer quote plus ₹15 per box.
- Merchant quote cards display the partner logo, partner/service name, star rating, delivery ETA, applicable service capabilities, and the merchant amount labelled `(GST excluded)`. Review-count totals are intentionally hidden to keep the comparison concise.
- GST remains 18% and is shown separately in the review/payment breakdown. The final payable amount still includes GST.
- Old business helpers remain only in non-writing demo data; live quotes use the server B2B engine. Consumer formulas and historical records remain unchanged.
- This historical section does not establish current deployment status; verify the current release before reporting it live.

## B2B progressive tiered pricing (2026-11-15)

- Replaces live business pricing with courier freight plus a database-driven booking fee charged once per order and progressive 500g service fees. Growth uses the confirmed listed slabs, yielding platform charges of ₹115 at 5kg, ₹165 at 10kg and ₹255 at 25kg; consumer pricing remains unchanged.
- Added version, tier, slab, customer-card, override, monthly-assessment, courier-rule, private quote, immutable snapshot and audit tables. All public tables have explicit grants and scoped RLS. Existing orders/invoices are not rewritten. `bookings.b2b_quote_id` atomically binds and consumes an accepted quote.
- `_shared/b2b-pricing.ts` performs integer-paise arithmetic, courier-specific billed weight, allocation and GST treatment. `_shared/b2b-quotes.ts` retains courier response metadata privately and issues safe business totals; no procurement/profit values are returned in public quotes.
- Business portal and merchant API rate requests use `business-pricing`/the shared quote service. Booking preparation requires a scoped, unexpired quote matching actual parcels and pins; retries retain the accepted snapshot. Parcel actual weights remain separate from courier billed weights. Razorpay prepared-order ownership and paise equality are checked server-side.
- Monthly tiers freeze previous calendar month's evidenced completed orders in Asia/Kolkata, counting an order once rather than AWBs. A daily pg_cron catch-up runs at 00:05 IST, including the first day; on-demand resolution covers newly approved businesses. Missing delivery evidence is recorded, not invented.
- Merchant Pricing & Tiers lives at `/viasetuforbusinesses/pricing`; dashboard includes current tier, completed volume, booking fee and next-tier progress. Invoices use saved GST and exact totals.
- Super-admin configuration lives at `/admin/b2b-pricing` via server-validated `admin-b2b-pricing`: draft/publish versions, threshold/slab edits, previews, effective dates, enabled rules, Enterprise/heavy/customer cards, tier overrides, platform revenue and audit history.
- Enterprise and shipments over 25kg require approved custom cards; there is no silent standard-tier fallback. Courier contract/tax settings are seeded from existing integration evidence and can be revised prospectively by super admins.
- Wallet shipment creation remains paused; no wallet charge/refund behavior was enabled. Courier integration responses, tracking, cancellation rules and manual-refund policy are unchanged.
- Verification: tier/weight/tax/consumer/accounting regression tests and private quote-expiry/public-output tests pass. Signed-in quote-to-payment and admin-publication checks are unavailable on external unmanaged Supabase; do not represent sample-account or unit tests as live authenticated verification. Existing 22 security-advisor findings remain outside this release.

## Static SEO coverage for non-JavaScript crawlers (2026-11-12)

- SEO audit exports reported 39 missing meta-description rows (33 unique normalized URLs) and 38 missing-H1 rows (32 unique normalized blog URLs); six rows in each report were trailing-slash duplicates.
- The affected responses were the shared SPA shell with JavaScript rendering disabled, so crawlers saw the default title and no route-level description or H1 even though the rendered React pages contained them.
- The Vite production build now writes route-specific static HTML entry files for `/tracking`, `/blog`, and every published CMS post/page/partner. These files contain the stored CMS title, meta description/excerpt, canonical, robots, social metadata, and a crawlable H1; React replaces the lightweight fallback content when JavaScript loads.
- `vercel.json` sends those extensionless routes to the generated entry files before the SPA catch-all. The existing crawler-specific CMS prerender route remains first for its supported bots.
- Ahrefs Site Audit reported 26 blog routes as one generic SPA document after crawling without JavaScript. A live recheck on 2026-11-13 found all 26 returning HTTP 200 with route-specific title, description, canonical and H1, but the crawler prerender allowlist did not explicitly include Ahrefs. `AhrefsBot` and `AhrefsSiteAudit` are now routed to the dynamic CMS prerender fallback so newly published posts remain crawlable before the next static deployment.
- CMS metadata is fetched read-only with the existing publishable/anon key during the build. Incomplete CMS records are skipped explicitly rather than receiving invented metadata.
- The initial `/tracking` search state now renders `PageSeo` client-side as well as after tracking data is found.
- This is a build/output change only: no database migration, CMS-row rewrite, production data mutation, or Edge Function deployment is required.

## Existing data remains authoritative

The redesign did not replace merchant data. Real accounts continue to use the same Supabase sources:

- Authentication: Supabase Auth
- Merchant identity/profile: `business_accounts`, linked by `user_id`
- Shipments and orders: `bookings` (and existing booking-detail/box relations)
- Wallet balance: `business_wallets`
- Wallet ledger: existing wallet transaction tables/functions
- API keys: existing business API-key tables and `business-api-keys` edge function
- Support: `support_tickets` and `support_ticket_replies`
- Saved addresses: `saved_addresses`

If an existing merchant logs in but sees no data, first perform a read-only check that the Supabase Auth UID matches `business_accounts.user_id`, the business account is active/approved, and relevant rows use the correct `business_account_id`. Do not recreate or overwrite the merchant until that mapping is understood.

## Production database change made for this release

One additive migration was applied:

- Local/remote migration version: `20261020172615_merchant_saved_addresses_rls`
- File: `supabase/migrations/20261020172615_merchant_saved_addresses_rls.sql`
- Effect: adds authenticated owner-only SELECT, INSERT, UPDATE, and DELETE policies to `public.saved_addresses` using `user_id = auth.uid()::text`.
- The existing service-role policy was preserved.
- No table, column, function, or existing row was deleted or rewritten.

Supabase security advisors still reported pre-existing warnings around several `SECURITY DEFINER` functions, OTP expiry, leaked-password protection, and the Postgres patch level. They were not changed in this merchant-console release because blind permission changes could break existing flows. Audit them as a separate security task.

## Merchant API-key hardening release

The additive merchant API-key hardening release was applied to production Supabase on 2026-10-22 and coordinated with the frontend/schema changes in this repository:

- Remote/local migration version: `20261021192356_merchant_api_key_controls`
- Adds backward-compatible key scopes, optional expiry, and a per-key requests-per-minute limit. Existing keys retain all current scopes, never expire, and use a 120 requests/minute limit.
- Adds the private `merchant_api_rate_limits` table and service-role-only `merchant_api_consume_rate_limit` atomic RPC. `anon` and `authenticated` cannot execute it.
- Production Edge Functions after deployment: `business-api-keys` v5 and `merchant-api` v6, both ACTIVE.
- The merchant developer UI supports full or read-only keys and 30-day, 90-day, one-year, or non-expiring credentials.
- The existing `create_shipment` safety pause remains in place. Do not remove it until refund-safety verification is complete.
- A non-destructive production smoke request returned the expected HTTP 401 for a missing/malformed API key; no shipment, wallet, or merchant data was created.

## Merchant console module activation release

An additive merchant-console activation release was prepared and applied on 2026-10-22:

- Remote/local migration version: `20261022141000_activate_merchant_console_modules`.
- Adds tenant-scoped settings, bulk-import audit records, webhook subscriptions, and merchant activity logs through `merchant_console_settings`, `merchant_bulk_imports`, `merchant_webhook_subscriptions`, and `merchant_console_activity_logs`.
- Adds owner-scoped RLS policies and activity triggers without deleting or rewriting existing merchant, booking, wallet, or authentication data.
- Replaces the generic backend-gated placeholder screen with live-backed merchant views for bulk booking staging, COD summaries, weight reconciliation, rate cards, invoices/statements, webhook subscriptions, pincode serviceability, activity/session visibility, carrier preferences/rules, notifications, and document settings.
- Carrier selection and merchant carrier rules are applied by both the merchant UI booking/rate flows and the `merchant-api` server flow.
- Production Edge Functions deployed for this release are `business-webhook-test` v1, `merchant-api` v8, `send-notification-email` v66, and `admin-update-booking-status` v6.
- Public courier webhook receivers (`urbanebolt-webhook` and `xpressbees-webhook`) and `admin-refresh-order-statuses` were deliberately left at their prior versions. Do not redeploy those public receivers until their inbound authentication and replay protections have a separate security review.
- Bulk booking currently validates and stages merchant files with an auditable import record; it does not silently create live shipments from spreadsheet rows.

## Public developer and WooCommerce beta

The first additive developer-distribution beta was implemented on 2026-10-22 without a new database migration or production Edge Function change:

- Public documentation route: `/developers/merchant-api`.
- Raw quickstart and OpenAPI 3.1 specification: `/docs/merchant-api/quickstart.md` and `/docs/merchant-api/openapi.yaml`.
- Dependency-free server-side JavaScript/TypeScript SDK source: `integrations/viasetu-js-sdk`.
- Installable WooCommerce plugin source: `integrations/woocommerce/viasetu-woocommerce`.
- Public download artifacts: `/downloads/viasetu-js-sdk.zip` and `/downloads/viasetu-woocommerce.zip`.
- The WooCommerce beta supports live checkout rates, encrypted server-side merchant credentials, idempotent order shipment requests, tracking refresh, hourly open-shipment sync, label retrieval, cancellation, signed webhook verification, delivery deduplication, and HPOS declaration.
- The plugin uses only the public merchant API. It never embeds the Supabase anon or service-role key.
- Shipment creation still respects the server-side `create_shipment` safety gate. The former undocumented bypass action was removed in the prepared 1.2.1 release. Enable the public server action only after the existing refund-safety review is complete.
- The SDK is a downloadable beta package and is not yet published to the npm registry. The WooCommerce plugin is a downloadable beta and is not yet submitted to WordPress.org or connected to an automatic update channel.
- WooCommerce beta `0.2.0` adds a dedicated WordPress admin dashboard, guided connection setup, connection testing, multiple checkout quotes, carrier-priority rules, product-level shipping controls, configurable automation, manual tracking sync, webhook diagnostics, and redacted local logs.
- The WordPress distribution is built as a portable archive with forward-slash entry paths. Prefer the versioned `/downloads/viasetu-woocommerce-0.2.0.zip` URL to avoid stale copies of the earlier Windows-generated beta archive; `/downloads/viasetu-woocommerce.zip` remains the latest alias.
- The plugin does not collect a merchant password. Its assisted connection opens the official merchant console so the merchant can create a dedicated store-scoped key; a seamless one-click OAuth handshake remains a future backend-authentication phase.

### WooCommerce distribution sync verification

- The SDK/plugin commits were rebased without file conflicts onto Lovable/GitHub `main` at `0a27daf` on 2026-10-22.
- This distribution update contains no Supabase migration or Edge Function change; production database data and functions were intentionally left untouched.
- Post-rebase verification passed: TypeScript, targeted ESLint, Vite production build, JavaScript SDK tests (3/3), PHP syntax checks (9 files), and merchant/docs Playwright tests (2/2).
- The install archive was verified to contain `viasetu-woocommerce/viasetu-woocommerce.php` using portable forward-slash paths, fixing the earlier WordPress “Plugin file does not exist” activation failure.

## Admin order-monitoring Excel export

An additive admin reporting update was implemented on 2026-10-23 without a database migration or Edge Function change:

- `/admin/orders` now includes a dedicated **Download order report** section.
- The Excel export applies the current All/Active/Completed tab, search term, status filter, and inclusive From/To date range.
- The interactive table remains capped at the latest 1,000 orders for responsiveness, while export fetches all matching booked orders from Supabase in stable 1,000-row batches. A visible 100,000-row safety limit fails explicitly instead of producing a partial report.
- The workbook contains typed dates, numeric weights and amounts, text-safe IDs/pincodes, operational shipment fields, and the shared saved-order financial breakdown. It excludes raw partner error payloads, private label URLs, payment-link URLs, and other internal diagnostics.
- The 2026-10-27 workbook refinement places the five primary fulfilment fields first: AWB number, order date/time, pickup date/time, the exact estimated-delivery text saved when the booking was made, and parcel amount. `courier_price` remains the authoritative parcel amount charged; `shipment_value` is retained separately as declared parcel value.
- Pickup date/time is resolved read-only from the earliest recorded pickup scan in `shipment_status_events` (pickup wording or `PU` code). It is never guessed from the order date. Historical rows without a pickup scan remain blank and the workbook explains that source explicitly.
- The download now includes a compact Summary sheet (order/AWB/pickup counts, total parcel amount, and status breakdown), freezes the identifying columns/header, uses typed date/money/measurement cells, and keeps the detailed Orders sheet filterable with practical column widths.
- The 2026-10-27 styling pass uses `xlsx-js-style` so ViaSetu navy/teal header fills, highlighted core columns, green amount cells, alternating row fills, visible grid borders, wrapped long text, and styled metadata/summary blocks are written into the actual downloaded workbook rather than existing only as in-memory style hints.
- Reversed date ranges are shown as invalid and cannot be exported.
- Verification passed after the 2026-10-27 refinement: TypeScript, focused export tests (6/6), targeted lint for the export module/tests, `git diff --check`, and the Vite production build. The existing Order Monitoring file retains its prior 12 `no-explicit-any` errors and one hook-dependency warning; this update did not add a new page-level lint finding.

## Functional versus planned modules

Functional/live-backed:

- Existing merchant authentication and account lookup
- Dashboard/order data and live booking updates
- Detailed order actions retained on the dashboard
- Create shipment flow
- Tracking and labels through existing partner functions
- Wallet read/top-up/verification
- API-key create/revoke
- Address CRUD with owner-only RLS
- Support tickets/replies
- Read-only finance and analytics views
- Merchant carrier selection and routing preferences
- Merchant notification preferences
- Webhook subscription CRUD and authenticated test delivery
- Pincode serviceability lookup
- Merchant activity-log and current-session views
- Merchant label/invoice settings
- COD, rate-card, invoice, and weight-reconciliation operational summaries derived from authoritative tenant data
- Bulk-booking file validation and staging audit
- Tenant-scoped merchant team users, invitations, roles, permissions, suspension, and activity controls

UI/planned or schema-gated (do not claim fully functional yet):

- Final COD remittance/settlement operations with courier reconciliation
- Carrier-audited weight dispute/settlement workflow
- Automatic row-by-row shipment creation from uploaded bulk-booking files
- Tax invoice generation/payment collection beyond the current ledger-derived statement/export views
- Durable webhook attempt history, retry queue, and production delivery monitoring
- Master login and role-persona management
- WooCommerce production release signing, automatic update channel, marketplace submission, and compatibility matrix
- npm publication/versioning automation for the JavaScript SDK and hosted interactive API reference

## Merchant creation and login

### Merchant login visual refresh (released)

- On 2026-10-28, `/viasetuforbusinesses` received a responsive ViaSetu merchant-login redesign using the existing exact ViaSetu wordmark, Public Sans Variable, and the project-owned background asset at `src/assets/merchant-console/merchant-login-background-v2.png`.
- The visual refresh preserves Supabase authentication, account approval checks, password-reset redirect, and post-login routing. The shared sample session was subsequently production-enabled as described below.
- The desktop layout is constrained to one viewport frame with no nested card scrollbar or horizontal overflow. Mobile uses the natural document scroll and has no horizontal/side scrolling.
- The final visual pass keeps the generated warehouse scene continuous across the entire desktop instead of introducing a separate pale-blue or dark right panel. The image is softly enlarged, and its readability overlay fades out before the login card so the warehouse remains visible behind it. Mobile extends the hero image farther behind the overlapping form for a natural transition. The compact glass-white form uses cool-grey inputs, a stronger sample-access callout, and a navy-to-teal primary action. Decorative circles and nonessential SVG icons were removed; only the functional password visibility icon remains. No unsupported social-login controls were added.
- The ViaSetu wordmark is placed inside the login card directly above the “Welcome back” heading on both desktop and mobile; the earlier duplicate logo floating over the hero was removed.
- The UI adds password visibility and optional remembered-email convenience; only the email address is stored in local storage and the password is never persisted.
- On 2026-11-12, the same accessible eye/eye-off visibility control was standardized across Admin, CMS, Operations and merchant sign-in, admin/business password reset, and the authenticated change-password dialog. Each multi-password form has an independent toggle, changing visibility never clears the value, and password persistence/authentication behavior is unchanged. The consumer `/login` flow is OTP-only and therefore has no password field. Focused Chromium coverage passes for all four password login routes plus independent reset-field toggles.
- Validation passed locally: TypeScript, targeted ESLint, Vite production build, and the full merchant Playwright journey. The Playwright login step also asserts that the desktop login route has neither horizontal nor vertical document overflow at 1440x900.
- The login-page refresh was committed and pushed to GitHub `main` in `2597628` on 2026-10-28.

Production merchants should be created from the official admin flow:

1. Sign in at `/admin/login` with a `super_admin` or `operations` account.
2. Open `/admin/businesses`.
3. Use **Create Business User** and its password-setup workflow.

Do not manually insert production Auth/business records unless the official flow is broken and a reviewed recovery procedure is being followed.

The public sample credentials are:

- Email: `demo@viasetu.local`
- Password: `Demo@1234`

They open a browser-tab-only sample session and never authenticate as a Supabase user. Production demo access is enabled by default and can be disabled immediately by setting `VITE_ENABLE_BUSINESS_DEMO=false` before the production build.

The public login keeps the sample credentials operational without advertising a separate sample-access card or autofill button. Visitors see the same clean merchant login form and can enter either approved merchant credentials or the documented sample credentials manually.

### Production demo-session safety

- The public sample credential path is a client-side preview only; it does not create an Auth user, business account, payment, shipment, API key, support record, address, webhook, or other database row.
- Entering the sample workspace first clears any existing Supabase session from the current browser with local sign-out scope. Real merchant login clears the sample marker before Supabase password authentication.
- The sample marker is stored in `sessionStorage`, so it ends when the browser tab is closed. Sample settings/actions stay in React or browser session state.
- Booking pincode lookup, rate quotes, pincode serviceability, tracking, labels, wallet funding, cancellation, webhook tests, and API-key actions use local fixtures or explicit no-op guards in sample mode. No courier or payment request is sent.
- Password reset is blocked for the shared sample email. Production merchant password reset remains unchanged.
- No Supabase migration, RLS policy, Edge Function, or production table/data change was required for this feature.
- Verification passed against a Vite production build served by `vite preview`: TypeScript, targeted ESLint for the changed non-legacy files, production build, `git diff --check`, and the full merchant Playwright journey. `BusinessBooking.tsx` retains its 12 pre-existing `no-explicit-any` lint findings; this change added none. The journey also asserted that no non-read Supabase request was emitted during the sample session.

### CMS writing workspace motion policy

- All decorative, looping, hover-scale, floating, pulsing, and entrance motion is disabled while the user is on `/admin/cms` or a nested CMS route.
- Functional loading and save indicators keep their spinner animation so asynchronous state remains understandable.
- The reduced-motion class is applied and cleaned up by `AdminLayout`; public pages and non-CMS Admin/Ops routes are not changed.
- The rich-text toolbar stays inside the editor instead of sticking beneath the global Admin header. Blog content scrolls in a dedicated, height-bounded writing area, preventing text from sliding underneath the toolbar or appearing to disappear during page scroll.
- The text-colour control preserves the editor selection while its palette is open. It applies colour to an explicit selection or, when only the caret is present, to the current text block; the toolbar shows this as an `A` with a live colour underline rather than an ambiguous black dot.
- On 2026-11-05, the shared toolbar selection handling was hardened across pointer, touch, palette, and dialog focus changes. Text colour, highlight, link creation, existing-link editing, headings, and image insertion now restore the bookmarked editor range before acting. The fragile portal-based colour popover was replaced with an editor-contained swatch row so all colour choices remain visible and clickable in the CMS workspace. A mocked Playwright regression covers the visible palette, colour/highlight on linked text, and link URL editing without writing CMS data.
- The blog editor category and author fields use accessible native selects rather than animation/portal-dependent popups. They expose loading and read failures, provide an inline retry action, preserve an unavailable existing relation, immediately select newly created relations, and continue saving `category_id`/`author_id` through the existing content payload. A public-client read check on 2026-11-03 returned 14 categories and 3 authors, so this repair requires no database migration or production-row change.
- On 2026-11-12, all remaining CMS selection boxes (rich-text heading, schema type, and robots) were moved to accessible native selects so they do not depend on animated portal positioning inside the motion-reduced CMS workspace. Category/author selects stay interactive while their options load, and relation creation always releases its busy state after network errors. The hyperlink, new-category, and new-author forms now render inline in their owning editor/card instead of in portal dialogs, so the controls remain visible and clickable in the static CMS layout. Hyperlinks normalize plain hostnames to HTTPS, accept safe relative/anchor/email/phone targets, reject unsafe protocols, and insert links without interpolating raw HTML. Focused Chromium coverage verifies the main inputs, actual category/author creation and selection, heading/SEO selects, and mouse-driven hyperlink flow without writing production CMS data.

## Merchant console functional audit (2026-10-29)

- Audited all 31 authenticated `/viasetuforbusinesses` console routes at 1440x900 and representative dashboard, order, booking, wallet, developer, integration, bulk-booking, webhook, address, and support routes at 390x844.
- Every audited route rendered its intended page, retained a main heading, avoided document-level horizontal overflow, and avoided the generic `Module connected` fallback.
- The shared sample session emitted no non-read Supabase request during the crawl or the full merchant Playwright journey. No database migration, RLS policy, Edge Function, production row, or courier/payment request was changed by this audit.
- Fixed the global header order search so its `?search=` value now initializes the Orders screen filter instead of being discarded after navigation.
- Connected the previously inert notification-bell control to the existing merchant Notification Settings route.
- Repaired invalid HTML nesting in the API-key list (`Badge` elements inside a paragraph), removing the React `validateDOMNesting` console warning.
- Added regression coverage for header search propagation, notification navigation, console/page errors, and the existing demo-write isolation guard.
- Verification passed: TypeScript, targeted ESLint for all files changed by this audit, Vite production build, the full merchant Playwright journey, and `git diff --check`.
- Existing planned/gated features remain intentionally unchanged: hyperlocal orders, team invitation/RBAC, final COD remittance, automatic bulk-file shipment creation, durable webhook retries/history, and the public `create_shipment` safety gate.
- `BusinessBooking.tsx` still has 12 pre-existing `no-explicit-any` lint findings, and `BusinessAuthContext.tsx` retains one Fast Refresh warning. These are static-analysis debt rather than failures introduced by this audit; do not describe the entire merchant directory as lint-clean.

## Verification performed for release `4d62dcf`

- `npx tsc --noEmit` passed.
- Vite production build passed.
- Merchant Playwright journey passed, covering local login, dashboard, orders, wallet write isolation, sample API-key flow, rate calculator, tracking, profile, support, transactions, analytics, and addresses.
- `git diff --check` passed.
- New/merchant-scoped files passed targeted ESLint with no errors (one existing Fast Refresh warning remained in the auth context).
- The repository-wide lint command still has hundreds of pre-existing errors, mainly `no-explicit-any`, across unrelated legacy frontend and edge-function files. Do not present full-project lint as clean until those are separately addressed.
- GitHub `main` was verified at `4d62dcf8a805bb1cf799c494d3b43487d2f08407` after push.
- The primary ViaSetu site was verified to serve a bundle containing the new `BusinessConsoleLayout` and `BusinessOrders` routes.

## Merchant team access and RBAC implementation (2026-11-03)

- Added a tenant-scoped merchant team model with owner, admin, operations, finance, developer, and viewer access. The database migration is additive and does not rewrite existing merchant, Auth, booking, wallet, or API-key rows.
- Added the `merchant-team` Edge Function for listing members, invitations, role changes, suspension/reactivation, invitation resend, removal, and member activity. A shared merchant-access helper now centralizes account resolution and permission checks.
- Applied server-side role checks to merchant API-key, wallet, webhook-test, and shipment-creation functions; UI hiding is not treated as authorization.
- Added a production-grade Users workspace to the merchant console, permission-filtered navigation and shortcuts, protected routes, and permission-aware controls across orders, wallet, developers, addresses, support, and activated modules.
- Kept sample access session-only and local: demo team actions do not create Auth users or write production data.
- Added Playwright coverage for the complete merchant journey and a 31-route console audit. The team-action toast placement was adjusted so it cannot block table actions.
- The migration and Edge Function source are committed for deployment, but pushing GitHub code alone does not apply the Supabase migration or deploy functions. Deploy those through the reviewed Supabase/Lovable release workflow after the code revision is approved.
- Local verification for this release includes TypeScript, targeted ESLint, Vite production build, merchant Playwright journey, 31-route audit, and `git diff --check`. Deno is not installed locally, so Supabase Edge Function type-checking must also run in the deployment pipeline.

## WooCommerce Merchant 1.0 implementation (prepared 2026-11-13; not deployed)

- Rebuilt the WordPress package as **ViaSetu Merchant for WooCommerce 1.0.0** with a dedicated ViaSetu Merchant menu and branded responsive workspaces for overview, merchant orders, WooCommerce shipments, wallet/billing, courier-authoritative labels, shipping rules, automation, products, connection health, and diagnostics.
- Added a one-click store authorization flow. WordPress generates a PKCE verifier and state, the approved merchant reviews the exact HTTPS store in `/viasetuforbusinesses/connect/woocommerce`, and the plugin exchanges a five-minute one-time code server-to-server. Merchant passwords are never returned to or stored by WordPress.
- The dedicated integration key and webhook secret are encrypted in WordPress with Sodium or AES-256-GCM, scoped to one merchant, rate-limited, revocable, and never written to logs. Connection endpoints require public HTTPS, block redirects and unsafe/private targets, and cap response sizes. WordPress admin actions use capabilities and nonces; tracking callbacks require a timestamped HMAC signature and delivery deduplication.
- Added the additive `20261113090000_woocommerce_secure_connect.sql` migration, `woocommerce-connect` Edge Function, and merchant API account/dashboard/orders/billing/disconnect actions. All reads derive the business account from the key; callers cannot submit another tenant ID. Reconnecting the same store revokes its previous key and webhook, while disconnect revokes the current store key.
- The official new-merchant boundary remains intact: a new business uses `/for-business` to request access and must be approved through the existing Admin business-user flow. The plugin does not create an unapproved live merchant or bypass account review. Existing approved merchants can authorize the store directly.
- Generated two installable packages from the same reviewed source: `public/downloads/viasetu-woocommerce-1.0.0.zip` for production and `public/downloads/viasetu-woocommerce-demo-1.0.0.zip` for an isolated local-fixture demo. Demo mode sends no courier, wallet, payment, ViaSetu API, or production-data request.
- Live `create_shipment` remains behind the existing refund-safety gate and still returns `wallet_setup_pending`. Do not claim automatic production booking until that separate safety verification is approved; rates, account/order/billing reads, labels, tracking, cancellation, and signed webhook code paths remain implemented.
- Source verification completed locally: TypeScript, focused frontend/connection lint, PHP syntax for every plugin PHP file, JavaScript SDK tests, deterministic package structure/isolation tests, frontend production build, focused Playwright documentation and WooCommerce authorization tests, and `git diff --check`. PHP CLI reports an unrelated local `pdo_firebird` startup warning; plugin syntax itself passes.
- Disposable Docker runtime verification passed for both production and demo packages on the declared minimum stack (WordPress 6.3.2, WooCommerce 8.0.0, PHP 7.4.33), an intermediate stack (WordPress 6.8.3, WooCommerce 8.0.0, PHP 8.1.34), and the current tested stack (WordPress 7.1.4, WooCommerce 11.3.0, PHP 8.1.34). Checks cover plugin boot, branded admin rendering, shipping-method registration, REST webhook registration, encryption, cron scheduling, credential roundtrip, signed webhook handling and delivery deduplication. Demo checks additionally cover local dashboard/billing/shipment fixtures and zero outbound HTTP requests.
- Browser smoke tests on WordPress 7.1.4 / WooCommerce 11.3.0 passed for production and demo at desktop and mobile sizes with no plugin-level horizontal overflow or relevant page/console errors. Testing accidental simultaneous activation exposed a duplicate global-function fatal; the bootstrap now guards those declarations, and both activation orders boot safely with a warning to keep only one package active.
- GitHub push alone will not apply the migration or deploy the Edge Functions. Production rollout requires a reviewed Supabase migration/function deployment before publishing the production ZIP or enabling the connection link. The source and packages in this workspace are preparation artifacts until that rollout is completed and smoke-tested.

## WooCommerce Merchant 1.1 hardening (prepared 2026-11-16; not deployed)

- Audited reported WooCommerce orders that failed to reach the sandbox: one never triggered and one was rejected with HTTP 401. The plugin now validates the exact `vs_live_` / `vs_test_` 48-hex key format and environment before requests, persists a key fingerprint plus last verification result, verifies one-click credentials immediately, and exposes failed verification without treating key presence as API health.
- Automatic booking now requires the order's actual shipping method ID to be `viasetu_shipping`. Free Shipping and every other WooCommerce method are skipped before preflight or network activity. Manual order actions are likewise shown only for ViaSetu Shipping orders.
- Pickup name, 10-digit phone, address, city, state and 6-digit pincode are mandatory. Delivery fields are validated before transmission. Shipping settings include an explicit nonce/capability-protected action to add ViaSetu Shipping to an existing India zone or create a dedicated India zone when none exists.
- Removed fake 0.1 kg and 20 x 15 x 10 cm parcel fallbacks. Every physical product must have real WooCommerce weight, length, width and height; missing data blocks rates and booking with an actionable order error. Empty measurements are normalized before WooCommerce conversion to remain safe on PHP 8.3 / WooCommerce 11.3.
- Booking success now requires an explicit `success: true` response and a non-empty `booking_id`. API 401/403 and validation failures are not retried. Network, 408/409/425/429 and 5xx failures use stable idempotency keys with bounded 15-minute / 1-hour / 6-hour retries. The long-lived `wallet_setup_pending` production safety gate is not retried or bypassed.
- Added failed/blocked booking metadata, visibility in the Shipments workspace, a manual missed-order recovery scan, scheduled due-retry processing alongside tracking sync, and cleanup of retry/label cron hooks on deactivation.
- Generated final single-folder packages `public/downloads/viasetu-woocommerce-1.1.0.zip`, `public/downloads/viasetu-woocommerce-demo-1.1.0.zip`, and the stable production alias `public/downloads/viasetu-woocommerce.zip`. Package tests require the bootstrap at exactly one folder below the ZIP root and reject double nesting, Windows separators and path traversal.
- Verification passed for all plugin PHP syntax, deterministic ZIP tests, the frontend production build, and desktop/mobile admin UI with no relevant page/console errors or plugin-level horizontal overflow. The exact production ZIP installed and passed full runtime assertions on WordPress 6.3.2 / WooCommerce 8.0.2 / PHP 7.4.33 and WordPress 7.1.4 / WooCommerce 11.3.0 / PHP 8.3.36. Assertions cover strict shipping-method filtering, credential/pickup checks, missing product data, missing booking ID, non-retryable 401, scheduled transient retry, successful booking metadata, signed webhooks and deduplication. The exact demo ZIP also installed and passed with zero outbound HTTP requests.
- The public backend `create_shipment` action remains intentionally paused behind refund-safety verification and returns `wallet_setup_pending`; no server gate, migration or Edge Function was changed or deployed in this hardening. Do not claim live production booking until that independent gate is reviewed and enabled.

## WooCommerce Merchant 1.2 release readiness (prepared 2026-11-19; Lovable publish pending)

- Production and sandbox packages use the real merchant API. The sandbox package requires a dedicated `vs_test_...` key and no longer supplies hard-coded orders, wallet entries, AWBs, ratings or booking responses.
- A live read-only probe found `woocommerce-connect` returning HTTP 404 for both POST and CORS preflight, proving that the Edge Function is not deployed. This probe does not establish the remote migration state; Lovable must inspect migration history before applying or skipping the additive migration.
- The connection review now keeps backend failures visible in the page and replaces the raw Supabase fetch error with a support-safe explanation. Permission copy explicitly states that booking activation is required while the existing shipment safety gate remains active.
- The manual Lovable handoff is documented in `docs/woocommerce-lovable-release.md`. The project owner performs Lovable publish/deployment; contributors must not open Lovable, publish the frontend, apply the migration or deploy Edge Functions implicitly.
- Required backend scope is limited to additive migration `20261113090000_woocommerce_secure_connect.sql`, new `woocommerce-connect`, and the matching reviewed `merchant-api`. Do not deploy unrelated courier webhook functions and do not bypass `wallet_setup_pending`.

## WooCommerce Merchant 1.2 real sandbox separation (prepared 2026-11-19)

- Removed the demo package's hard-coded orders, wallet balance, customer names, AWBs, courier quote and random shipment responses. The demo distribution is now a real Merchant API client and stays unconnected until it receives a valid sandbox credential.
- Enforced package isolation at credential storage and request time: the production ZIP accepts only non-placeholder `vs_live_` keys and the demo ZIP accepts only non-placeholder `vs_test_` keys. Neither archive embeds a key, password or Supabase service-role credential.
- The public browser-only merchant sample remains enabled by default and can be disabled with `VITE_ENABLE_BUSINESS_DEMO=false`. It is not a Supabase Auth user and cannot authorize a live store. The explicit controlled-sandbox connection added in 1.2.1 may create only sandbox integration/key rows for a server-configured dedicated demo tenant and an exact allowlisted HTTPS store; all other sample actions remain local/no-op. A read-only check on 2026-11-19 confirmed that `demo@viasetu.local` is not a real Supabase account.
- Local HTTP WordPress can use encrypted manual sandbox credentials plus scheduled polling. One-click PKCE authorization and signed inbound webhooks require a public HTTPS WordPress origin. A live endpoint probe on 2026-11-19 returned the expected 401 from `merchant-api`, while `woocommerce-connect` returned 404, confirming the one-click Edge Function is not deployed at the production project. Do not claim one-click live connection until its additive migration and function are reviewed, deployed and smoke-tested.
- Clarified the current functional boundary: WooCommerce remains the product catalogue source; parcel dimensions and product handling metadata feed quote/booking payloads, but there is no standalone catalogue mirror. Billing is the authoritative wallet ledger; the current Merchant API does not expose a standalone GST/tax-invoice file, so the plugin does not fabricate one.
- Fixed the reported WordPress admin clipping by switching the sidebar to a scrollable top navigation at medium widths, constraining workspace/table overflow, making empty tables fit their container, improving typography and stacking manual-connection fields on mobile.
- Generated single-folder v1.2 packages and verified their contents reject embedded credentials and fixture code. Exact ZIP runtime assertions passed on WordPress 7.1.4 / WooCommerce 11.3.0 / PHP 8.3.36 for sandbox API authorization/isolation and production booking validation, retry behavior, signed webhooks and deduplication. Desktop, 1046px and mobile browser smoke tests passed with no plugin document overflow, page errors or relevant console errors.

## WooCommerce Merchant 1.2.1 controlled sandbox authorization (prepared 2026-11-19; deployment pending)

- The sample workspace can now submit only the `authorize_demo_sandbox` action for a sandbox package. Sample access remains blocked from live authorization. Normal merchants continue to use their authenticated `authorize` path and existing role checks.
- The Edge Function never accepts a client-supplied demo business ID. It loads `WOOCOMMERCE_DEMO_BUSINESS_ACCOUNT_ID` server-side, requires that account to be approved and active, and accepts only exact HTTPS origins from `WOOCOMMERCE_DEMO_STORE_ORIGINS`; missing or invalid configuration fails closed.
- Origin allowlisting alone is insufficient. Plugin 1.2.1 stores a ten-minute proof only after a WooCommerce administrator starts the nonce-protected connection. The Edge Function calls the same-origin `connect-proof` REST route and verifies the state, PKCE challenge and sandbox environment before issuing a five-minute authorization code.
- The Merchant API now rejects an API key whose stored environment disagrees with its `vs_live_`/`vs_test_` prefix. The undocumented `create_shipment_enabled_after_verification` action was removed. The official `create_shipment` action remains paused with `wallet_setup_pending`; this change does not activate courier booking or bypass the refund-safety review.
- New packages are `public/downloads/viasetu-woocommerce-1.2.1.zip` and `public/downloads/viasetu-woocommerce-demo-1.2.1.zip`. The user must install the 1.2.1 demo package before testing this handshake, then manually perform the Lovable-connected migration/function deployment and publish steps documented in `docs/woocommerce-lovable-release.md`.

## Customer feedback backend activation (deployed 2026-11-28)

- The reusable customer-feedback backend is active on production Supabase project `tksfdvnogzsweteetjjw`. The deployment was performed through the project-scoped Supabase OAuth connection after a read-only project/migration/function audit.
- Applied the additive local migrations `20261127144814_add_customer_feedback_surveys.sql` and `20261127180958_add_public_feedback_links.sql` in that order. Supabase recorded them remotely as `20261127191854_add_customer_feedback_surveys` and `20261127191902_add_public_feedback_links`.
- Production now has `feedback_surveys`, `feedback_invitations`, and `feedback_responses`, all with RLS enabled. Admins can read the survey data; only an active super admin can update the permitted survey fields, including `public_enabled`. Anonymous users have no direct table-write grant.
- Deployed only `feedback-survey` v1 with `verify_jwt = false`. The function validates reusable public submissions itself and verifies the caller JWT plus active `super_admin` role for survey management and invitation actions.
- Both built-in surveys are published and reusable links are enabled. Verification passed for function status ACTIVE, CORS preflight HTTP 200, public-status HTTP 200 for both forms, and the live `customer-experience` page rendering the 17-question shared form rather than the unavailable-link state.
- This release did not deploy any unrelated Edge Function or modify existing booking, merchant, wallet, authentication, courier, or CMS data. Real SMS delivery was not triggered during verification.

## Customer feedback multichannel campaigns (deployed 2026-11-28; Lovable publish pending)

- Added the additive local migration `20261127195712_feedback_campaign_delivery.sql`; Supabase recorded it remotely as `20261127201125_feedback_campaign_delivery`. It adds reusable email invitation fields plus RLS-protected `feedback_campaigns` and `feedback_deliveries` audit tables. Admin access is read-only; public/anonymous roles receive no direct access.
- Deployed only `feedback-survey` v2 with `verify_jwt = false`. The function continues to perform its own public-token and super-admin checks, and now supports channel readiness, masked audience preview, individual email invitations, bounded bulk SMS/email campaigns, dry-run review, delivery auditing, and aggregate-only AI campaign suggestions.
- SMS uses the booking's saved delivery phone. Email uses the order account email linked by `bookings.user_id -> profiles.email`; the frontend shows masked contact readiness and never receives raw bulk contact details. No raw customer name, phone, email, booking ID, or order ID is sent to Gemini/Lovable AI.
- The DLT-approved SMS template remains immutable in the campaign planner. Gemini may suggest a campaign name and editable email copy only; a super admin must review/save it. Bulk sending is capped at 25 selected orders, validates readiness server-side, requires a dry-run and explicit UI confirmation, and writes only masked recipient identifiers to the new delivery audit table.
- The Admin Analytics > Customer Feedback UI now includes secure link creation, Send SMS, Send email, a guarded bulk-campaign modal, recent campaign results, message previews, and operational instructions. This frontend source is committed for the normal Lovable-connected workflow but remains invisible on the live site until the project owner manually publishes Lovable.
- Verification passed: TypeScript, targeted ESLint, production build, `bun test src/lib/feedback-surveys.test.ts`, `git diff --check`, remote migration/RLS/grant inspection, Edge Function ACTIVE v2, HTTP 200 CORS/public-status checks, and HTTP 403 for an unauthenticated bulk dry-run. No real SMS or email was sent during verification.

## Recommended workflow for the next contributor

1. Read this file and `AGENTS.md`.
2. Check `git status`; preserve user work and the `_prototypes/` reference folder.
3. Fetch `origin/main` before editing. Never assume the local branch is current.
4. Inspect the current Supabase schema/policies/functions read-only before proposing migrations.
5. Keep changes additive and tenant-scoped.
6. Run TypeScript, targeted lint, production build, and the merchant Playwright test.
7. Re-fetch before push. If `origin/main` moved, rebase/merge safely and repeat verification.
8. Update this document with the new commit, migrations, functional status, known issues, and deployment verification.

## Useful local commands

```text
npx tsc --noEmit
npx eslint <changed TypeScript/TSX files>
.\node_modules\.bin\vite.cmd build
npx playwright test --config=playwright.merchant.config.ts
```

Local merchant URL while the development server is running:

`http://127.0.0.1:4174/viasetuforbusinesses`

## Shadowfax (Marketplace 360 forward) — Nov 2026
- Old reverse-pickup (RVP, 1.7x) integration replaced by forward delivery via `_shared/shadowfax.ts` (dale.shadowfax.in / dale.staging.shadowfax.in, `Token` auth).
- Serviceability: live `/v1/clients/serviceability/` independently checks seller_pickup/Marketplace at origin, customer_delivery/Regular at destination and seller_delivery/RTS at origin, matching Regular seller-return bookings. Missing exact tiers fail closed; price remains from SFX_Ratecard.xlsx Standard forward card (rate-cards.ts, 30% FSC, no RVP multiplier). Unknown state → priced at special-zone slab.
- Booking: `/v3/clients/orders/` single; multi-box uses MPS `/v2/clients/orders/` (parent AWB on booking, child AWB per box). Tracking v4, cancel v3, label `/client/generate_label/` with HTML fallback.
- `shadowfax-webhook` re-verifies each callback via tracking API (callbacks are unsigned).
- Production activation (2026-11-16): user relayed Shadowfax confirmation that the production token is active and production webhook is configured, then explicitly approved activation. Enabled only the Shadowfax courier toggle, preserving other settings. Webhook OPTIONS returned HTTP 200; actual incoming status delivery remains unverified.
- Corrected the obsolete `service=marketplace` query after both production checks returned `Invalid Request`. Deployed only `shadowfax-serviceability`; three exact-tier/missing-pincode tests pass. Production 462022 → 456001 passes pickup, delivery and return checks and quotes ₹91 courier freight for 1kg, 10×10×10cm. Production 560007 → 560068 fails pickup and seller return despite delivery coverage and is correctly rejected. No shipment/payment was created; booking-to-webhook end-to-end remains untested. Existing 22 security findings predate the toggle migration and were unchanged.
