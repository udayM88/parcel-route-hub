import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inflateRawSync } from "node:zlib";

await import("./build-woocommerce-plugins.mjs");

function readEntries(archive) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const method = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    const content = method === 8 ? inflateRawSync(compressed) : compressed;
    entries.set(name, content);
    offset = dataStart + compressedSize;
  }
  return entries;
}

async function packageEntries(file) {
  return readEntries(await readFile(path.join(process.cwd(), "public", "downloads", file)));
}

function assertSafePackage(entries, root) {
  assert.equal(entries.size, 13);
  assert.equal(entries.has(`${root}/viasetu-woocommerce.php`), true, "plugin bootstrap must be exactly one folder below the ZIP root");
  for (const name of entries.keys()) {
    assert.equal(name.startsWith(`${root}/`), true, `${name} is outside the plugin root`);
    assert.equal(name.startsWith(`${root}/${root}/`), false, `${name} is double nested`);
    assert.equal(name.includes("\\"), false, `${name} uses a Windows separator`);
    assert.equal(name.includes("../"), false, `${name} contains path traversal`);
  }
}

test("production archive contains the live 1.2.1 plugin with one WordPress plugin folder", async () => {
  const entries = await packageEntries("viasetu-woocommerce-1.2.1.zip");
  assertSafePackage(entries, "viasetu-woocommerce");
  const bootstrap = entries.get("viasetu-woocommerce/viasetu-woocommerce.php")?.toString("utf8") || "";
  assert.match(bootstrap, /Plugin Name: ViaSetu Merchant for WooCommerce/);
  assert.match(bootstrap, /Version: 1\.2\.1/);
  assert.match(bootstrap, /define\( 'VIASETU_WC_DEMO_MODE', false \);/);
  assert.match(bootstrap, /if \( ! function_exists\( 'viasetu_wc_boot' \) \) \{/);
  assert.doesNotMatch(bootstrap, /vs_live_[0-9a-f]{48}/);
  const connect = entries.get("viasetu-woocommerce/includes/class-viasetu-connect.php")?.toString("utf8") || "";
  assert.match(connect, /'\/connect-proof'/);
  assert.match(connect, /Cache-Control', 'no-store/);
});

test("demo archive is a real sandbox-only connector without fixtures or embedded credentials", async () => {
  const entries = await packageEntries("viasetu-woocommerce-demo-1.2.1.zip");
  assertSafePackage(entries, "viasetu-woocommerce-demo");
  const bootstrap = entries.get("viasetu-woocommerce-demo/viasetu-woocommerce.php")?.toString("utf8") || "";
  assert.match(bootstrap, /Plugin Name: ViaSetu Merchant Demo for WooCommerce/);
  assert.match(bootstrap, /Version: 1\.2\.1-demo/);
  assert.match(bootstrap, /define\( 'VIASETU_WC_DEMO_MODE', true \);/);
  assert.match(bootstrap, /if \( ! function_exists\( 'viasetu_wc_boot' \) \) \{/);
  const client = entries.get("viasetu-woocommerce-demo/includes/class-viasetu-api-client.php")?.toString("utf8") || "";
  assert.doesNotMatch(client, /demo_response|12,450\.75|DLV-DEMO|Demo Courier/);
  assert.match(client, /wp_safe_remote_post/);
  const connect = entries.get("viasetu-woocommerce-demo/includes/class-viasetu-connect.php")?.toString("utf8") || "";
  assert.match(connect, /'\/connect-proof'/);
  for (const content of entries.values()) {
    const source = content.toString("utf8");
    assert.doesNotMatch(source, /vs_(?:live|test)_[0-9a-f]{48}/, "package must not embed an API credential");
  }
});
