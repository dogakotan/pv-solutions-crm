import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  createTestLead,
  createTestReferral,
  deleteLead,
  findUserIdByEmail,
  findPartnerIdByEmail,
  hasCleanupCredentials,
} from "./helpers/cleanup";

// Dördüncü tur inceleme: getPartnerSiteVisits (ve aynı desendeki diğer
// partner-facing sorgular) leads join'inde deleted_at is null filtresi hiç
// taşımıyordu — admin bir lead'i sildikten sonra bile partner, o lead'in
// telefon/adres bilgisini Keşif Ziyaretleri'nde görmeye devam ediyordu.
test.describe("Soft-silinen lead partner'a sızmıyor (getPartnerSiteVisits)", () => {
  const adminEmail = process.env.E2E_TEST_EMAIL;
  const adminPassword = process.env.E2E_TEST_PASSWORD;
  const partnerEmail = process.env.PARTNER_ADMIN_TEST_EMAIL;
  const partnerPassword = process.env.PARTNER_ADMIN_TEST_PASSWORD;

  test.skip(!adminEmail || !adminPassword, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(
    !partnerEmail || !partnerPassword,
    "PARTNER_ADMIN_TEST_EMAIL / PARTNER_ADMIN_TEST_PASSWORD tanımlı değil"
  );
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("admin lead'i silince partner Keşif Ziyaretleri'nde artık görmüyor", async ({ page, browser }) => {
    const adminId = await findUserIdByEmail(adminEmail!);
    const partnerId = await findPartnerIdByEmail(partnerEmail!);
    expect(adminId).not.toBeNull();
    expect(partnerId).not.toBeNull();

    const customerName = `E2E Soft Delete Leak ${Date.now()}`;
    const leadId = await createTestLead({
      customerName,
      ownerId: adminId!,
      stage: "survey_scheduled",
    });
    await createTestReferral({ leadId, partnerId: partnerId!, referredBy: adminId! });

    try {
      const partnerContext = await browser.newContext();
      const partnerPage = await partnerContext.newPage();
      await loginAs(partnerPage, partnerEmail!, partnerPassword!);
      await partnerPage.goto("/partner/site-visits");
      await expect(partnerPage.getByText(customerName)).toBeVisible({ timeout: 10_000 });

      // gerçek soft_delete_lead RPC'sini UI'dan tetikle — deleted_at
      // protect_lead_privileged_columns trigger'ı gereği yalnızca bu RPC
      // (veya pv_admin) üzerinden set edilebiliyor.
      await loginAs(page, adminEmail!, adminPassword!);
      await page.goto(`/leads/${leadId}`);
      await page.getByRole("button", { name: "Lead'i Sil" }).click();
      await page.fill('textarea[name="reason"]', "E2E soft-delete-leak testi");
      await page.getByRole("button", { name: "Evet, sil" }).click();
      await page.waitForURL(/\/leads$/, { timeout: 10_000 });

      await partnerPage.reload();
      await expect(partnerPage.getByText(customerName)).toHaveCount(0);
      await partnerContext.close();
    } finally {
      await deleteLead(leadId);
    }
  });
});
