import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.CMS_BASE_URL || "http://127.0.0.1:4175";
const projectRef = "tksfdvnogzsweteetjjw";
const adminId = "11111111-1111-4111-8111-111111111111";

async function openNewCmsPost(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const encodeJwtPart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
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
        email: "cms-toolbar-test@viasetu.local",
        app_metadata: {},
        user_metadata: {},
      },
    },
  });

  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/admin_users")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: "super_admin", email: "cms-toolbar-test@viasetu.local" }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto(`${baseUrl}/admin/cms/posts/new`);
  await expect(page.locator(".cms-editor .ProseMirror")).toBeVisible();
}

async function selectEditorText(page: Page, text: string) {
  await page.locator(".cms-editor .ProseMirror").evaluate((editor, selectedText) => {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const content = node.textContent || "";
      const start = content.indexOf(selectedText);
      if (start === -1) continue;

      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + selectedText.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
      return;
    }
    throw new Error(`Could not find editor text: ${selectedText}`);
  }, text);
}

test("CMS text color, highlight and link preserve and format the selected text", async ({ page }) => {
  await openNewCmsPost(page);

  const editor = page.locator(".cms-editor .ProseMirror");
  await editor.fill("Compare express delivery service and parcel tracking service for your shipment.");

  await selectEditorText(page, "Compare");
  await page.getByTestId("cms-heading-select").selectOption("h2");
  await expect(editor.locator("h2")).toContainText("Compare express delivery service");
  await page.getByTestId("cms-heading-select").selectOption("p");

  await selectEditorText(page, "Compare");
  await page.getByRole("button", { name: "Text color" }).click();
  await expect(page.getByRole("group", { name: "Text color choices" })).toBeVisible();
  await page.getByRole("button", { name: "Use #ef4444 text color" }).click();
  await expect(editor.locator("span", { hasText: "Compare" })).toHaveCSS("color", "rgb(239, 68, 68)");

  await selectEditorText(page, "express delivery service");
  await page.getByRole("button", { name: "Highlight" }).click();
  await expect(editor.locator("mark", { hasText: "express delivery service" })).toBeVisible();

  await selectEditorText(page, "parcel tracking service");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(page.getByTestId("cms-link-panel")).toBeVisible();
  await page.getByRole("textbox", { name: "URL" }).fill("www.viasetu.com/tracking");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("cms-link-panel")).toBeHidden();
  const trackingLink = editor.locator('a[href="https://www.viasetu.com/tracking"]');
  await expect(trackingLink).toHaveText("parcel tracking service");

  await selectEditorText(page, "parcel tracking service");
  await page.getByRole("button", { name: "Highlight" }).click();
  await expect(trackingLink.locator("mark")).toHaveText("parcel tracking service");

  await selectEditorText(page, "parcel tracking service");
  await page.getByRole("button", { name: "Text color" }).click();
  await page.getByRole("button", { name: "Use #3b82f6 text color" }).click();
  await expect(trackingLink.locator("span")).toHaveCSS("color", "rgb(59, 130, 246)");

  await trackingLink.click();
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const urlInput = page.getByRole("textbox", { name: "URL" });
  await expect(urlInput).toHaveValue("https://www.viasetu.com/tracking");
  await urlInput.fill("https://www.viasetu.com/services/parcel-tracking");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(editor.locator('a[href="https://www.viasetu.com/services/parcel-tracking"]')).toHaveText("parcel tracking service");
});
