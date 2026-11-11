const { test, expect } = require("@playwright/test");
const pages = ["index.html","categories.html","about.html","contact.html","product.html"];

for (const width of [320,360,390,430]) {
  test.describe(`mobile viewport ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });
    for (const file of pages) {
      test(`${file} loads without horizontal overflow`, async ({ page }) => {
        const response = await page.goto(`/${file}`);
        expect(response && response.ok()).toBeTruthy();
        await page.waitForLoadState("domcontentloaded");
        await expect(page.locator("body")).toBeVisible();
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `Unexpected horizontal overflow on ${file}`).toBeLessThanOrEqual(2);
      });
    }
  });
}

test("home menu opens and exposes primary destinations", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#menuPanel")).toHaveClass(/open/);
  await expect(page.locator("#menuPanel")).toContainText("Home");
  await expect(page.locator("#menuPanel")).toContainText("Contact");
});

test("public pages include description and social preview metadata", async ({ page }) => {
  for (const file of pages) {
    await page.goto(`/${file}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /DeLune/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /https:\/\//);
  }
});

test("moderator page presents sign-in, not the dashboard, to a signed-out visitor", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/moderate.html");
  await expect(page.locator("#loginPanel")).toBeVisible();
  await expect(page.locator("#dashboard")).toBeHidden();
});
