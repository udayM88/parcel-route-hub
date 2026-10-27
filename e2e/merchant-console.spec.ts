import { expect, test } from "@playwright/test";

const base = `${process.env.MERCHANT_BASE_URL || "http://127.0.0.1:4174"}/viasetuforbusinesses`;

test("merchant sample keeps writes isolated and core screens usable", async ({ page }) => {
  const loginConsoleErrors: string[] = [];
  const loginPageErrors: string[] = [];
  const unsafeSupabaseRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") loginConsoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => loginPageErrors.push(error.message));
  page.on("request", (request) => {
    if (
      request.url().includes(".supabase.co")
      && !["GET", "HEAD", "OPTIONS"].includes(request.method())
    ) unsafeSupabaseRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto(base);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText(/Sample merchant access|Local sample access/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Fill (demo|sample)/ })).toHaveCount(0);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  const loginViewport = await page.evaluate(() => ({
    hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    hasVerticalOverflow: document.documentElement.scrollHeight > window.innerHeight,
  }));
  expect(loginViewport).toEqual({
    hasHorizontalOverflow: false,
    hasVerticalOverflow: false,
  });
  const relevantLoginConsoleErrors = loginConsoleErrors.filter(
    (message) => !message.includes("net::ERR_NETWORK_ACCESS_DENIED"),
  );
  expect(relevantLoginConsoleErrors).toEqual([]);
  expect(loginPageErrors).toEqual([]);
  await page.getByLabel("Work Email").fill("demo@viasetu.local");
  await page.getByLabel("Password", { exact: true }).fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in securely", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Sample Merchant/ })).toBeVisible();

  await page.goto(`${base}/orders`);
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.getByText("DLV-DEMO-92841", { exact: true })).toBeVisible();
  await page.getByLabel("Search merchant orders").fill("Ahmedabad");
  await expect(page.getByText("Meera Patel", { exact: true })).toBeVisible();

  await page.goto(`${base}/wallet`);
  await expect(page.getByRole("heading", { name: "Prepaid wallet" })).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Wallet funding is disabled in the sample account. No payment was started.", { exact: true })).toBeVisible();

  await page.goto(`${base}/developers`);
  await expect(page.getByRole("heading", { name: "API & Webhooks" })).toBeVisible();
  await page.getByPlaceholder("e.g. Shopify store").fill("Local test key");
  await page.getByLabel("Access").click();
  await page.getByRole("option", { name: "Read only" }).click();
  await page.getByLabel("Expires").click();
  await page.getByRole("option", { name: "30 days" }).click();
  await page.getByRole("button", { name: "Create key" }).click();
  await expect(page.getByText("This is a session-only sample token and cannot call the ViaSetu API.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText(/3 scopes · 120 requests\/min/)).toBeVisible();

  await page.goto(`${base}/module/rate-calculator`);
  await page.getByPlaceholder("Pickup pincode").fill("411001");
  await page.getByPlaceholder("Delivery pincode").fill("560001");
  await page.getByPlaceholder("Dead weight (kg)").fill("0.5");
  await page.getByRole("button", { name: "Calculate rates" }).click();
  await expect(page.getByText("Best price")).toBeVisible();

  await page.goto(`${base}/module/tracking`);
  await page.getByLabel("AWB or tracking ID").fill("VS-DEMO-AWB-1042");
  await page.getByRole("button", { name: "Track shipment" }).click();
  await expect(page.getByText("Delhivery")).toBeVisible();

  await page.goto(`${base}/module/pincodes`);
  await expect(page.getByText("Sample pincode serviceability", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Pickup pincode").fill("411001");
  await page.getByPlaceholder("Delivery pincode").fill("560001");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Sample coverage loaded without contacting courier services", { exact: true })).toBeVisible();

  await page.goto(`${base}/module/profile`);
  await expect(page.getByRole("heading", { name: "Business profile" })).toBeVisible();
  await expect(page.getByText("27SAMPLE1234X1Z5")).toBeVisible();

  await page.goto(`${base}/module/support`);
  await expect(page.getByRole("heading", { name: "Your support tickets" })).toBeVisible();
  await page.getByLabel("Subject").fill("Sample pickup support request");
  await page.getByLabel("Details").fill("This request must remain inside the local demo session.");
  await page.getByRole("button", { name: "Create ticket" }).click();
  await expect(page.getByText("Sample pickup support request", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Support reply").fill("Adding a local-only reply for verification.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Adding a local-only reply for verification.", { exact: true })).toBeVisible();

  await page.goto(`${base}/module/transactions`);
  await expect(page.getByRole("heading", { name: "Transaction report", exact: true })).toBeVisible();
  await expect(page.getByText("Sample shipment charge", { exact: true })).toBeVisible();
  await page.getByLabel("Search transactions").fill("refund");
  await expect(page.getByText("Sample cancellation refund", { exact: true })).toBeVisible();

  await page.goto(`${base}/module/analytics`);
  await expect(page.getByRole("heading", { name: "Order status distribution" })).toBeVisible();
  await expect(page.getByText("Courier mix", { exact: true })).toBeVisible();

  await page.goto(`${base}/module/addresses`);
  await expect(page.getByRole("heading", { name: "Saved pickup addresses" })).toBeVisible();
  await page.getByLabel("Contact name").fill("Demo Returns Desk");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("textbox", { name: "Address", exact: true }).fill("Sample Logistics Park");
  await page.getByLabel("City").fill("Pune");
  await page.getByLabel("State").fill("Maharashtra");
  await page.getByLabel("Pincode").fill("411045");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("Demo Returns Desk", { exact: true })).toBeVisible();
  expect(unsafeSupabaseRequests).toEqual([]);
});
