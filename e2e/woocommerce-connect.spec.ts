import { expect, test } from "@playwright/test";

const base = `${process.env.MERCHANT_BASE_URL || "http://127.0.0.1:4174"}/viasetuforbusinesses`;

test("WooCommerce authorization returns to the requested store flow and blocks sample sessions", async ({ page }) => {
  const request = new URL(`${base}/connect/woocommerce`);
  request.searchParams.set("site_url", "https://shop.example.com");
  request.searchParams.set("redirect_uri", "https://shop.example.com/wp-admin/admin-post.php?action=viasetu_connect_callback");
  request.searchParams.set("webhook_url", "https://shop.example.com/wp-json/viasetu/v1/webhook");
  request.searchParams.set("code_challenge", "a".repeat(43));
  request.searchParams.set("state", "b".repeat(32));
  request.searchParams.set("store_name", "Example Store");
  request.searchParams.set("environment", "live");
  request.searchParams.set("plugin_version", "1.0.0");

  await page.goto(request.toString());
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByLabel("Work Email").fill("demo@viasetu.local");
  await page.getByLabel("Password", { exact: true }).fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in securely", exact: true }).click();

  await expect(page).toHaveURL(/\/viasetuforbusinesses\/connect\/woocommerce\?/);
  await expect(page.getByRole("heading", { name: "Connect this WooCommerce store" })).toBeVisible();
  await expect(page.getByText("Example Store", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample sessions cannot connect a live store", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve and connect" })).toBeDisabled();
});
