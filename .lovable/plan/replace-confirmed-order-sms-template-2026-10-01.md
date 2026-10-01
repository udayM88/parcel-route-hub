# Replace Confirmed Order SMS Template

## Changes
- Update the enabled `ORDER_CONFIRMED` SMS configuration from Template ID `224595` to the approved DLT Message ID `226723`.
- Set the confirmation template variables in the exact approved sequence:
  1. `order_id` — ViaSetu Order ID
  2. `sender_name` — Customer name
  3. `courier` — Courier partner
  4. `awb` — AWB number
  5. `delivery_time` — Expected delivery
  6. `amount` — GST-inclusive customer amount
- Give the template a clear internal name for the Admin SMS settings screen.
- Keep the template enabled, retain its current recipients and customer-delivery setting, and leave all other order templates unchanged.

## Validation
- Re-read the saved `ORDER_CONFIRMED` configuration and confirm Template ID `226723` plus all six variables in the correct order.
- Verify the existing SMS engine resolves all six values for real bookings and sample test messages.
- Do not send a live test SMS automatically; the Admin test-send control remains available for an intentional test.
- Do not modify Fast2SMS credentials, OTP templates, OTP delivery, authentication, or other order-notification rules.

## Technical details
The existing notification engine reads the Template ID and ordered variable list dynamically from `sms_templates`, so this replacement is a focused configuration update. Existing duplicate protection, logging, and retry handling remain unchanged.
