import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test("giriş yapılmadan korumalı sayfaya gidilirse /login'e yönlenir", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("login sayfası render olur", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test.describe("kimlik doğrulanmış akış", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil — .env.local'e bakınız",
  );

  test("giriş yapıp bir sayfa yükleyebilir, hata sınırına düşmez", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', TEST_EMAIL!);
    await page.fill('input[name="password"]', TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    const body = await page.textContent("body");
    expect(body).not.toContain("Bir şeyler ters gitti");
  });
});
