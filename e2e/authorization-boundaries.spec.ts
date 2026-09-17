import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { getCredentials } from "./helpers/credentials";

/**
 * RLS'in kendisini (Postgres seviyesinde) doğrulamak için aynı rolden
 * ikinci, kimlik bilgisi bilinen bir test hesabı gerekir — bu .env.local'de
 * yok (her rol için tek bir paylaşılan test hesabı var). Onun yerine burada
 * requireRole()'ün (src/lib/auth/require-role.ts) uyguladığı rol-arası
 * yetkilendirme sınırı test ediliyor: yanlış role sahip bir kullanıcı
 * korumalı bir sayfaya gittiğinde /unauthorized'a yönlenmeli, sayfa
 * içeriğini hiç görmemeli.
 */

const UNAUTHORIZED_PATH = /\/unauthorized$/;

test.describe("Rol-arası yetkilendirme sınırları (requireRole)", () => {
  test("sales kullanıcısı /admin/users'a erişemez", async ({ page }) => {
    const { email, password } = getCredentials("sales");
    test.skip(!email || !password, "SALES_TEST_EMAIL / SALES_TEST_PASSWORD tanımlı değil");

    await loginAs(page, email!, password!);
    await page.goto("/admin/users");

    await page.waitForURL(UNAUTHORIZED_PATH, { timeout: 10_000 });
    await expect(page.getByText("Kullanıcılar", { exact: true })).toHaveCount(0);
  });

  test("first_call kullanıcısı /admin/audit-log'a erişemez", async ({ page }) => {
    const { email, password } = getCredentials("first_call");
    test.skip(!email || !password, "FIRST_CALL_TEST_EMAIL / FIRST_CALL_TEST_PASSWORD tanımlı değil");

    await loginAs(page, email!, password!);
    await page.goto("/admin/audit-log");

    await page.waitForURL(UNAUTHORIZED_PATH, { timeout: 10_000 });
  });

  test("partner_admin kullanıcısı /leads/[id] detay sayfasına erişemez", async ({ page }) => {
    const { email, password } = getCredentials("partner_admin");
    test.skip(!email || !password, "PARTNER_ADMIN_TEST_EMAIL / PARTNER_ADMIN_TEST_PASSWORD tanımlı değil");

    await loginAs(page, email!, password!);
    // requireRole(["admin","first_call","sales"]) rol kontrolü herhangi bir
    // veri sorgusundan önce çalışır — gerçek bir lead id'ye gerek yok.
    await page.goto("/leads/00000000-0000-0000-0000-000000000000");

    await page.waitForURL(UNAUTHORIZED_PATH, { timeout: 10_000 });
  });

  test("sales kullanıcısı /partner/assigned-leads'e erişemez", async ({ page }) => {
    const { email, password } = getCredentials("sales");
    test.skip(!email || !password, "SALES_TEST_EMAIL / SALES_TEST_PASSWORD tanımlı değil");

    await loginAs(page, email!, password!);
    await page.goto("/partner/assigned-leads");

    await page.waitForURL(UNAUTHORIZED_PATH, { timeout: 10_000 });
  });

  test("partner_admin kullanıcısı /first-call/new-lead'e erişemez", async ({ page }) => {
    const { email, password } = getCredentials("partner_admin");
    test.skip(!email || !password, "PARTNER_ADMIN_TEST_EMAIL / PARTNER_ADMIN_TEST_PASSWORD tanımlı değil");

    await loginAs(page, email!, password!);
    await page.goto("/first-call/new-lead");

    await page.waitForURL(UNAUTHORIZED_PATH, { timeout: 10_000 });
  });
});
