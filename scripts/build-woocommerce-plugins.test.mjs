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
  for (const name of entries.keys()) {
    assert.equal(name.startsWith(`${root}/`), true, `${name} is outside the plugin root`);
    assert.equal(name.includes("\\"), false, `${name} uses a Windows separator`);
    assert.equal(name.includes("../"), false, `${name} contains path traversal`);
  }
}

test("production archive contains the live 1.0 plugin", async () => {
  const entries = await packageEntries("viasetu-woocommerce-1.0.0.zip");
  assertSafePackage(entries, "viasetu-woocommerce");
  const bootstrap = entries.get("viasetu-woocommerce/viasetu-woocommerce.php")?.toString("utf8") || "";
  assert.match(bootstrap, /Plugin Name: ViaSetu Merchant for WooCommerce/);
  assert.match(bootstrap, /Version: 1\.0\.0/);
  assert.match(bootstrap, /define\( 'VIASETU_WC_DEMO_MODE', false \);/);
  assert.match(bootstrap, /if \( ! function_exists\( 'viasetu_wc_boot' \) \) \{/);
  assert.doesNotMatch(bootstrap, /vs_live_[0-9a-f]{48}/);
});

test("demo archive is isolated from production requests", async () => {
  const entries = await packageEntries("viasetu-woocommerce-demo-1.0.0.zip");
  assertSafePackage(entries, "viasetu-woocommerce-demo");
  const bootstrap = entries.get("viasetu-woocommerce-demo/viasetu-woocommerce.php")?.toString("utf8") || "";
  assert.match(bootstrap, /Plugin Name: ViaSetu Merchant Demo for WooCommerce/);
  assert.match(bootstrap, /Version: 1\.0\.0-demo/);
  assert.match(bootstrap, /define\( 'VIASETU_WC_DEMO_MODE', true \);/);
  assert.match(bootstrap, /if \( ! function_exists\( 'viasetu_wc_boot' \) \) \{/);
});
