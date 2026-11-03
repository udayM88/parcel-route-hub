import { expect, test } from "@playwright/test";

const root = `${process.env.MERCHANT_BASE_URL || "http://127.0.0.1:4174"}/viasetuforbusinesses`;

const routes: Array<[string, string]> = [
  ["dashboard", "Dashboard"],
  ["orders", "Orders"],
  ["create-order", "Create Order"],
  ["wallet", "Wallet"],
  ["developers", "API & Integrations"],
  ["integrations", "Integration Hub"],
  ["module/bulk-booking", "Bulk Booking"],
  ["module/cod-orders", "COD Orders"],
  ["module/cod-dashboard", "COD Dashboard"],
  ["module/tracking", "Tracking"],
  ["module/weight-reconciliation", "Weight Reconciliation"],
  ["module/users", "Users & Access"],
  ["module/rate-cards", "My Rate Card"],
  ["module/rate-calculator", "Rate Calculator"],
  ["module/recharge-management", "Recharge Management"],
  ["module/invoices", "Invoices"],
  ["module/billing-statements", "Billing & Statements"],
  ["module/analytics", "Reports & Analytics"],
  ["module/transactions", "Transaction Report"],
  ["module/webhooks", "Webhook Subscriptions"],
  ["module/carrier-selection", "Carrier Selection"],
  ["module/carrier-rules", "Carrier Rules"],
  ["module/addresses", "Address Management"],
  ["module/pincodes", "Pincode Management"],
  ["module/profile", "Profile"],
  ["module/notifications", "Notification Settings"],
  ["module/activity-logs", "User Activity Logs"],
  ["module/active-sessions", "Active Sessions"],
  ["module/label-configuration", "Label Configuration"],
  ["module/invoice-configuration", "Invoice Configuration"],
  ["module/support", "Support"],
];

test("every merchant route renders without a runtime or permission failure", async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(root);
  await page.getByLabel("Work Email").fill("demo@viasetu.local");
  await page.getByLabel("Password", { exact: true }).fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in securely", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const [path, title] of routes) {
    await test.step(`${path} renders`, async () => {
      await page.goto(`${root}/${path}`);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      await expect(page.getByText("Permission required", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
      await expect(page).toHaveURL(`${root}/${path}`);
      await expect(page.locator("main").last()).toBeVisible();
      await expect(page.locator("body")).toContainText(title);
    });
  }

  expect(pageErrors.filter((message) => !message.includes("failed_to_load_clerk_js"))).toEqual([]);
});
