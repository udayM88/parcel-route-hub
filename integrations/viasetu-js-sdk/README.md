# ViaSetu Merchant SDK for JavaScript

Server-side JavaScript/TypeScript client for ViaSetu rates, shipments, tracking, labels, cancellations, and wallet balance.

## Install from the downloaded package

```bash
npm install ./viasetu-js-sdk
```

## Quick start

```js
import { ViaSetuClient } from "@viasetu/merchant-sdk";

const viasetu = new ViaSetuClient({
  apiKey: process.env.VIASETU_API_KEY,
});

const rates = await viasetu.rates({
  pickup_pincode: "411001",
  delivery_pincode: "560001",
  boxes: [{ weight_kg: 0.5, length_cm: 20, width_cm: 15, height_cm: 10 }],
});
```

Never bundle the API key into React, browser JavaScript, a mobile app, or a public repository. Call ViaSetu only from a trusted server, server action, API route, or backend process.

`createShipment` requires a unique idempotency key. Live shipment creation remains account-gated until ViaSetu enables it for the merchant.
