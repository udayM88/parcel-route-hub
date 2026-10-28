# ViaSetu Project Context and Handoff

Last updated: 2026-10-27 (Asia/Kolkata)

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
- Shipment creation still respects the server-side `create_shipment` safety gate. Do not alter the plugin to call the private `create_shipment_enabled_after_verification` action. Enable the public server action only after the existing refund-safety review is complete.
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

UI/planned or schema-gated (do not claim fully functional yet):

- Full merchant team users/roles/permissions
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
