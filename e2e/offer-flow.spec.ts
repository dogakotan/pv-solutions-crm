import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createLeadViaUi } from "./helpers/actions";
import { deleteLead, findLeadIdByCustomerName, hasCleanupCredentials } from "./helpers/cleanup";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("teklif gönderme ve revize etme (create_offer / revise_offer RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("teklif gönderilir, revize edilince eski revizyon 'Eski Revizyon' olur", async ({ page }) => {
    const customerName = `E2E-${Date.now()}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);

      // Teklifin bağlanacağı atılabilir lead
      await createLeadViaUi(page, customerName);
      const leadId = await findLeadIdByCustomerName(customerName);
      expect(leadId).toBeTruthy();

      await page.goto(`/leads/${leadId}`);

      await page.getByRole("button", { name: "Teklif Gönder" }).click();
      await page.fill('input[name="amount"]', "10000");
      await page.getByRole("button", { name: "Teklifi Gönder" }).click();
      // "Rev.0" ayrıca sayfadaki satış sonucu formunun offerVersionId
      // <select>'inde ve revizyon detay dialog'unun başlığında da geçiyor
      // — offer_version_row'un kendi (dıştaki, kapalı hâldeki) satır
      // butonuna daraltmak gerekiyor.
      await expect(page.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: "Revize Et" }).click();
      await page.fill('input[name="amount"]', "12000");
      await page.getByRole("button", { name: "Revizyonu Gönder" }).click();

      await expect(page.getByRole("button", { name: /Rev\.1/ })).toBeVisible({ timeout: 15_000 });
      // Rozet metni satırın kendi (kapalı) önizlemesinde VE gizli detay
      // dialog'unda iki kez geçiyor — tek buton olarak, birleşik erişilebilir
      // adıyla (Rev.0 ... Eski Revizyon) daraltmak gerekiyor.
      await expect(page.getByRole("button", { name: /Rev\.0.*Eski Revizyon/ })).toBeVisible();
    } finally {
      const leadId = await findLeadIdByCustomerName(customerName);
      if (leadId) await deleteLead(leadId);
    }
  });
});
