import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("browser sample is enabled only for the controlled sandbox action", async () => {
  const source = await read("src/pages/business/BusinessWooCommerceConnect.tsx");
  assert.match(source, /action: isDemoSandbox \? "authorize_demo_sandbox" : "authorize"/);
  assert.match(source, /disabled=\{connecting \|\| isDemoLive \|\| !can\("integrations:write"\)\}/);
});

test("demo authorization is server-mapped, allowlisted and store-proven", async () => {
  const source = await read("supabase/functions/woocommerce-connect/index.ts");
  assert.match(source, /WOOCOMMERCE_DEMO_BUSINESS_ACCOUNT_ID/);
  assert.match(source, /WOOCOMMERCE_DEMO_STORE_ORIGINS/);
  assert.match(source, /environment !== "sandbox"/);
  assert.match(source, /verifySandboxStoreProof/);
  assert.match(source, /\/viasetu\/v1\/connect-proof/);
});

test("WordPress exposes a short-lived proof only for an admin-started flow", async () => {
  const source = await read("integrations/woocommerce/viasetu-woocommerce/includes/class-viasetu-connect.php");
  assert.match(source, /admin_post_viasetu_connect_start/);
  assert.match(source, /self::proof_key\( \$state \)/);
  assert.match(source, /'\/connect-proof'/);
  assert.match(source, /hash_equals\( \(string\) \$proof\['code_challenge'\], \$challenge \)/);
});

test("merchant API keeps the public shipment gate and has no hidden bypass", async () => {
  const source = await read("supabase/functions/merchant-api/index.ts");
  assert.doesNotMatch(source, /create_shipment_enabled_after_verification/);
  assert.match(source, /action === "create_shipment"/);
  assert.match(source, /wallet_setup_pending/);
  assert.match(source, /apiKey\.environment !== keyEnvironment/);
});
