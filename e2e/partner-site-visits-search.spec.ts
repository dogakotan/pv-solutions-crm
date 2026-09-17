import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  createTestLead,
  createTestReferral,
  deleteLead,
  findPartnerIdByEmail,
  findUserIdByEmail,
  hasCleanupCredentials,
} from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

const { email: ADMIN_EMAIL } = getCredentials("admin");
const { email: PARTNER_EMAIL, password: PARTNER_PASSWORD } = getCredentials("partner_admin");

// Beşinci tur, önceden bilinçli atlanmış madde: LeadsTable/ReferralsTable/
// UsersTable'ın aksine, Keşif Ziyaretleri sayfasında hiç istemci-taraflı
// arama yoktu — liste büyüdükçe belirli bir ziyareti bulmak yalnızca elle
// taramayla mümkündü.
test.describe("Keşif Ziyaretleri sayfasında arama", () => {
  test.skip(
    !ADMIN_EMAIL || !PARTNER_EMAIL || !PARTNER_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / PARTNER_ADMIN_TEST_EMAIL / PARTNER_ADMIN_TEST_PASSWORD tanımlı değil"
  );

  test("arama kutusu, eşleşmeyen ziyaretleri gizler", async ({ page }) => {
    const adminId = await findUserIdByEmail(ADMIN_EMAIL!);
    const partnerId = await findPartnerIdByEmail(PARTNER_EMAIL!);
    expect(adminId).not.toBeNull();
    expect(partnerId).not.toBeNull();

    const ts = Date.now();
    const nameA = `E2E SiteVisit Alfa ${ts}`;
    const nameB = `E2E SiteVisit Beta ${ts}`;
    const leadIdA = await createTestLead({ customerName: nameA, ownerId: adminId!, stage: "survey_scheduled" });
    const leadIdB = await createTestLead({ customerName: nameB, ownerId: adminId!, stage: "survey_scheduled" });
    await createTestReferral({ leadId: leadIdA, partnerId: partnerId!, referredBy: adminId! });
    await createTestReferral({ leadId: leadIdB, partnerId: partnerId!, referredBy: adminId! });

    try {
      await loginAs(page, PARTNER_EMAIL!, PARTNER_PASSWORD!);
      await page.goto("/partner/site-visits");

      await expect(page.getByText(nameA)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(nameB)).toBeVisible();

      await page.getByPlaceholder("Müşteri, lead no, telefon veya adres ara...").fill("Alfa");
      await expect(page.getByText(nameA)).toBeVisible();
      await expect(page.getByText(nameB)).toHaveCount(0);
    } finally {
      await deleteLead(leadIdA);
      await deleteLead(leadIdB);
    }
  });
});
