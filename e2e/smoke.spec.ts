import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { getCredentials } from "./helpers/credentials";

const { email: TEST_EMAIL, password: TEST_PASSWORD } = getCredentials("admin");

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
    await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);

    const body = await page.textContent("body");
    expect(body).not.toContain("Bir şeyler ters gitti");
  });
});
