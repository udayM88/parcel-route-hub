import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sfxServiceablePins } from "../_shared/shadowfax.ts";

Deno.test("Marketplace pickup requires its exact tier, not merely a listed pincode", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assertEquals(url.searchParams.get("service"), "seller_pickup");
    return new Response(JSON.stringify([
      { code: 462022, services: ["Surface_Mkt"] },
      { code: 456001, services: ["Marketplace"] },
    ]));
  };
  try {
    const result = await sfxServiceablePins("https://example.test/api", "test-token", ["462022", "456001"], "seller_pickup", "Marketplace");
    assertEquals(result.apiOk, true);
    assertEquals([...result.serviceable], ["456001"]);
  } finally { globalThis.fetch = original; }
});

for (const [service, tier] of [["customer_delivery", "Regular"], ["seller_delivery", "RTS"]] as const) {
  Deno.test(`${service} requires ${tier} and rejects missing pincodes`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input) => {
      assertEquals(new URL(String(input)).searchParams.get("service"), service);
      return new Response(JSON.stringify([{ code: 462022, services: [tier] }]));
    };
    try {
      const result = await sfxServiceablePins("https://example.test/api", "test-token", ["462022", "456001"], service, tier);
      assertEquals([...result.serviceable], ["462022"]);
    } finally { globalThis.fetch = original; }
  });
}