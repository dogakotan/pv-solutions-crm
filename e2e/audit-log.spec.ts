import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("işlem kayıtları (audit log görüntüleme)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil — .env.local'e bakınız",
  );

  test("admin kayıtları görebilir ve varlık türüne göre filtreleyebilir", async ({ page }) => {
    await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);

    await page.goto("/admin/audit-log");
    await expect(page.getByRole("heading", { name: "İşlem Kayıtları" })).toBeVisible();
    await page.waitForSelector("table tbody tr", { timeout: 15_000 });

    const unfilteredCount = await page.locator("table tbody tr").count();
    expect(unfilteredCount).toBeGreaterThan(0);

    await page.selectOption("#entity-type", "partners");
    await page.getByRole("button", { name: "Filtrele" }).click();
    await page.waitForURL(/entityType=partners/, { timeout: 10_000 });
    await page.waitForSelector("table tbody tr", { timeout: 15_000 });

    const rows = page.locator("table tbody tr");
    const filteredCount = await rows.count();
    expect(filteredCount).toBeGreaterThan(0);
    // Her satırda "Varlık" sütunu "Partner" yazmalı (partners için Türkçe etiket).
    await expect(rows.first()).toContainText("Partner");
  });
});
