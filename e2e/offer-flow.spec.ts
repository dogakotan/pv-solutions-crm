import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createLeadViaUi } from "./helpers/actions";
import {
  createTestReferral,
  deleteLead,
  findLeadIdByCustomerName,
  findOfferIdByLeadId,
  findUserIdByEmail,
  findPartnerIdByEmail,
  getOfferStatus,
  hasCleanupCredentials,
} from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

const { email: TEST_EMAIL, password: TEST_PASSWORD } = getCredentials("admin");
const { email: PARTNER_ADMIN_TEST_EMAIL, password: PARTNER_ADMIN_TEST_PASSWORD } = getCredentials("partner_admin");
const { email: PARTNER_EMPLOYEE_TEST_EMAIL, password: PARTNER_EMPLOYEE_TEST_PASSWORD } = getCredentials("partner_employee");

test.describe("teklif gönderme ve revize etme (create_offer / revise_offer RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !PARTNER_ADMIN_TEST_EMAIL || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / PARTNER_ADMIN_TEST_EMAIL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("teklif gönderilir, revize edilince eski revizyon 'Eski Revizyon' olur", async ({ page }) => {
    const customerName = `E2E-${Date.now()}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);

      // Teklifin bağlanacağı atılabilir lead — create_offer artık aktif bir
      // partner referral'ı zorunlu tuttuğu için (require_referral_for_offers
      // migration'ı) lead'i doğrudan bir partnere referral ediyoruz.
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

      // delete_offer_version RPC — sadece "accepted" olmayan revizyonlar
      // silinebilir; Rev.1 şu an "open" durumda, Rev.1'in satırını açıp Sil'i tıkla.
      await page.getByRole("button", { name: /Rev\.1/ }).click();
      await page.getByRole("button", { name: "Sil", exact: true }).click();
      await expect(page.getByRole("button", { name: /Rev\.1/ })).toHaveCount(0, { timeout: 10_000 });
    } finally {
      const leadId = await findLeadIdByCustomerName(customerName);
      if (leadId) await deleteLead(leadId);
    }
  });
});

test.describe("teklif kabul/red (respond_to_offer RPC)", () => {
  test.skip(
    !TEST_EMAIL ||
      !TEST_PASSWORD ||
      !PARTNER_ADMIN_TEST_EMAIL ||
      !PARTNER_ADMIN_TEST_PASSWORD ||
      !PARTNER_EMPLOYEE_TEST_EMAIL ||
      !PARTNER_EMPLOYEE_TEST_PASSWORD ||
      !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / PARTNER_ADMIN_TEST_EMAIL / PARTNER_EMPLOYEE_TEST_EMAIL kimlik bilgileri tanımlı değil — .env.local'e bakınız",
  );

  // NOT: aynı page/context üzerinde üç farklı hesapla art arda loginAs
  // çağırmak, bilinen ve hâlâ çözülmemiş bir stale-redirect-cache bug'ını
  // tetikliyor (bkz. proje belleği "Cache Components App Shell stale
  // refresh" — router.refresh()/revalidatePath+redirect bazen önceki
  // oturumun cache'lenmiş yönlendirmesini gösteriyor). Codebase'teki her
  // çok-rollü test zaten ayrı test() bloğu (dolayısıyla ayrı page fixture'ı)
  // kullanıyor — burada da rol geçişi başına ayrı bir browser context açılıyor.
  test("partner_admin gönderilmiş bir teklifi kabul edebilir, partner_employee edemez", async ({ page, browser }) => {
    const customerName = `E2E-Respond-${Date.now()}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      await createLeadViaUi(page, customerName);
      const leadId = await findLeadIdByCustomerName(customerName);
      expect(leadId).toBeTruthy();

      const [adminId, partnerId, employeeId] = await Promise.all([
        findUserIdByEmail(TEST_EMAIL!),
        findPartnerIdByEmail(PARTNER_ADMIN_TEST_EMAIL!),
        findUserIdByEmail(PARTNER_EMPLOYEE_TEST_EMAIL!),
      ]);
      expect(adminId).not.toBeNull();
      expect(partnerId).not.toBeNull();
      expect(employeeId).not.toBeNull();
      // assigned_employee_id kasıtlı olarak set ediliyor — aksi halde
      // partner_employee bu referral'ı (offers_select RLS'i gereği) hiç
      // göremez ve test, var olmayan bir butonu tıklamaya çalışıp zaman
      // aşımına uğrar. Amaç employee'nin teklifi GÖREBİLDİĞİNİ ama
      // yanıtlayamadığını doğrulamak — hiç görememesini değil.
      await createTestReferral({
        leadId: leadId!,
        partnerId: partnerId!,
        referredBy: adminId!,
        assignedEmployeeId: employeeId!,
      });

      await page.goto(`/leads/${leadId}`);
      await page.getByRole("button", { name: "Teklif Gönder" }).click();
      await page.fill('input[name="amount"]', "10000");
      await page.getByRole("button", { name: "Teklifi Gönder" }).click();
      await expect(page.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });

      const offerId = await findOfferIdByLeadId(leadId!);
      expect(offerId).toBeTruthy();

      // partner_employee'nin Kabul Et/Reddet butonlarını hiç görmemesi
      // gerekiyor — offers_update RLS/respond_to_offer RPC'nin bilinçli
      // olarak yalnızca partner_admin'e izin verme kuralı burada UI
      // seviyesinde de yansıtılıyor.
      const employeeContext = await browser.newContext();
      const employeePage = await employeeContext.newPage();
      await loginAs(employeePage, PARTNER_EMPLOYEE_TEST_EMAIL!, PARTNER_EMPLOYEE_TEST_PASSWORD!);
      await employeePage.goto(`/offers/${offerId}`);
      await employeePage.getByRole("button", { name: /Rev\.0/ }).click();
      await expect(employeePage.getByRole("button", { name: "Kabul Et" })).toHaveCount(0);
      await expect(employeePage.getByRole("button", { name: "Reddet" })).toHaveCount(0);
      // İkinci tur inceleme: canDelete daha önce role bakmaksızın hep true'ydu
      // — partnerler (ne employee ne admin) "Sil" butonunu hiç görmemeli,
      // delete_offer_version RPC'si zaten yalnızca pv_admin/oluşturan sales'e
      // izin veriyor.
      await expect(employeePage.getByRole("button", { name: "Sil", exact: true })).toHaveCount(0);
      await employeeContext.close();

      const adminPartnerContext = await browser.newContext();
      const adminPartnerPage = await adminPartnerContext.newPage();
      await loginAs(adminPartnerPage, PARTNER_ADMIN_TEST_EMAIL!, PARTNER_ADMIN_TEST_PASSWORD!);
      await adminPartnerPage.goto(`/offers/${offerId}`);
      await adminPartnerPage.getByRole("button", { name: /Rev\.0/ }).click();
      await expect(adminPartnerPage.getByRole("button", { name: "Sil", exact: true })).toHaveCount(0);
      await adminPartnerPage.getByRole("button", { name: "Kabul Et" }).click();
      await expect(adminPartnerPage.getByRole("button", { name: /Rev\.0.*Kabul Edildi/ })).toBeVisible({
        timeout: 10_000,
      });
      await adminPartnerContext.close();
    } finally {
      const leadId = await findLeadIdByCustomerName(customerName);
      if (leadId) await deleteLead(leadId);
    }
  });

  // İkinci tur inceleme: respond_to_offer reddi offer_versions'a yazıyordu
  // ama offers.status hiç güncellemiyordu — reddedilen bir teklif
  // offers-list-filters'ın "Reddedildi" filtresinde asla eşleşmiyor,
  // offers-overview-tabs'ın "Açık" sayımında sonsuza dek yer almaya devam
  // ediyordu. Bu test UI'dan reddedip DB'de offers.status'un gerçekten
  // senkronize olduğunu doğruluyor.
  test("partner_admin bir teklifi reddedince offers.status da senkronize olur", async ({ page, browser }) => {
    const customerName = `E2E-Reject-${Date.now()}`;

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
      await page.fill('input[name="amount"]', "10000");
      await page.getByRole("button", { name: "Teklifi Gönder" }).click();
      await expect(page.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });

      const offerId = await findOfferIdByLeadId(leadId!);
      expect(offerId).toBeTruthy();
      expect(await getOfferStatus(offerId!)).toBe("open");

      const adminPartnerContext = await browser.newContext();
      const adminPartnerPage = await adminPartnerContext.newPage();
      await loginAs(adminPartnerPage, PARTNER_ADMIN_TEST_EMAIL!, PARTNER_ADMIN_TEST_PASSWORD!);
      await adminPartnerPage.goto(`/offers/${offerId}`);
      await adminPartnerPage.getByRole("button", { name: /Rev\.0/ }).click();
      await adminPartnerPage.getByRole("button", { name: "Reddet" }).click();
      await expect(adminPartnerPage.getByRole("button", { name: /Rev\.0.*Reddedildi/ })).toBeVisible({
        timeout: 10_000,
      });
      await adminPartnerContext.close();

      expect(await getOfferStatus(offerId!)).toBe("rejected");

      // Üçüncü tur inceleme: reddedilen bir teklif revize edilip yeniden
      // gönderildiğinde offers.status hâlâ 'rejected'de takılı kalıyordu —
      // yeni bir karar bekleyen teklif hâlâ "Reddedildi" gösteriliyordu.
      // page, adminPartnerPage'in reddinden önceki durumu gösteriyor olabilir
      // — reload ile güncel (rejected) durumu görmesi sağlanıyor.
      await page.reload();
      await expect(page.getByRole("button", { name: /Rev\.0.*Reddedildi/ })).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: "Revize Et" }).click();
      await page.fill('input[name="amount"]', "12000");
      await page.getByRole("button", { name: "Revizyonu Gönder" }).click();
      await expect(page.getByRole("button", { name: /Rev\.1/ })).toBeVisible({ timeout: 15_000 });

      expect(await getOfferStatus(offerId!)).toBe("open");
    } finally {
      const leadId = await findLeadIdByCustomerName(customerName);
      if (leadId) await deleteLead(leadId);
    }
  });
});
