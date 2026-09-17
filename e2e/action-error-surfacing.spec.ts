import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs } from "./helpers/auth";
import { createLeadViaUi } from "./helpers/actions";
import {
  createTestLead,
  createTestReferral,
  deleteLead,
  findLeadIdByCustomerName,
  findOfferIdByLeadId,
  findUserIdByEmail,
  findPartnerIdByEmail,
  hasCleanupCredentials,
} from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

const { email: TEST_EMAIL, password: TEST_PASSWORD } = getCredentials("admin");
const { email: PARTNER_ADMIN_TEST_EMAIL, password: PARTNER_ADMIN_TEST_PASSWORD } = getCredentials("partner_admin");

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Beşinci tur inceleme: toplu atama atomikliğini doğrularken tamamen bağımsız
// bir production bug'ı ortaya çıktı — cacheComponents: true altında, throw
// eden Server Action'lar production build'de (dev'de değil) gerçek hata
// mesajı yerine ya "Minified React error #441" ya da (native <form action>
// için) tamamen jenerik "Bir şeyler ters gitti" error.tsx fallback'ini
// gösteriyordu. Sorun LeadAssignmentQueue'ya özgü değildi — codebase'te aynı
// deseni taşıyan 14 action daha bulundu (leads/[id], partners/[id],
// notifications, first-call/lead-pool, partner/assigned-leads, admin/users).
// Hepsi throw yerine { error } dönüşüne çevrildi; native <form action> ile
// çağrılan ve önceden HİÇBİR hata gösterimi olmayan action'lar (respondToOffer,
// deleteOfferVersion, assignPartner, advanceLeadStage, softDeleteLead,
// reactivateLead, setPartnerEmployeeActive) useActionState'e taşındı.
// Bu dosya, iki temsili deseni (dialog içinde çift-action + generic tek-action
// form bileşeni) production build'e karşı doğruluyor.
test.describe("Server Action hata mesajları production'da doğru gösteriliyor", () => {
  test.skip(
    !TEST_EMAIL ||
      !TEST_PASSWORD ||
      !PARTNER_ADMIN_TEST_EMAIL ||
      !PARTNER_ADMIN_TEST_PASSWORD ||
      !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / PARTNER_ADMIN_TEST_EMAIL kimlik bilgileri tanımlı değil — .env.local'e bakınız",
  );

  test("respondToOffer (OfferVersionRow, dialog + useActionState): eşzamanlı yanıt hatası gerçek mesajı gösterir", async ({
    page,
    browser,
  }) => {
    const customerName = `E2E ActionError Offer ${Date.now()}`;

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
    await page.fill('input[name="amount"]', "10000");
    await page.getByRole("button", { name: "Teklifi Gönder" }).click();
    await expect(page.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });

    const offerId = await findOfferIdByLeadId(leadId!);
    expect(offerId).toBeTruthy();

    const partnerContext = await browser.newContext();
    const partnerPage = await partnerContext.newPage();

    try {
      await loginAs(partnerPage, PARTNER_ADMIN_TEST_EMAIL!, PARTNER_ADMIN_TEST_PASSWORD!);
      await partnerPage.goto(`/offers/${offerId}`);
      await partnerPage.getByRole("button", { name: /Rev\.0/ }).click();
      await expect(partnerPage.getByRole("button", { name: "Kabul Et" })).toBeVisible();

      // Eşzamanlı bir işlem simülasyonu: buton hâlâ "sent" durumunu
      // gösterirken, revizyonu arka planda zaten "accepted" yap.
      const { data: versionRow } = await adminClient()
        .from("offer_versions")
        .select("id")
        .eq("offer_id", offerId!)
        .eq("revision_no", 0)
        .single();
      await adminClient()
        .from("offer_versions")
        .update({ status: "accepted" })
        .eq("id", (versionRow as { id: string }).id);

      await partnerPage.getByRole("button", { name: "Kabul Et" }).click();

      await expect(partnerPage.getByText("Yalnızca gönderilmiş bir revizyon yanıtlanabilir")).toBeVisible({
        timeout: 10_000,
      });
      await expect(partnerPage.getByText("Bir şeyler ters gitti")).toHaveCount(0);
      await expect(partnerPage.getByText(/Minified React error/)).toHaveCount(0);
    } finally {
      await partnerContext.close();
    }

    await deleteLead(leadId!);
  });

  // assignPartner/reactivateLead de aynı paylaşılan ActionForm bileşenini
  // (src/components/action-form.tsx) kullanıyor — advanceLeadStage üzerinden
  // test etmek üçünün de dayandığı useActionState kablolamasını doğruluyor.
  test("advanceLeadStage (ActionForm, generic useActionState): geçersiz istek gerçek mesajı gösterir", async ({
    page,
  }) => {
    const adminId = await findUserIdByEmail(TEST_EMAIL!);
    expect(adminId).not.toBeNull();
    const customerName = `E2E ActionError Stage ${Date.now()}`;
    const leadId = await createTestLead({
      customerName,
      ownerId: adminId!,
      salesUserId: adminId!,
      stage: "contacted",
    });

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      await page.goto(`/leads/${leadId}`);

      const advanceForm = page.locator("form", { has: page.locator('input[name="currentStage"]') });
      await expect(advanceForm).toBeVisible({ timeout: 10_000 });
      // DB'ye hiç gitmeden, action'ın kendi doğrulamasını (Geçersiz istek.)
      // client-side olarak zorlamak için gizli alanı geçersiz bir değere çeker.
      await advanceForm.locator('input[name="currentStage"]').evaluate((el: HTMLInputElement) => {
        el.value = "bogus_stage";
      });
      await advanceForm.getByRole("button").click();

      await expect(page.getByText("Geçersiz istek.")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Bir şeyler ters gitti")).toHaveCount(0);
      await expect(page.getByText(/Minified React error/)).toHaveCount(0);
    } finally {
      await deleteLead(leadId);
    }
  });
});
