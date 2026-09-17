import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  createTestLead,
  createTestReferral,
  deleteLead,
  findUserIdByEmail,
  findPartnerIdByEmail,
  getPartnerPerformanceRow,
  hasCleanupCredentials,
} from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

// src/lib/partner-rating.ts'deki computeSuggestedPartnerRating ile aynı formül —
// e2e testinin uygulama koduna (module resolution/path alias) bağımlı olmadan
// çalışması için burada bilinçli olarak kopyalanmıştır.
function computeSuggestedPartnerRating(input: {
  acceptanceRate: number;
  avgResponseHours: number | null;
  salesCount: number;
  referralCount: number;
}): number | null {
  if (input.referralCount === 0) return null;
  const acceptanceScore = (input.acceptanceRate / 100) * 5;
  const conversionScore = Math.min(input.salesCount / input.referralCount, 1) * 5;
  const responseScore =
    input.avgResponseHours == null ? 2.5 : Math.max(0, 5 - (input.avgResponseHours / 48) * 5);
  const weighted = acceptanceScore * 0.5 + conversionScore * 0.3 + responseScore * 0.2;
  return Math.round(weighted * 10) / 10;
}

test.describe("Partnerin hesaplanan puanı (3.6 — set_partner_rating'den bağımsız görünürlük)", () => {
  const { email: salesEmail, password: salesPassword } = getCredentials("sales");
  const { email: partnerEmail, password: partnerPassword } = getCredentials("partner_admin");
  const { email: adminEmail, password: adminPassword } = getCredentials("admin");

  test.skip(!salesEmail || !salesPassword, "SALES_TEST_EMAIL / SALES_TEST_PASSWORD tanımlı değil");
  test.skip(
    !partnerEmail || !partnerPassword,
    "PARTNER_ADMIN_TEST_EMAIL / PARTNER_ADMIN_TEST_PASSWORD tanımlı değil"
  );
  test.skip(!adminEmail || !adminPassword, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("Performans sekmesinde ve Raporlar'da hesaplanan puan, manuel puanın yanında gösterilir", async ({
    browser,
  }) => {
    const salesUserId = await findUserIdByEmail(salesEmail!);
    const partnerId = await findPartnerIdByEmail(partnerEmail!);
    expect(salesUserId).not.toBeNull();
    expect(partnerId).not.toBeNull();

    const customerName = `E2E Suggested Rating Test ${Date.now()}`;
    const leadId = await createTestLead({
      customerName,
      ownerId: salesUserId!,
      salesUserId: salesUserId!,
    });
    await createTestReferral({ leadId, partnerId: partnerId!, referredBy: salesUserId! });

    try {
      // Partner referral'ı kabul eder.
      const partnerContext = await browser.newContext();
      const partnerPage = await partnerContext.newPage();
      await loginAs(partnerPage, partnerEmail!, partnerPassword!);
      await partnerPage.goto("/partner/assigned-leads");
      await partnerPage.getByPlaceholder("Müşteri, lead no veya şehir ara...").fill(customerName);
      const row = partnerPage.locator("tbody tr").filter({ hasText: customerName });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Kabul Et" }).click();
      await expect(row.getByText("Kabul Edildi")).toBeVisible({ timeout: 10_000 });
      await partnerContext.close();

      // Satışçı teklif gönderir ve kazanıldı olarak kaydeder.
      const salesContext = await browser.newContext();
      const salesPage = await salesContext.newPage();
      await loginAs(salesPage, salesEmail!, salesPassword!);
      await salesPage.goto(`/leads/${leadId}`);
      await salesPage.getByRole("button", { name: "Teklif Gönder" }).click();
      await salesPage.fill('input[name="amount"]', "50000");
      await salesPage.getByRole("button", { name: "Teklifi Gönder" }).click();
      await expect(salesPage.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });
      await salesPage.getByRole("button", { name: "Kazanıldı" }).click();
      await salesPage.fill('input[name="finalAmount"]', "50000");
      await salesPage.getByRole("button", { name: "Sonucu Kaydet" }).click();
      await expect(
        salesPage.getByRole("definition").filter({ hasText: "Beklemede" })
      ).toBeVisible({ timeout: 10_000 });
      await salesContext.close();

      // Bu partner paylaşılan bir test hesabı olduğundan geçmiş testlerden kalan
      // referral'ları da içerebilir — sabit bir değer varsaymak yerine beklenen
      // "hesaplanan puan" aynı get_partner_performance RPC'sinden okunan güncel
      // sayılarla türetiliyor.
      const perfRow = await getPartnerPerformanceRow(partnerId!);
      expect(perfRow).not.toBeNull();
      const expectedSuggested = computeSuggestedPartnerRating({
        acceptanceRate: perfRow!.acceptance_rate,
        avgResponseHours: perfRow!.avg_response_hours,
        salesCount: perfRow!.sales_count,
        referralCount: perfRow!.referral_count,
      });
      expect(expectedSuggested).not.toBeNull();

      // Admin, partner detay sayfasının Performans sekmesinde hesaplanan puanı görür.
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await loginAs(adminPage, adminEmail!, adminPassword!);
      await adminPage.goto(`/partners/${partnerId}?tab=performance`);
      await expect(
        adminPage.getByText(`Hesaplanan: ${expectedSuggested!.toFixed(1)}`)
      ).toBeVisible({ timeout: 10_000 });

      // Raporlar sayfasındaki Partner Bazlı Performans tablosunda da aynı sütun var.
      await adminPage.goto("/reports");
      await expect(adminPage.getByRole("columnheader", { name: "Hesaplanan Puan" })).toBeVisible();
      await adminContext.close();
    } finally {
      await deleteLead(leadId);
    }
  });
});
