import { expect, test } from "@playwright/test";

const baseUrl = process.env.CMS_BASE_URL || "http://127.0.0.1:4175";
const projectRef = "tksfdvnogzsweteetjjw";
const adminId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const authorId = "33333333-3333-4333-8333-333333333333";

function encodeJwtPart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

test("CMS category and author dropdowns load, select and save their IDs", async ({ page }) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `${encodeJwtPart({ alg: "HS256", typ: "JWT" })}.${encodeJwtPart({
    aud: "authenticated",
    exp: expiresAt,
    role: "authenticated",
    sub: adminId,
  })}.test-signature`;

  await page.addInitScript(({ storageKey, session }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: `sb-${projectRef}-auth-token`,
    session: {
      access_token: accessToken,
      expires_at: expiresAt,
      expires_in: 3600,
      refresh_token: "test-refresh-token",
      token_type: "bearer",
      user: {
        id: adminId,
        aud: "authenticated",
        role: "authenticated",
        email: "cms-test@viasetu.local",
        app_metadata: {},
        user_metadata: {},
      },
    },
  });

  let savedPayload: Record<string, unknown> | null = null;
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith("/admin_users")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "super_admin", email: "cms-test@viasetu.local" }) });
      return;
    }
    if (url.pathname.endsWith("/cms_categories")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: categoryId, name: "Courier Guides" }]) });
      return;
    }
    if (url.pathname.endsWith("/cms_authors")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: authorId, name: "ViaSetu Editorial" }]) });
      return;
    }
    if (url.pathname.endsWith("/cms_content") && request.method() === "POST") {
      savedPayload = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "44444444-4444-4444-8444-444444444444" }) });
      return;
    }
    if (url.pathname.endsWith("/cms_content")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto(`${baseUrl}/admin/cms/posts/new`);

  const categorySelect = page.getByTestId("cms-category-select");
  const authorSelect = page.getByTestId("cms-author-select");
  await expect(categorySelect).toBeEnabled();
  await expect(authorSelect).toBeEnabled();
  await expect(categorySelect.locator("option")).toHaveCount(2);
  await expect(authorSelect.locator("option")).toHaveCount(2);

  await categorySelect.selectOption(categoryId);
  await authorSelect.selectOption(authorId);
  await expect(categorySelect).toHaveValue(categoryId);
  await expect(authorSelect).toHaveValue(authorId);

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("CMS relation regression test");
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect.poll(() => savedPayload).not.toBeNull();
  expect(savedPayload).toMatchObject({ category_id: categoryId, author_id: authorId });
});
