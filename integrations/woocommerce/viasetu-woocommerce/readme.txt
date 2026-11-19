=== ViaSetu Merchant for WooCommerce ===
Contributors: viasetu
Tags: shipping, courier, tracking, woocommerce, logistics, labels
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
WC requires at least: 8.0
WC tested up to: 11.3
Stable tag: 1.2.0

Secure ViaSetu merchant orders, billing, labels, live rates and tracking inside WooCommerce.

== Description ==

ViaSetu Merchant creates a dedicated WordPress admin workspace with:

* One-click, passwordless store authorization with PKCE and a single-use code.
* Encrypted, store-scoped API credentials and automatic signed-webhook setup.
* Live merchant dashboard, tenant-scoped orders and WooCommerce shipment mapping.
* Read-only wallet balance and billing ledger.
* Shipping labels, product shipping controls and checkout customization.
* Multiple courier quotes with price, speed or preferred-carrier sorting.
* Scheduled tracking sync, replay-protected webhooks and redacted diagnostics.
* Idempotent shipment requests and WooCommerce HPOS compatibility.

The plugin never collects a ViaSetu password or embeds a Supabase service-role key. Shipment creation remains controlled by ViaSetu's server-side merchant rollout and wallet/refund safety gates.

WooCommerce remains the product source of truth. The plugin reads product parcel data for rates and shipments but does not copy the full catalogue into ViaSetu. Billing is the real wallet ledger; the current Merchant API does not expose a standalone GST invoice download, so the plugin does not generate a fake one.

== Installation ==

1. Upload `viasetu-woocommerce-1.2.0.zip` in Plugins > Add New > Upload Plugin.
2. Activate the plugin and open ViaSetu Merchant > Connection.
3. Choose Sign in and connect, sign in on the official ViaSetu domain and approve the HTTPS store.
4. Save the pickup address and checkout preferences.
5. Add ViaSetu Shipping to the required WooCommerce shipping zones.
6. Review Orders, Shipments, Billing, Labels, Automation and Diagnostics.

Use the separate demo ZIP with an existing ViaSetu sandbox merchant account. The demo package accepts only `vs_test_` credentials and shows real sandbox API data; it never fabricates orders, wallet balances, AWBs or labels.

== Changelog ==

= 1.2.0 =
* Replaces all hard-coded demo fixtures with real, tenant-scoped sandbox API synchronization.
* Separates packages by credential type: production accepts `vs_live_` and demo accepts `vs_test_` only.
* Invalidates the old placeholder demo credential and requires a verified merchant connection.
* Improves responsive navigation, empty-table visibility, typography and narrow WordPress admin layouts.
* Keeps localhost sandbox testing on encrypted API keys and scheduled sync; HTTPS staging supports one-click authorization and signed webhooks.

= 1.1.0 =
* Restricts automatic booking to orders that actually selected ViaSetu Shipping.
* Adds strict pickup, delivery and product weight/dimension validation without fake parcel defaults.
* Adds environment-aware API-key validation, persistent verification status and clearer 401 handling.
* Adds safe transient-failure retries, missed-order recovery and failed-booking visibility.
* Requires a valid booking ID before marking a shipment successful.
* Adds an explicit India shipping-zone setup action and produces a verified single-folder ZIP.

= 1.0.0 =
* Added single-use PKCE store authorization and automatic dedicated key/webhook setup.
* Added ViaSetu Merchant sections for overview, orders, shipments, billing, labels, shipping and automation.
* Added an isolated demo distribution generated from the same reviewed source.
* Hardened HTTPS, encryption, response-size, redirect, capability and credential-storage controls.
* Preserved live rates, product rules, tracking, labels, cancellation, signed webhooks and HPOS support.

= 0.2.0 =
* Added the initial guided dashboard, checkout controls, product rules and diagnostics.
