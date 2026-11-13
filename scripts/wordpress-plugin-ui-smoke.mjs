import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.WP_SMOKE_URL || "http://127.0.0.1:4188").replace(/\/$/, "");
const username = process.env.WP_SMOKE_USER;
const password = process.env.WP_SMOKE_PASSWORD;
const mode = process.env.VIASETU_SMOKE_MODE || "production";

if (!username || !password) throw new Error("WP_SMOKE_USER and WP_SMOKE_PASSWORD are required.");
if (!new Set(["production", "demo"]).has(mode)) throw new Error("VIASETU_SMOKE_MODE must be production or demo.");

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(`${baseUrl}/wp-login.php`, { waitUntil: "domcontentloaded" });
  await page.locator("#user_login").fill(username);
  await page.locator("#user_pass").fill(password);
  await page.locator("#wp-submit").click();
  await page.waitForURL(/\/wp-admin\//);

  const tab = mode === "demo" ? "dashboard" : "connection";
  await page.goto(`${baseUrl}/wp-admin/admin.php?page=viasetu&tab=${tab}`, { waitUntil: "networkidle" });
  await page.locator(".viasetu-admin").waitFor({ state: "visible" });
  assert.equal(await page.locator(".viasetu-brand").getByText("ViaSetu Merchant", { exact: true }).isVisible(), true);
  const navigation = page.locator(".viasetu-tabs");
  assert.equal(await navigation.locator("a").count(), 10);
  assert.equal(await navigation.getByRole("link", { name: /Orders/ }).isVisible(), true);
  assert.equal(await navigation.getByRole("link", { name: /Billing/ }).isVisible(), true);
  assert.equal(await navigation.getByRole("link", { name: /Diagnostics/ }).isVisible(), true);

  if (mode === "demo") {
    assert.equal(await page.getByText("Sandbox demo", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("12,450.75", { exact: false }).first().isVisible(), true);
  } else {
    assert.equal(await page.getByRole("link", { name: "Sign in and connect" }).isVisible(), true);
    assert.equal(await page.getByRole("link", { name: "Create / apply for account" }).isVisible(), true);
  }

  const desktop = await page.locator(".viasetu-admin").evaluate((element) => {
    const hero = element.querySelector(".viasetu-hero");
    const shell = element.querySelector(".viasetu-shell");
    const connectCard = element.querySelector(".viasetu-connect-card");
    const heroStyle = hero ? getComputedStyle(hero) : null;
    return {
      overflow: element.scrollWidth > element.clientWidth + 1,
      heroBackgroundColor: heroStyle?.backgroundColor || "",
      connectBackground: connectCard ? getComputedStyle(connectCard).backgroundImage : "",
      shellDisplay: shell ? getComputedStyle(shell).display : "",
    };
  });
  assert.equal(desktop.overflow, false);
  assert.notEqual(desktop.heroBackgroundColor, "rgba(0, 0, 0, 0)");
  if (mode === "production") assert.match(desktop.connectBackground, /gradient/i);
  assert.equal(desktop.shellDisplay, "grid");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const mobile = await page.locator(".viasetu-admin").evaluate((element) => ({
    overflow: element.scrollWidth > element.clientWidth + 1,
    tabsOverflow: element.querySelector(".viasetu-tabs")?.scrollWidth > element.querySelector(".viasetu-tabs")?.clientWidth,
  }));
  assert.equal(mobile.overflow, false);
  assert.equal(await page.locator(".viasetu-brand").isVisible(), true);

  const relevantConsoleErrors = consoleErrors.filter(
    (message) => !message.includes("favicon.ico") && !message.includes("net::ERR_NETWORK_ACCESS_DENIED"),
  );
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(relevantConsoleErrors, []);
  process.stdout.write(`${JSON.stringify({ mode, desktop, mobile, relevantConsoleErrors, pageErrors }, null, 2)}\n`);
} finally {
  await browser.close();
}
