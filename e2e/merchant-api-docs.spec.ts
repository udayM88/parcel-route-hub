import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:4174";

test("public merchant API documentation and integration downloads are available", async ({ page, request }) => {
  await page.goto(`${origin}/developers/merchant-api`);
  await expect(page.getByRole("heading", { name: "Build shipping into your commerce workflow." })).toBeVisible();
  await expect(page.getByText("Merchant API v1 beta")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download JS SDK" })).toHaveAttribute("href", "/downloads/viasetu-js-sdk.zip");
  await expect(page.getByRole("link", { name: "Download plugin beta" })).toHaveAttribute("href", "/downloads/viasetu-woocommerce.zip");

  for (const path of [
    "/downloads/viasetu-js-sdk.zip",
    "/downloads/viasetu-woocommerce.zip",
    "/docs/merchant-api/openapi.yaml",
    "/docs/merchant-api/quickstart.md",
  ]) {
    const response = await request.get(`${origin}${path}`);
    expect(response.ok(), `${path} should be downloadable`).toBeTruthy();
    expect((await response.body()).byteLength).toBeGreaterThan(100);
  }
});
