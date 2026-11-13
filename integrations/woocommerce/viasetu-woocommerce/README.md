# ViaSetu Merchant for WooCommerce 1.0.0

ViaSetu Merchant adds a branded operations workspace to WordPress for merchant orders, WooCommerce fulfilment, wallet billing, labels, shipping rules, tracking automation and diagnostics.

## Packages

- `viasetu-woocommerce-1.0.0.zip` is the production connector. It uses the live ViaSetu Merchant API and requires an approved merchant account.
- `viasetu-woocommerce-demo-1.0.0.zip` is an isolated demonstration connector. It uses local fixtures and never calls ViaSetu, courier, wallet or payment endpoints.

Both packages are produced from this source with `npm run build:woocommerce`. The production and demo builds have different WordPress plugin names and folder slugs, so they are easy to identify. Do not activate both on one site.

## Secure connection model

The recommended connection is a short-lived authorization-code flow with PKCE:

1. WordPress creates a random state and verifier and stores them in a ten-minute user transient.
2. The merchant signs in on the official ViaSetu domain and explicitly approves the HTTPS store.
3. ViaSetu returns a single-use code bound to the exact store, callback, webhook and PKCE challenge.
4. WordPress exchanges the code server-to-server. The dedicated API key and webhook secret are returned once and encrypted before WordPress stores them.
5. ViaSetu stores only the API-key hash. The key is merchant-scoped, revocable, rate-limited and never exposed to browser JavaScript.

The plugin never asks for or stores a ViaSetu password. Manual API-key setup remains available as a recovery path.

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

## Requirements

- WordPress 6.3 or newer
- WooCommerce 8.0 or newer
- PHP 7.4 or newer
- HTTPS for production one-click connection
- Sodium or OpenSSL for credential encryption

Runtime compatibility was verified with both production and demo packages on WordPress 6.3.2 / WooCommerce 8.0.0 / PHP 7.4.33 and WordPress 7.1.4 / WooCommerce 11.3.0 / PHP 8.1.34. The demo verification also asserts that no outbound HTTP request is emitted.

After activation open **ViaSetu Merchant → Connection**, approve the store, save the pickup address, then add **ViaSetu Shipping** to the relevant WooCommerce shipping zones.
