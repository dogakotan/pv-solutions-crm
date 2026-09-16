import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { loginAs } from "./helpers/auth";
import { createLeadViaUi } from "./helpers/actions";
import {
  createTestReferral,
  deleteLead,
  findLeadIdByCustomerName,
  findOfferIdByLeadId,
  findUserIdByEmail,
  findPartnerIdByEmail,
  hasCleanupCredentials,
} from "./helpers/cleanup";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const PARTNER_ADMIN_TEST_EMAIL = process.env.PARTNER_ADMIN_TEST_EMAIL;

// Dördüncü tur inceleme: kalem satırları girilmiş bir teklifte, Excel
// export'u offer.amount/vatIncluded'ı tamamen görmezden gelip toplamları
// kalem fiyatlarının toplamından yeniden hesaplıyordu — "KDV dahil" işaretli
// ve kalem birim fiyatları da KDV dahil girilmiş bir teklifte KDV ikinci kez
// ekleniyordu (%20 fazla fatura). Bu test, GENEL TOPLAM'ın her zaman girilen
// "Tutar"a eşit kaldığını (kalem fiyatlarından bağımsız) doğruluyor.
test.describe("Teklif Excel export'unda KDV çifte hesaplanmıyor", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !PARTNER_ADMIN_TEST_EMAIL || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / PARTNER_ADMIN_TEST_EMAIL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil",
  );

  test("kalem satırı olan, KDV dahil işaretli bir teklifte GENEL TOPLAM girilen tutara eşit kalır", async ({
    page,
  }) => {
    const customerName = `E2E-VAT-${Date.now()}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      await createLeadViaUi(page, customerName);
      const leadId = await findLeadIdByCustomerName(customerName);
      expect(leadId).toBeTruthy();

      const [adminId, partnerId] = await Promise.all([
        findUserIdByEmail(TEST_EMAIL!),
        findPartnerIdByEmail(PARTNER_ADMIN_TEST_EMAIL!),
      ]);
      expect(adminId).not.toBeNull();
      expect(partnerId).not.toBeNull();
      await createTestReferral({ leadId: leadId!, partnerId: partnerId!, referredBy: adminId! });

      await page.goto(`/leads/${leadId}`);
      await page.getByRole("button", { name: "Teklif Gönder" }).click();

      // Kalem fiyatı (5000) bilinçli olarak girilen Tutar'dan (12000) çok
      // farklı seçildi — bug varsa GENEL TOPLAM ~6000 (5000*1.2) çıkar,
      // düzeltilmişse 12000 (girilen Tutar) çıkar.
      await page.fill('input[name="itemProductName"]', "Panel");
      await page.fill('input[name="itemQuantity"]', "1");
      await page.fill('input[name="itemUnitPrice"]', "5000");
      await page.fill('input[name="amount"]', "12000");
      await page.check("#vatIncluded");
      await page.getByRole("button", { name: "Teklifi Gönder" }).click();
      await expect(page.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });

      const offerId = await findOfferIdByLeadId(leadId!);
      expect(offerId).toBeTruthy();

      // Excel route'u — versionId'yi bulmak için offer detay sayfasına git.
      await page.goto(`/offers/${offerId}`);
      const excelLink = page.locator('a[href*="/excel"]').first();
      const excelHref = await excelLink.getAttribute("href");
      expect(excelHref).toBeTruthy();

      const response = await page.request.get(excelHref!);
      expect(response.ok()).toBeTruthy();
      const buffer = await response.body();

      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.getWorksheet("Teklif");
      expect(sheet).toBeTruthy();

      let grandTotal: number | null = null;
      sheet!.eachRow((row) => {
        if (row.getCell(4).value === "GENEL TOPLAM") {
          grandTotal = Number(row.getCell(5).value);
        }
      });

      expect(grandTotal).not.toBeNull();
      expect(grandTotal!).toBeCloseTo(12000, 1);
    } finally {
      const leadId = await findLeadIdByCustomerName(customerName);
      if (leadId) await deleteLead(leadId);
    }
  });
});
