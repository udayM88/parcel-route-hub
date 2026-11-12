import { expect, test } from "@playwright/test";

const baseUrl = process.env.AUTH_BASE_URL || "http://127.0.0.1:4175";

for (const route of ["/admin/login", "/cms/login", "/ops/login", "/viasetuforbusinesses"]) {
  test(`${route} keeps the password eye toggle visible and preserves the value`, async ({ page }) => {
    await page.goto(`${baseUrl}${route}`);

    const password = page.getByLabel("Password", { exact: true });
    await password.fill("VisiblePass1!");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("VisiblePass1!");

    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("VisiblePass1!");
  });
}

test("password reset fields have independent visibility toggles", async ({ page }) => {
  await page.goto(`${baseUrl}/admin/reset-password`);

  const nextPassword = page.getByLabel("New Password", { exact: true });
  const confirmation = page.getByLabel("Confirm Password", { exact: true });
  await nextPassword.fill("ResetPass1!");
  await confirmation.fill("ResetPass1!");

  await page.getByRole("button", { name: "Show new password", exact: true }).click();
  await expect(nextPassword).toHaveAttribute("type", "text");
  await expect(confirmation).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show confirm password", exact: true }).click();
  await expect(confirmation).toHaveAttribute("type", "text");
  await expect(nextPassword).toHaveValue("ResetPass1!");
  await expect(confirmation).toHaveValue("ResetPass1!");
});
