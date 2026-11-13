# ViaSetu Merchant API

The ViaSetu Merchant API uses one HTTPS endpoint and an `action` field in every JSON request.

Endpoint:

`https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/merchant-api`

## Authentication

Send the merchant key as `Authorization: Bearer YOUR_API_KEY`. Keep the key on a trusted server. Never include it in browser JavaScript, React client components, mobile apps, or public repositories.

## Rates

```bash
curl -X POST 'https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/merchant-api' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"action":"rates","pickup_pincode":"411001","delivery_pincode":"560001","boxes":[{"weight_kg":0.5,"length_cm":20,"width_cm":15,"height_cm":10}]}'
```

## Create a shipment

Use a unique `Idempotency-Key` for every store order. Retrying the same key will never intentionally create a second ViaSetu booking.

```bash
curl -X POST 'https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/merchant-api' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Idempotency-Key: STORE-ORDER-12345' \
  -H 'Content-Type: application/json' \
  -d '{"action":"create_shipment","pickup":{"name":"My Store","phone":"9876543210","address":"12 MG Road","city":"Pune","state":"Maharashtra","pincode":"411001"},"delivery":{"name":"Customer","phone":"9123456780","address":"5 Brigade Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"},"boxes":[{"weight_kg":0.5,"length_cm":20,"width_cm":15,"height_cm":10}],"goods_type":"Apparel","declared_value":999}'
```

Shipment creation is enabled only after ViaSetu approves the merchant account and activates the live shipment flow. Until then the API returns `wallet_setup_pending` without creating or charging a shipment.

## Merchant workspace actions

These read actions let trusted server integrations render the same merchant-owned operational data used by the ViaSetu WooCommerce workspace:

* Account and connected-store status: `{"action":"account"}`
* Dashboard metrics and recent orders: `{"action":"dashboard"}`
* Paginated orders: `{"action":"orders","page":1,"per_page":25,"status":"IN_TRANSIT"}`
* Wallet and billing activity: `{"action":"billing","limit":50}`

Every query is scoped from the API key to one approved merchant account. Clients cannot supply or override a business account ID.

## Shipping actions

* Track: `{"action":"track","booking_id":"..."}` or `{"action":"track","awb":"..."}`
* Label: `{"action":"label","booking_id":"..."}`
* Cancel: `{"action":"cancel","booking_id":"...","reason":"Customer cancelled"}`
* Wallet: `{"action":"wallet"}`

## WooCommerce secure connection

ViaSetu Merchant for WooCommerce uses a short-lived authorization code and PKCE verifier. The merchant approves the HTTPS store in the ViaSetu console; the plugin exchanges the code server-to-server and receives a dedicated revocable key plus webhook signing secret once. Merchant passwords are never sent to WordPress.

To remove the current store connection and revoke its dedicated key, send `{"action":"disconnect"}` with that store key. This action cannot be undone with the revoked key; reconnect from WordPress to create a new one.

## Rate limits and errors

Keys default to 120 requests per minute. HTTP `429` includes `Retry-After`. Errors use:

```json
{"success":false,"error":{"code":"validation_error","message":"..."}}
```

## Webhook verification

For each delivery, calculate `HMAC-SHA256(signing_secret, timestamp + "." + raw_request_body)` and compare it with `X-ViaSetu-Signature` (`sha256=...`) using a constant-time comparison. Reject timestamps older than five minutes and deduplicate `X-ViaSetu-Delivery` values.
