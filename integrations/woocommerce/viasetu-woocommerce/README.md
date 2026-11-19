# ViaSetu Merchant for WooCommerce 1.2.1

ViaSetu Merchant adds a branded operations workspace to WordPress for merchant orders, WooCommerce fulfilment, wallet billing, labels, shipping rules, tracking automation and diagnostics.

## Packages

- `viasetu-woocommerce-1.2.1.zip` is the production connector. It accepts only a live `vs_live_` credential from an approved merchant account.
- `viasetu-woocommerce-demo-1.2.1.zip` is the real sandbox connector. It accepts only a `vs_test_` credential from the configured dedicated demo merchant and reads that tenant's sandbox data through the same Merchant API contract.

Both packages are produced from this source with `npm run build:woocommerce`. They have different WordPress plugin names, folder slugs and enforced credential environments. Do not activate both on one site. Neither package embeds an API key or merchant password.

## Secure connection model

The recommended connection is a short-lived authorization-code flow with PKCE:

1. WordPress creates a random state and verifier and stores them in a ten-minute user transient.
2. The merchant signs in on the official ViaSetu domain and explicitly approves the HTTPS store.
3. ViaSetu returns a single-use code bound to the exact store, callback, webhook and PKCE challenge.
4. WordPress exchanges the code server-to-server. The dedicated API key and webhook secret are returned once and encrypted before WordPress stores them.
5. ViaSetu stores only the API-key hash. The key is merchant-scoped, revocable, rate-limited and never exposed to browser JavaScript.

The plugin never asks for or stores a ViaSetu password. Manual API-key setup remains available as a recovery path and is the supported local-HTTP sandbox flow. Public HTTPS demo/staging stores can use the same one-click PKCE authorization as production.

The demo package contains no sample orders, wallet totals, customer names, AWBs, rates or random shipment responses. Until a real sandbox key is connected, it stays in Setup required state. After connection, every dashboard and order value comes from the tenant-scoped Merchant API.

## WordPress workspace

- Operations overview with live shipment metrics, wallet balance, readiness and recent orders.
- Tenant-scoped merchant order list and local WooCommerce shipment mapping.
- Wallet balance and read-only billing ledger.
- Courier-authoritative label retrieval, download and optional automatic fetch.
- Live checkout quotes, courier sorting, fallback rules and COD controls.
- Product dimensions, goods-type, fragile and exclusion controls.
- Manual and scheduled tracking sync plus signed, replay-protected webhooks.
- Redacted diagnostics, HTTPS/encryption checks and HPOS compatibility.

Shipment creation remains subject to the existing ViaSetu server-side account rollout gate. The plugin does not bypass wallet/refund safety controls.

## Current integration boundary

- WooCommerce products remain authoritative in WordPress. Weight, dimensions, goods type, fragile handling and exclusion rules are consumed for checkout quotes and shipment payloads; this release does not mirror the full product catalogue into a ViaSetu product database.
- Billing shows the real prepaid wallet ledger. Courier labels are retrieved from ViaSetu. A standalone GST/tax-invoice download is not exposed by the current Merchant API, so the plugin does not fabricate one or call a wallet statement an invoice.
- Production shipment creation remains server-gated. A sandbox or live key cannot bypass that backend gate.

## Requirements

- WordPress 6.3 or newer
- WooCommerce 8.0 or newer
- PHP 7.4 or newer
- HTTPS for one-click authorization and signed webhooks; localhost sandbox testing can use a dedicated `vs_test_` key plus scheduled sync
- Sodium or OpenSSL for credential encryption

Runtime compatibility is tested on WordPress 6.3.2 / WooCommerce 8.0.2 / PHP 7.4.33 and WordPress 7.1.4 / WooCommerce 11.3.0 / PHP 8.3.36. Sandbox API smoke tests mock the remote response; a real account verification still requires a valid `vs_test_` key from the intended demo merchant.

After activation open **ViaSetu Merchant → Connection**, approve the store, save the pickup address, then add **ViaSetu Shipping** to the relevant WooCommerce shipping zones.
