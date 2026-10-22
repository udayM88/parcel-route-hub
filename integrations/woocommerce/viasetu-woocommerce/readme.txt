=== ViaSetu for WooCommerce ===
Contributors: viasetu
Tags: shipping, courier, tracking, woocommerce, logistics
Requires at least: 6.3
Tested up to: 6.8
Requires PHP: 7.4
WC requires at least: 8.0
Stable tag: 0.1.0

ViaSetu live shipping rates, merchant shipment booking, tracking, labels and signed status webhooks.

== Description ==

Connects WooCommerce to a ViaSetu merchant account with a server-side API key. The plugin includes:

* Live checkout rates from enabled ViaSetu courier partners.
* Idempotent shipment creation from the WooCommerce order action.
* Tracking refresh and hourly background status synchronization.
* Shipping label retrieval.
* Courier cancellation when a WooCommerce order is cancelled.
* Signed webhook receiver with timestamp and replay protection.
* HPOS compatibility.

Shipment creation is controlled by ViaSetu and becomes available only after the merchant account is approved and the live shipment API is enabled for that account.

== Installation ==

1. Upload the plugin ZIP from Plugins > Add New > Upload Plugin.
2. Activate the plugin and confirm WooCommerce is active.
3. Open WooCommerce > ViaSetu.
4. Add a dedicated ViaSetu merchant API key and pickup address.
5. Add ViaSetu Shipping to the required WooCommerce shipping zones.
6. Create a webhook subscription in the ViaSetu console using the URL shown in the plugin settings, then copy the signing secret into WordPress.

== Changelog ==

= 0.1.0 =
* Initial beta with rates, shipments, tracking, labels, cancellations and signed webhooks.
