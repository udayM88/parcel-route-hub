# ViaSetu for WooCommerce 0.2.0

This is the source package for the ViaSetu WooCommerce connector. It talks only to the public ViaSetu Merchant API and never uses a Supabase service-role key.

The plugin stores merchant credentials in WordPress options encrypted with the site authentication salt, preferring Sodium and falling back to AES-256-GCM through OpenSSL. Use a dedicated, revocable merchant key for every store.

## Included workflows

- Guided ViaSetu setup screen and merchant-console-assisted connection.
- Direct encrypted API-key setup and wallet-backed connection test.
- Multiple live courier choices at checkout with price, speed, or preferred-carrier sorting.
- Product weight/dimension support, goods-type overrides, fragile markers, and per-product exclusion.
- Configurable fallback rate and Cash on Delivery availability.
- Manual or scheduled shipment tracking sync, signed webhook verification, and safe diagnostic logs.
- WooCommerce order actions for shipment creation, tracking, labels, and cancellation.
- High-Performance Order Storage compatibility declaration.

After activation, open **ViaSetu** in WordPress admin, complete Connection and Shipping & checkout, then add **ViaSetu Shipping** to the required WooCommerce shipping zones.

Merchant passwords are never collected by the plugin. The assisted method opens the official ViaSetu merchant console, where the merchant creates a store-scoped key and pastes it into WordPress.

See `readme.txt` for installation and supported workflows.
