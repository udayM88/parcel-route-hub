# Align Shree Maruti with the current Innofulfill APIs

## Verified findings

- The configured Innofulfill API key works against the documented live-rate endpoint. A production test for `440014 → 411047`, 0.5 kg, surface returned **₹55 before GST / ₹64.90 including GST**. ViaSetu currently quotes **₹35 before GST** from its embedded rate card because the customer-facing rate path has live pricing disabled.
- Current Shree Maruti serviceability succeeds, but it uses the legacy Delcaper endpoint and legacy response shape. The documented endpoint is `POST /gateway/serviceability/ecomm`, whose result must be read from `data[].carriers[].serviceable` for carrier `SMILE`.
- Booking, tracking, labels, and cancellation also use legacy Delcaper routes and payloads. The linked documentation specifies the Innofulfill gateway v2 contracts instead.
- No live booking/cancellation test was performed during this review because it would create or alter a real courier order.

## Changes to make

### 1. Replace legacy authentication with the documented gateway authentication

- Use the configured `api-key` for supported gateway calls.
- Keep Bearer authentication as a controlled fallback using `POST /auth/login` with `username`, `password`, and `signinType: "EMAIL"`.
- Parse `id_token`, `refresh_token`, `expires_in`, `tenant_id`, and `user_id`; use the documented refresh-token endpoint rather than logging in again whenever possible.
- Remove sandbox fallback to production courier credentials so test traffic cannot accidentally reach production.

### 2. Move serviceability to the current endpoint

- Replace the legacy seller serviceability request with `POST /gateway/serviceability/ecomm`.
- Send `fromPincode`, `toPincode`, `paymentMode: "PREPAID"`, `operationType: "PICKUP_DELIVERY"`, and `carriers: ["SMILE"]`.
- Treat only an explicit `SMILE` carrier result with `serviceable: true` as serviceable; retain the partner-provided rejection reason.
- Check serviceability once per lane, then determine Surface/Air availability from successful mode-specific rate responses. Do not infer coverage or fall back when the partner explicitly rejects the lane.

### 3. Turn on documented live rates safely

- Connect both the standalone rate function and serviceability results to the existing Innofulfill v2 rate client.
- Continue using `pricing.baseRate` as the pre-GST courier cost because ViaSetu applies GST downstream; retain the partner's GST-inclusive `calculation.totalAmount` for audit metadata only.
- Request Surface and Air separately through `filters.delivery_mode`.
- Keep the embedded contracted card as a temporary fallback and comparison guardrail, recording API price, card price, variance, response trace ID, and selected source.
- Validate weights, dimensions, pincodes, mode, and declared value before calling the partner.

### 4. Migrate order creation to gateway v2

- Replace `POST /fulfillment/public/seller/order/ecomm/push-order` with `POST /gateway/booking-service/orders`.
- Map each shipment to the documented structure: reference/order details, four typed addresses, package dimensions and weight in kg, item details, `parcelCategory: "ECOMM"`, `deliveryPromise: "ECOMM"`, Surface/Air mode, prepaid payment, configured Shree Maruti carrier identity, and `autoManifest: true`.
- Preserve ViaSetu's no-COD rule and existing one-AWB-per-box assisted/consumer multi-box behavior.
- Store the system-generated `data.orderId`, `data.shipments[].awbNumber`, status, trace ID, and safe partner response details. Never log customer addresses or phone numbers in plaintext.
- Return actionable partner validation errors instead of replacing them with only “Internal server error.”

### 5. Migrate tracking, labels, and cancellation

- Tracking: use `GET /gateway/tracking-v2/api/tracking/awb/{awbNumber}` and pass raw courier statuses into ViaSetu's centralized status normalizer without a second local mapping layer.
- Labels: use `POST /gateway/pdf-generator/shipping-label` with `orderId`, `tenantId`, and `userId`; continue supporting binary/base64 PDF responses and verify the file is a valid PDF before saving it.
- Cancellation: use `POST /gateway/booking-service/orders/cancel/bulk` with `orders: [{ orderId, reason }]`; require the stored Innofulfill order ID rather than substituting an AWB.
- Keep existing refund, order-history, SMS, admin, and multi-parcel behavior unchanged around the new partner calls.

### 6. Reliability and security cleanup

- Add bounded retry/backoff only for network failures, rate limits, and temporary 5xx responses; do not retry validation failures or duplicate order creation blindly.
- Add strict request validation and ownership/internal authorization around booking, label persistence, tracking, and cancellation operations.
- Apply the Shree Maruti enable/disable setting consistently to rate and new booking attempts while allowing existing shipments to remain trackable and downloadable.
- Remove the public temporary rate-probe function and its hardcoded tenant identifier after the production paths are verified.

## Verification and rollout

1. Add contract tests using documented success, validation-error, unauthorized, and not-found response shapes.
2. Test serviceability and Surface/Air rates on several known lanes and compare live prices with the embedded card.
3. Create one low-value production test shipment, then verify stored order ID, AWB, label, tracking, and cancellation end to end.
4. Confirm multi-box consumer and assisted bookings still produce one independently tracked AWB and label per box.
5. Keep the legacy integration available only as a short rollback path during validation; remove it after the new gateway flow passes production checks.

## Expected customer impact

- More accurate partner serviceability and live courier rates.
- Booking failures will expose useful partner error details and trace IDs for investigation.
- Labels, tracking, and cancellation will use the same documented order identifiers and API generation as booking.
- The checkout, pricing markup, GST, payment, refund, and authentication experiences remain unchanged.
