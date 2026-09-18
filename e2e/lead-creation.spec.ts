import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createLeadViaUi } from "./helpers/actions";
import {
  deleteLead,
  findLeadIdByCustomerName,
  getLeadQualificationForTest,
  hasCleanupCredentials,
} from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

const { email: TEST_EMAIL, password: TEST_PASSWORD } = getCredentials("admin");

test.describe("lead oluşturma (create_lead RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("formu doldurup gönderince lead havuzunda görünür", async ({ page }) => {
    // Dokuzuncu tur inceleme: yalnızca Date.now() bazlı isim, iki paralel
    // worker'ın testi aynı milisaniyede başlatması durumunda
    // findLeadIdByCustomerName'in .maybeSingle()'ını "birden fazla satır"
    // hatasıyla çökertebiliyordu (ve bu hata finally'nin İÇİNDE oluşursa
    // lead hiç silinmeden sızabiliyordu). Rastgele bir sufiks eklendi.
    const customerName = `E2E-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      await createLeadViaUi(page, customerName);

      await expect(page.getByText(customerName)).toBeVisible();
    } finally {
      const leadId = await findLeadIdByCustomerName(customerName);
      if (leadId) await deleteLead(leadId);
    }
  });
});

test.describe("aynı telefonla ikinci lead (find_duplicate_leads_by_phone RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("aynı telefonla ikinci lead denenince uyarı gösterir, 'yine de oluştur' ile devam edilebilir", async ({ page }) => {
    const phone = `05${Date.now().toString().slice(-9)}`;
    const name1 = `E2E Dup A ${Date.now()}`;
    const name2 = `E2E Dup B ${Date.now()}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      await createLeadViaUi(page, name1, phone);

      // İkinci lead aynı telefonla — create_lead'e hiç gitmeden önce
      // find_duplicate_leads_by_phone eşleşme buluyor, form redirect etmiyor.
      await page.goto("/first-call/new-lead");
      await page.fill('input[name="customerName"]', name2);
      await page.fill('input[name="phone"]', phone);
      await page.fill('input[name="city"]', "İstanbul");
      await page.locator("select").filter({ has: page.locator('option[value="inbound_call"]') }).selectOption("inbound_call");
      await page.getByRole("button", { name: "Lead Oluştur" }).click();

      await expect(page.getByText(/zaten kayıtlı 1 lead bulundu/)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(name1)).toBeVisible();

      await page.getByRole("button", { name: "Yine de yeni lead oluştur" }).click();
      await page.waitForURL(/\/first-call\/lead-pool/, { timeout: 15_000 });
      await expect(page.getByText(name2)).toBeVisible();
    } finally {
      const [id1, id2] = await Promise.all([
        findLeadIdByCustomerName(name1),
        findLeadIdByCustomerName(name2),
      ]);
      await Promise.all([id1, id2].filter(Boolean).map((id) => deleteLead(id!)));
    }
  });

  // Dördüncü tur inceleme: "Görüşme Detayları" alanları kontrolsüzdü — React,
  // action tamamlandığında (duplicate uyarısı dönse bile) formu otomatik
  // resetliyor, girilen nitelendirme verisi "Yine de yeni lead oluştur"a
  // basılmadan ÖNCE sessizce kayboluyordu. Bu test, doldurulan Bina Tipi/
  // Genel Not'un duplicate uyarısından SONRA da hayatta kaldığını doğruluyor.
  test("duplicate uyarısından sonra 'Görüşme Detayları'na girilen veri kaybolmaz", async ({ page }) => {
    const phone = `05${Date.now().toString().slice(-9)}`;
    const name1 = `E2E Dup Qual A ${Date.now()}`;
    const name2 = `E2E Dup Qual B ${Date.now()}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      await createLeadViaUi(page, name1, phone);

      await page.goto("/first-call/new-lead");
      await page.fill('input[name="customerName"]', name2);
      await page.fill('input[name="phone"]', phone);
      await page.fill('input[name="city"]', "İstanbul");
      await page.locator("select").filter({ has: page.locator('option[value="inbound_call"]') }).selectOption("inbound_call");

      await page.getByRole("button", { name: "Nitelendirme Ekle" }).click();
      await page.fill('input[name="buildingType"]', "Müstakil Ev");
      await page.fill('textarea[name="generalNotes"]', "E2E nitelendirme kaybı testi");

      await page.getByRole("button", { name: "Lead Oluştur" }).click();
      await expect(page.getByText(/zaten kayıtlı 1 lead bulundu/)).toBeVisible({ timeout: 10_000 });

      // Bug varsa bu noktada alanlar zaten boşalmış olurdu — "Yine de yeni
      // lead oluştur" gönderdiğinde sunucuya boş nitelendirme verisi gider.
      await page.getByRole("button", { name: "Yine de yeni lead oluştur" }).click();
      await page.waitForURL(/\/first-call\/lead-pool/, { timeout: 15_000 });

      const leadId = await findLeadIdByCustomerName(name2);
      expect(leadId).not.toBeNull();
      const qualification = await getLeadQualificationForTest(leadId!);
      expect(qualification?.buildingType).toBe("Müstakil Ev");
      expect(qualification?.generalNotes).toBe("E2E nitelendirme kaybı testi");
    } finally {
      const [id1, id2] = await Promise.all([
        findLeadIdByCustomerName(name1),
        findLeadIdByCustomerName(name2),
      ]);
      await Promise.all([id1, id2].filter(Boolean).map((id) => deleteLead(id!)));
    }
  });
});
