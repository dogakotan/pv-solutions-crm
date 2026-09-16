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

test.describe("Satış sonucu kaydetme (record_sales_outcome RPC)", () => {
  const email = process.env.SALES_TEST_EMAIL;
  const password = process.env.SALES_TEST_PASSWORD;

  test.skip(!email || !password, "SALES_TEST_EMAIL / SALES_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("sales kullanıcısı kendi lead'inde 'Kaybedildi' sonucunu kaydedebilir", async ({ page }) => {
    const salesUserId = await findUserIdByEmail(email!);
    expect(salesUserId).not.toBeNull();

    const customerName = `E2E Outcome Test ${Date.now()}`;
    const leadId = await createTestLead({
      customerName,
      ownerId: salesUserId!,
      salesUserId: salesUserId!,
    });

    try {
      await loginAs(page, email!, password!);
      await page.goto(`/leads/${leadId}`);

      await page.getByRole("button", { name: "Kaybedildi" }).click();
      await page.fill('input[name="lostReason"]', "E2E test gerekçesi");
      await page.getByRole("button", { name: "Sonucu Kaydet" }).click();

      // Form kaybolup salt-okunur özet göründüğünde bu gerekçe metni
      // sadece "Satış Sonucu" kartındaki <dd>'de yer alır — sayfanın
      // başka yerlerinde "Kaybedildi" rozetleri de olduğu için asıl
      // kanıt bu (RPC'ye geçen değerin doğru kaydedildiğini gösteren) metin.
      await expect(page.getByText("E2E test gerekçesi")).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteLead(leadId);
    }
  });

  test("sales kullanıcısı 'Kazanıldı' sonrası malzeme/ERP durumunu güncelleyebilir (update_sales_outcome_fulfillment RPC)", async ({
    page,
  }) => {
    const partnerEmail = process.env.PARTNER_ADMIN_TEST_EMAIL;
    test.skip(!partnerEmail, "PARTNER_ADMIN_TEST_EMAIL tanımlı değil (create_offer için referral gerekiyor)");

    const salesUserId = await findUserIdByEmail(email!);
    expect(salesUserId).not.toBeNull();
    const partnerId = await findPartnerIdByEmail(partnerEmail!);
    expect(partnerId).not.toBeNull();

    const customerName = `E2E Fulfillment Test ${Date.now()}`;
    const leadId = await createTestLead({
      customerName,
      ownerId: salesUserId!,
      salesUserId: salesUserId!,
    });
    await createTestReferral({ leadId, partnerId: partnerId!, referredBy: salesUserId! });

    try {
      await loginAs(page, email!, password!);
      await page.goto(`/leads/${leadId}`);

      await page.getByRole("button", { name: "Teklif Gönder" }).click();
      await page.fill('input[name="amount"]', "75000");
      await page.getByRole("button", { name: "Teklifi Gönder" }).click();
      await expect(page.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: "Kazanıldı" }).click();
      await page.fill('input[name="finalAmount"]', "75000");
      await page.getByRole("button", { name: "Sonucu Kaydet" }).click();

      // Yeni sales_outcome yazıldığında material_purchase_status hiç
      // set edilmemiş olur — özet varsayılan olarak "Beklemede" göstermeli.
      // getByText tek başına <select>'in seçili option'ıyla da eşleştiği
      // için (strict mode ihlali) özet <dd>'sine daraltmak gerekiyor.
      const materialStatusSummary = page.getByRole("definition").filter({ hasText: "Beklemede" });
      await expect(materialStatusSummary).toBeVisible({ timeout: 10_000 });

      await page.locator('select[name="materialPurchaseStatus"]').selectOption("ordered");
      await page.fill('input[name="erpOrderNumber"]', "ERP-E2E-123");
      await page.getByRole("button", { name: "Kaydet" }).click();

      await expect(page.getByRole("definition").filter({ hasText: "Sipariş Verildi" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole("definition").filter({ hasText: "ERP-E2E-123" })).toBeVisible();

      // Sayfa yenilenince değerlerin kalıcı olduğunu doğrula.
      await page.reload();
      await expect(page.getByRole("definition").filter({ hasText: "Sipariş Verildi" })).toBeVisible();
      await expect(page.getByRole("definition").filter({ hasText: "ERP-E2E-123" })).toBeVisible();
    } finally {
      await deleteLead(leadId);
    }
  });
});

test.describe("Partner yönlendirme yanıtı (respond_to_referral RPC)", () => {
  const partnerEmail = process.env.PARTNER_ADMIN_TEST_EMAIL;
  const partnerPassword = process.env.PARTNER_ADMIN_TEST_PASSWORD;
  const adminEmail = process.env.E2E_TEST_EMAIL;

  test.skip(!partnerEmail || !partnerPassword, "PARTNER_ADMIN_TEST_EMAIL / PARTNER_ADMIN_TEST_PASSWORD tanımlı değil");
  test.skip(!adminEmail, "E2E_TEST_EMAIL tanımlı değil (referred_by için)");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  async function setupPendingReferral(customerName: string) {
    const [adminId, partnerId] = await Promise.all([
      findUserIdByEmail(adminEmail!),
      findPartnerIdByEmail(partnerEmail!),
    ]);
    expect(adminId).not.toBeNull();
    expect(partnerId).not.toBeNull();

    const leadId = await createTestLead({ customerName, ownerId: adminId! });
    await createTestReferral({ leadId, partnerId: partnerId!, referredBy: adminId! });
    return leadId;
  }

  test("partner yönlendirmeyi kabul edebilir", async ({ page }) => {
    const customerName = `E2E Accept Test ${Date.now()}`;
    const leadId = await setupPendingReferral(customerName);

    try {
      await loginAs(page, partnerEmail!, partnerPassword!);
      await page.goto("/partner/assigned-leads");
      await page.getByPlaceholder("Müşteri, lead no veya şehir ara...").fill(customerName);

      const row = page.locator("tbody tr").filter({ hasText: customerName });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Kabul Et" }).click();

      await expect(row.getByText("Kabul Edildi")).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteLead(leadId);
    }
  });

  test("partner yönlendirmeyi gerekçeyle reddedebilir", async ({ page }) => {
    const customerName = `E2E Reject Test ${Date.now()}`;
    const leadId = await setupPendingReferral(customerName);

    try {
      await loginAs(page, partnerEmail!, partnerPassword!);
      await page.goto("/partner/assigned-leads");
      await page.getByPlaceholder("Müşteri, lead no veya şehir ara...").fill(customerName);

      const row = page.locator("tbody tr").filter({ hasText: customerName });
      await expect(row).toBeVisible();
      await row.getByPlaceholder("Ret gerekçesi").fill("E2E test reddi");
      await row.getByRole("button", { name: "Reddet" }).click();

      await expect(row.getByText("Reddedildi")).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteLead(leadId);
    }
  });
});

test.describe("Lead silme (soft_delete_lead RPC)", () => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("admin bir lead'i gerekçeyle silebilir, /leads'e yönlenir", async ({ page }) => {
    const adminId = await findUserIdByEmail(email!);
    expect(adminId).not.toBeNull();

    const customerName = `E2E Delete Test ${Date.now()}`;
    const leadId = await createTestLead({ customerName, ownerId: adminId! });

    try {
      await loginAs(page, email!, password!);
      await page.goto(`/leads/${leadId}`);

      await page.getByRole("button", { name: "Lead'i Sil" }).click();
      await page.fill('textarea[name="reason"]', "E2E test silme");
      await page.getByRole("button", { name: "Evet, sil" }).click();

      await page.waitForURL(/\/leads$/, { timeout: 10_000 });
    } finally {
      await deleteLead(leadId);
    }
  });
});

test.describe("Önerilen partnerler (get_recommended_partners_for_lead RPC)", () => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("aktif referral'ı olmayan bir lead için semt/şehre uygun partnerler önerilir ve atanabilir", async ({ page }) => {
    const adminId = await findUserIdByEmail(email!);
    expect(adminId).not.toBeNull();

    // Şehir "İstanbul" — seed verisindeki birden çok aktif partner (ör.
    // "Boğaziçi Solar Sistemleri") bu şehirde, referral'sız bir lead bu
    // yüzden öneri listesinde en az bir eşleşme bulur.
    const customerName = `E2E Recommend Test ${Date.now()}`;
    const leadId = await createTestLead({ customerName, ownerId: adminId! });

    try {
      await loginAs(page, email!, password!);
      await page.goto(`/leads/${leadId}`);

      await expect(page.getByText("Partner Ataması")).toBeVisible();
      const row = page.locator("tbody tr").first();
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Ata" }).click();

      await expect(page.getByText("Partner Aktivitesi")).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteLead(leadId);
    }
  });
});
