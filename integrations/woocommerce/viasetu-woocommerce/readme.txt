=== ViaSetu Merchant for WooCommerce ===
Contributors: viasetu
Tags: shipping, courier, tracking, woocommerce, logistics, labels
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
WC requires at least: 8.0
WC tested up to: 11.3
Stable tag: 1.0.0

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

== Installation ==

1. Upload `viasetu-woocommerce-1.0.0.zip` in Plugins > Add New > Upload Plugin.
2. Activate the plugin and open ViaSetu Merchant > Connection.
3. Choose Sign in and connect, sign in on the official ViaSetu domain and approve the HTTPS store.
4. Save the pickup address and checkout preferences.
5. Add ViaSetu Shipping to the required WooCommerce shipping zones.
6. Review Orders, Shipments, Billing, Labels, Automation and Diagnostics.

Use the separate demo ZIP on a staging WordPress installation when you need local fixtures with no external ViaSetu, courier, wallet or payment requests.

== Changelog ==

= 1.0.0 =
* Added single-use PKCE store authorization and automatic dedicated key/webhook setup.
* Added ViaSetu Merchant sections for overview, orders, shipments, billing, labels, shipping and automation.
* Added an isolated demo distribution generated from the same reviewed source.
* Hardened HTTPS, encryption, response-size, redirect, capability and credential-storage controls.
* Preserved live rates, product rules, tracking, labels, cancellation, signed webhooks and HPOS support.

= 0.2.0 =
* Added the initial guided dashboard, checkout controls, product rules and diagnostics.
