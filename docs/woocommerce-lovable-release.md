# WooCommerce connection release through Lovable

This is the reviewed manual handoff for the ViaSetu/Lovable project. Publishing remains a human action in Lovable. Do not run these steps against another Supabase project.

## Release scope

- GitHub branch: `main`
- Supabase project: `tksfdvnogzsweteetjjw`
- Additive migration: `supabase/migrations/20261113090000_woocommerce_secure_connect.sql`
- New Edge Function: `supabase/functions/woocommerce-connect/index.ts`
- Updated public merchant API: `supabase/functions/merchant-api/index.ts`
- Function configuration: `woocommerce-connect` and `merchant-api` both keep `verify_jwt = false`; each function performs its own action-specific authentication.

Do not deploy unrelated Edge Functions. Do not redeploy public courier webhook receivers. Do not enable or bypass the existing `create_shipment` refund-safety gate.

## Manual Lovable release

1. Open the existing Lovable project `e9e095f5-b76e-4f4a-9422-238e7ebb718c` and sync the latest reviewed GitHub `main` commit.
2. Inspect the connected project's remote migration history first. An Edge Function 404 does not prove whether the migration was applied.
3. If `20261113090000_woocommerce_secure_connect` is absent remotely, review and apply only that migration. It adds the WooCommerce authorization/connection tables, indexes, RLS policy, trigger and exchange RPC; it must not delete or rewrite existing merchant, booking, wallet or authentication rows. If it is already recorded remotely, do not run it again.
4. Deploy `woocommerce-connect` from the reviewed `main` source.
5. Deploy `merchant-api` from the same reviewed commit so account, dashboard, orders, billing and disconnect actions match the plugin.
6. Publish the Lovable frontend only after the migration and both functions succeed.

## Required verification

1. `OPTIONS /functions/v1/woocommerce-connect` must no longer return 404 and must include the CORS headers.
2. A malformed POST must return a controlled JSON 4xx response, not a gateway 404 or browser fetch error.
3. Start the sandbox plugin connection from the HTTPS WordPress store and approve it with an approved non-sample merchant account.
4. Confirm the callback stores a dedicated `vs_test_...` key and verifies the merchant account without exposing the key in browser or server logs.
5. Confirm the store connection, API key and webhook subscription belong to the same `business_account_id`.
6. Verify account, orders, wallet/billing, labels and tracking reads from WordPress. Do not claim live shipment creation while the server safety gate returns `wallet_setup_pending`.

If the remote migration state is ambiguous, or any migration/function step fails, stop the release. Do not delete tables, mark an unapplied migration as applied, or overwrite merchant data as a recovery action.
