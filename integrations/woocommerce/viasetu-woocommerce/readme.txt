=== ViaSetu for WooCommerce ===
Contributors: viasetu
Tags: shipping, courier, tracking, woocommerce, logistics
Requires at least: 6.3
Tested up to: 6.8
Requires PHP: 7.4
WC requires at least: 8.0
Stable tag: 0.2.0

Advanced ViaSetu checkout rates, shipment booking, tracking, labels, product rules and signed status webhooks.

== Description ==

Connects WooCommerce to a ViaSetu merchant account with a server-side API key. The plugin includes:

* Dedicated ViaSetu setup dashboard and merchant-console-assisted connection.
* Multiple live checkout rates with price, speed or preferred-carrier sorting.
* Product weight/dimension support, goods type, fragile markers and exclusions.
* Idempotent shipment creation from the WooCommerce order action.
* Tracking refresh with configurable background status synchronization.
* Shipping label retrieval.
* Courier cancellation when a WooCommerce order is cancelled.
* Signed webhook receiver with timestamp and replay protection.
* Configurable fallback rate, COD rules, manual sync and redacted diagnostics.
* HPOS compatibility.

Shipment creation is controlled by ViaSetu and becomes available only after the merchant account is approved and the live shipment API is enabled for that account.

== Installation ==

1. Upload `viasetu-woocommerce.zip` from Plugins > Add New > Upload Plugin.
2. Activate it and follow the automatic ViaSetu setup screen.
3. Sign in to the ViaSetu merchant console and create a dedicated store-scoped key, or paste an existing merchant API key.
4. Test the connection, save the pickup address and configure the webhook secret.
5. Add ViaSetu Shipping to the required WooCommerce shipping zones.
6. Review Shipping & checkout, Products, and Sync & webhooks in the ViaSetu admin menu.

== Changelog ==

= 0.2.0 =
* Added dedicated ViaSetu admin dashboard and guided setup.
* Added multiple checkout quotes, sorting, fallback and COD controls.
* Added product-level rules, configurable automation, manual sync and diagnostics.
* Rebuilt the distribution ZIP with portable WordPress paths.

= 0.1.0 =
* Initial beta with rates, shipments, tracking, labels, cancellations and signed webhooks.
