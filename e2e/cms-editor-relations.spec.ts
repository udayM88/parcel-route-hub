import { expect, test } from "@playwright/test";

const baseUrl = process.env.CMS_BASE_URL || "http://127.0.0.1:4175";
const projectRef = "tksfdvnogzsweteetjjw";
const adminId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const authorId = "33333333-3333-4333-8333-333333333333";
const newCategoryId = "55555555-5555-4555-8555-555555555555";
const newAuthorId = "66666666-6666-4666-8666-666666666666";

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
      if (request.method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: newCategoryId, name: "Shipping News" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: categoryId, name: "Courier Guides" }]) });
      return;
    }
    if (url.pathname.endsWith("/cms_authors")) {
      if (request.method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: newAuthorId, name: "New CMS Author" }) });
        return;
      }
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

  const titleInput = page.getByRole("textbox", { name: "Title", exact: true });
  const excerptInput = page.getByRole("textbox", { name: "Excerpt" });
  const keyphraseInput = page.getByRole("textbox", { name: "Focus Keyphrase" });
  const metaTitleInput = page.getByRole("textbox", { name: /Meta Title/ });
  const metaDescriptionInput = page.getByRole("textbox", { name: /Meta Description/ });

  await titleInput.fill("CMS relation regression test");
  await excerptInput.fill("All CMS inputs remain editable.");
  await keyphraseInput.fill("cms controls");
  await metaTitleInput.fill("CMS controls test");
  await metaDescriptionInput.fill("CMS form inputs and selection boxes remain interactive.");
  await expect(titleInput).toHaveValue("CMS relation regression test");
  await expect(excerptInput).toHaveValue("All CMS inputs remain editable.");
  await expect(keyphraseInput).toHaveValue("cms controls");
  await expect(metaTitleInput).toHaveValue("CMS controls test");
  await expect(metaDescriptionInput).toHaveValue("CMS form inputs and selection boxes remain interactive.");

  await page.getByTestId("cms-schema-select").selectOption("BlogPosting");
  await page.getByTestId("cms-robots-select").selectOption("noindex,follow");
  await expect(page.getByTestId("cms-schema-select")).toHaveValue("BlogPosting");
  await expect(page.getByTestId("cms-robots-select")).toHaveValue("noindex,follow");

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

  await page.getByRole("button", { name: "New category" }).click();
  await expect(page.getByTestId("cms-new-category-panel")).toBeVisible();
  const categoryNameInput = page.getByRole("textbox", { name: "Category name" });
  await categoryNameInput.fill("Shipping News");
  await page.getByTestId("cms-new-category-panel").getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("cms-new-category-panel")).toBeHidden();
  await expect(categorySelect).toHaveValue(newCategoryId);

  await page.getByRole("button", { name: "New author" }).click();
  await expect(page.getByTestId("cms-new-author-panel")).toBeVisible();
  const authorNameInput = page.getByRole("textbox", { name: "Author name" });
  await authorNameInput.fill("New CMS Author");
  await expect(authorNameInput).toHaveValue("New CMS Author");
  await page.getByTestId("cms-new-author-panel").getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("cms-new-author-panel")).toBeHidden();
  await expect(authorSelect).toHaveValue(newAuthorId);

  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect.poll(() => savedPayload).not.toBeNull();
  expect(savedPayload).toMatchObject({
    category_id: newCategoryId,
    author_id: newAuthorId,
    schema_type: "BlogPosting",
    robots: "noindex,follow",
  });
});
