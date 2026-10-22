# ViaSetu for WooCommerce

This is the source package for the ViaSetu WooCommerce connector. It talks only to the public ViaSetu Merchant API and never uses a Supabase service-role key.

The plugin stores merchant credentials in WordPress options encrypted with the site authentication salt, preferring Sodium and falling back to AES-256-GCM through OpenSSL. Use a dedicated, revocable merchant key for every store.

See `readme.txt` for installation and supported workflows.
