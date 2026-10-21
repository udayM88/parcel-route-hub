# ViaSetu Project Context and Handoff

Last updated: 2026-10-22 (Asia/Kolkata)

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
- Production WooCommerce plugin package and complete external developer SDK/documentation

## Merchant creation and login

Production merchants should be created from the official admin flow:

1. Sign in at `/admin/login` with a `super_admin` or `operations` account.
2. Open `/admin/businesses`.
3. Use **Create Business User** and its password-setup workflow.

Do not manually insert production Auth/business records unless the official flow is broken and a reviewed recovery procedure is being followed.

The local sample credentials are intentionally development-only:

- Email: `demo@viasetu.local`
- Password: `Demo@1234`

They work only when `import.meta.env.DEV` is true. They are not a production merchant account and must not be enabled on the public site as a shared credential.

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
