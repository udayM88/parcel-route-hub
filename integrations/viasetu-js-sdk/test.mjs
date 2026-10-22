import assert from "node:assert/strict";
import test from "node:test";
import { ViaSetuApiError, ViaSetuClient } from "./index.js";

test("rates sends the merchant key and action", async () => {
  let request;
  const client = new ViaSetuClient({
    apiKey: "vs_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fetch: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ success: true, quotes: [] }), { status: 200 });
    },
  });
  const response = await client.rates({ pickup_pincode: "411001", delivery_pincode: "560001", boxes: [{ weight_kg: 1 }] });
  assert.equal(response.success, true);
  assert.equal(request.init.headers.Authorization.startsWith("Bearer vs_test_"), true);
  assert.equal(JSON.parse(request.init.body).action, "rates");
});

test("createShipment requires and forwards an idempotency key", async () => {
  let request;
  const client = new ViaSetuClient({
    apiKey: "vs_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fetch: async (_url, init) => {
      request = init;
      return new Response(JSON.stringify({ success: true, booking_id: "demo" }), { status: 201 });
    },
  });
  assert.throws(() => client.createShipment({}, {}), /idempotencyKey/);
  await client.createShipment({}, { idempotencyKey: "order-12345" });
  assert.equal(request.headers["Idempotency-Key"], "order-12345");
});

test("structured API errors are preserved", async () => {
  const client = new ViaSetuClient({
    apiKey: "vs_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    maxRetries: 0,
    fetch: async () => new Response(JSON.stringify({ success: false, error: { code: "not_found", message: "Shipment not found" } }), { status: 404 }),
  });
  await assert.rejects(() => client.track({ awb: "NOPE" }), (error) => {
    assert.equal(error instanceof ViaSetuApiError, true);
    assert.equal(error.status, 404);
    assert.equal(error.code, "not_found");
    return true;
  });
});
