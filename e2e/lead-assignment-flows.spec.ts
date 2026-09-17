import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  findLeadIdByExternalRef,
  findLeadIdByCustomerName,
  findUserIdByEmail,
  createTestLead,
  deleteLead,
  hasCleanupCredentials,
  setLeadScoreForTest,
} from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

test.describe("Lead Havuzu — sahiplenme (claim_lead RPC)", () => {
  const { email, password } = getCredentials("first_call");
  const webhookKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;

  test.skip(!email || !password, "FIRST_CALL_TEST_EMAIL / FIRST_CALL_TEST_PASSWORD tanımlı değil");
  test.skip(!webhookKey, "GOOGLE_ADS_WEBHOOK_KEY tanımlı değil — sahiplenilmemiş test lead'i oluşturulamaz");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("first_call kullanıcısı havuzdaki sahiplenilmemiş bir lead'i 'Bana Ata' ile sahiplenebilir", async ({
    page,
    request,
  }) => {
    // Webhook'un kendisi bu senaryonun tek gerçekçi kaynağı: normal
    // create_lead RPC'si first_call_user_id'yi her zaman auth.uid() yapar,
    // sahiplenilmemiş (first_call_user_id null) bir lead sadece webhook
    // akışıyla oluşur.
    const externalRef = `e2e-claim-${Date.now()}`;
    const customerName = `E2E Claim Test ${Date.now()}`;
    const setupRes = await request.post("/api/webhooks/google-leads", {
      data: {
        lead_id: externalRef,
        google_key: webhookKey,
        is_test: false,
        user_column_data: [
          { column_id: "FULL_NAME", string_value: customerName },
          { column_id: "PHONE_NUMBER", string_value: `05${Date.now().toString().slice(-9)}` },
        ],
      },
    });
    expect(setupRes.status()).toBe(200);
    const leadId = await findLeadIdByExternalRef(externalRef);
    expect(leadId).not.toBeNull();

    try {
      await loginAs(page, email!, password!);
      await page.goto("/first-call/lead-pool");
      await page.getByPlaceholder("Müşteri, lead no veya şehir ara...").fill(customerName);

      const row = page.locator("tbody tr").filter({ hasText: customerName });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Bana Ata" }).click();

      // Sahiplenildikten sonra "Bana Ata" butonu kaybolmalı.
      await expect(row.getByRole("button", { name: "Bana Ata" })).toHaveCount(0, { timeout: 10_000 });
    } finally {
      if (leadId) await deleteLead(leadId);
    }
  });
});

test.describe("Satışa toplu atama (assignManyToSales)", () => {
  const { email, password } = getCredentials("first_call");

  test.skip(!email || !password, "FIRST_CALL_TEST_EMAIL / FIRST_CALL_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("iki lead seçip toplu olarak bir satış çalışanına atanabilir", async ({ page }) => {
    const suffix = Date.now();
    const name1 = `E2E Bulk A ${suffix}`;
    const name2 = `E2E Bulk B ${suffix}`;
    const createdLeadIds: string[] = [];

    await loginAs(page, email!, password!);

    for (const name of [name1, name2]) {
      await page.goto("/first-call/new-lead");
      await page.fill('input[name="customerName"]', name);
      await page.fill('input[name="phone"]', `05${Date.now().toString().slice(-9)}`);
      await page.fill('input[name="city"]', "İstanbul");
      await page
        .locator("select")
        .filter({ has: page.locator('option[value="inbound_call"]') })
        .selectOption("inbound_call");
      await page.getByRole("button", { name: "Lead Oluştur" }).click();
      await page.waitForURL(/\/first-call\/lead-pool/, { timeout: 15_000 });

      // getLeadsNeedingSalesAssignment artık yalnızca nitelendirilmiş
      // (lead_score dolu) lead'leri gösteriyor — bu test toplu atama UI'ını
      // hedeflediği için nitelendirme formunu doldurmak yerine doğrudan
      // set ediliyor.
      const id = await findLeadIdByCustomerName(name);
      if (id) await setLeadScoreForTest(id, "warm");
    }

    try {
      await page.goto("/first-call/assignments");

      const row1 = page.locator("tbody tr").filter({ hasText: name1 });
      const row2 = page.locator("tbody tr").filter({ hasText: name2 });
      await expect(row1).toBeVisible();
      await expect(row2).toBeVisible();

      await row1.getByRole("checkbox").check();
      await row2.getByRole("checkbox").check();

      await expect(page.getByText("2 seçili")).toBeVisible();

      // Bulk-atama select'i DOM'da tablodan önce (üstteki eylem çubuğunda)
      // render ediliyor — satır bazlı select'lerin aynı placeholder metnini
      // taşıdığı için .first() ile ayırt ediliyor.
      const bulkSelect = page.locator("select").filter({ hasText: "Satış çalışanı seç" }).first();
      const salesOptionValue = await bulkSelect.locator("option").nth(1).getAttribute("value");
      await bulkSelect.selectOption(salesOptionValue!);

      await page.getByRole("button", { name: "Seçilenleri Ata" }).click();

      // Atama başarılı olunca kuyruktan (sales_user_id artık dolu) düşerler.
      await expect(page.locator("tbody tr").filter({ hasText: name1 })).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator("tbody tr").filter({ hasText: name2 })).toHaveCount(0, { timeout: 10_000 });
    } finally {
      for (const name of [name1, name2]) {
        const id = await findLeadIdByCustomerName(name);
        if (id) createdLeadIds.push(id);
      }
      await Promise.all(createdLeadIds.map((id) => deleteLead(id)));
    }
  });

  // Açık madde çözümü: assignManyToSales önceden N ayrı assign_lead_to_sales
  // çağrısı yapıyordu (Promise.all) — kısmi başarısızlıkta zaten uygulanmış
  // atamalar geri alınmıyordu. Artık tek bir atomik batch RPC'ye (
  // assign_leads_to_sales_batch) taşındı. Bu test, seçilen iki lead'den biri
  // gönderilmeden hemen önce (eşzamanlı bir işlemle) silinirse, HÂLÂ VAR OLAN
  // geçerli lead'in de atanmamış kaldığını doğruluyor — eski N-ayrı-çağrı
  // davranışında bu geçerli lead zaten atanmış olurdu.
  test("seçilenlerden biri gönderilmeden hemen önce silinirse toplu atama atomik olarak geri alınır", async ({
    page,
  }) => {
    const suffix = Date.now();
    const name1 = `E2E Bulk Atomic A ${suffix}`;
    const name2 = `E2E Bulk Atomic B ${suffix}`;

    await loginAs(page, email!, password!);

    const leadIds: string[] = [];
    for (const name of [name1, name2]) {
      await page.goto("/first-call/new-lead");
      await page.fill('input[name="customerName"]', name);
      await page.fill('input[name="phone"]', `05${Date.now().toString().slice(-9)}`);
      await page.fill('input[name="city"]', "İstanbul");
      await page
        .locator("select")
        .filter({ has: page.locator('option[value="inbound_call"]') })
        .selectOption("inbound_call");
      await page.getByRole("button", { name: "Lead Oluştur" }).click();
      await page.waitForURL(/\/first-call\/lead-pool/, { timeout: 15_000 });
      const id = await findLeadIdByCustomerName(name);
      expect(id).not.toBeNull();
      await setLeadScoreForTest(id!, "warm");
      leadIds.push(id!);
    }

    try {
      await page.goto("/first-call/assignments");

      const row1 = page.locator("tbody tr").filter({ hasText: name1 });
      const row2 = page.locator("tbody tr").filter({ hasText: name2 });
      await expect(row1).toBeVisible();
      await expect(row2).toBeVisible();

      await row1.getByRole("checkbox").check();
      await row2.getByRole("checkbox").check();
      await expect(page.getByText("2 seçili")).toBeVisible();

      const bulkSelect = page.locator("select").filter({ hasText: "Satış çalışanı seç" }).first();
      const salesOptionValue = await bulkSelect.locator("option").nth(1).getAttribute("value");
      await bulkSelect.selectOption(salesOptionValue!);

      // Gönderilmeden hemen önce ikinci lead'i eşzamanlı bir silme işlemiyle simüle et.
      await deleteLead(leadIds[1]);

      await page.getByRole("button", { name: "Seçilenleri Ata" }).click();

      await expect(page.getByText(/Toplu atama başarısız/)).toBeVisible({ timeout: 10_000 });

      // Hâlâ var olan geçerli lead (name1) ATANMAMIŞ olarak kuyrukta kalmalı.
      await page.reload();
      await expect(page.locator("tbody tr").filter({ hasText: name1 })).toBeVisible();
    } finally {
      const id1 = await findLeadIdByCustomerName(name1);
      if (id1) await deleteLead(id1);
    }
  });

  // Dördüncü tur inceleme: getLeadsNeedingSalesAssignment lead_score
  // filtresi taşımıyordu — hiç nitelendirilmemiş (aranmamış) bir lead de
  // satışa atama kuyruğunda görünüyor, first_call'ın nitelendirme
  // adımını atlayıp doğrudan satışa devretmesine izin veriyordu.
  test("nitelendirilmemiş (lead_score boş) bir lead satışa atama kuyruğunda görünmez", async ({ page }) => {
    const customerName = `E2E Unqualified ${Date.now()}`;

    await loginAs(page, email!, password!);
    await page.goto("/first-call/new-lead");
    await page.fill('input[name="customerName"]', customerName);
    await page.fill('input[name="phone"]', `05${Date.now().toString().slice(-9)}`);
    await page.fill('input[name="city"]', "İstanbul");
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="inbound_call"]') })
      .selectOption("inbound_call");
    await page.getByRole("button", { name: "Lead Oluştur" }).click();
    await page.waitForURL(/\/first-call\/lead-pool/, { timeout: 15_000 });

    try {
      await page.goto("/first-call/assignments");
      await expect(page.locator("tbody tr").filter({ hasText: customerName })).toHaveCount(0);
    } finally {
      const id = await findLeadIdByCustomerName(customerName);
      if (id) await deleteLead(id);
    }
  });
});

// İkinci tur inceleme: assignManyToSales'in e2e testi vardı ama partner
// muadili assignManyToPartner'ın hiç yoktu — LeadAssignmentQueue'nun
// bulkAssignAction'ı iki akış için de aynı bileşen olsa da, gerçek
// çalıştığı ayrı bir RPC/server action ve doğrulanmamış kalıyordu.
test.describe("Partnere toplu atama (assignManyToPartner)", () => {
  const { email, password } = getCredentials("admin");

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("iki lead seçip toplu olarak bir partnere atanabilir", async ({ page }) => {
    const adminId = await findUserIdByEmail(email!);
    expect(adminId).not.toBeNull();

    const suffix = Date.now();
    const name1 = `E2E Partner Bulk A ${suffix}`;
    const name2 = `E2E Partner Bulk B ${suffix}`;
    const leadIds = await Promise.all(
      [name1, name2].map((name) =>
        createTestLead({ customerName: name, ownerId: adminId!, salesUserId: adminId!, stage: "referred" })
      )
    );

    try {
      await loginAs(page, email!, password!);
      await page.goto("/admin/assignments");

      const section = page.locator("section", { hasText: "Partnere Atama Bekleyen Leadler" });
      const row1 = section.locator("tbody tr").filter({ hasText: name1 });
      const row2 = section.locator("tbody tr").filter({ hasText: name2 });
      await expect(row1).toBeVisible();
      await expect(row2).toBeVisible();

      await row1.getByRole("checkbox").check();
      await row2.getByRole("checkbox").check();
      await expect(section.getByText("2 seçili")).toBeVisible();

      const bulkSelect = section.locator("select").filter({ hasText: "Partner seç" }).first();
      const partnerOptionValue = await bulkSelect.locator("option").nth(1).getAttribute("value");
      await bulkSelect.selectOption(partnerOptionValue!);

      await section.getByRole("button", { name: "Seçilenleri Ata" }).click();

      // Atama başarılı olunca kuyruktan (artık aktif bir referral'ı olduğu için) düşerler.
      await expect(section.locator("tbody tr").filter({ hasText: name1 })).toHaveCount(0, { timeout: 10_000 });
      await expect(section.locator("tbody tr").filter({ hasText: name2 })).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await Promise.all(leadIds.map((id) => deleteLead(id)));
    }
  });

  // Açık madde çözümü: assignManyToPartner de assignManyToSales ile aynı
  // atomiklik sorununu taşıyordu (bkz. yukarıdaki sales muadili). Aynı
  // senaryo burada partner batch RPC'si (assign_leads_to_partner_batch) için.
  test("seçilenlerden biri gönderilmeden hemen önce silinirse partnere toplu atama atomik olarak geri alınır", async ({
    page,
  }) => {
    const adminId = await findUserIdByEmail(email!);
    expect(adminId).not.toBeNull();

    const suffix = Date.now();
    const name1 = `E2E Partner Bulk Atomic A ${suffix}`;
    const name2 = `E2E Partner Bulk Atomic B ${suffix}`;
    const leadIds = await Promise.all(
      [name1, name2].map((name) =>
        createTestLead({ customerName: name, ownerId: adminId!, salesUserId: adminId!, stage: "referred" })
      )
    );

    try {
      await loginAs(page, email!, password!);
      await page.goto("/admin/assignments");

      const section = page.locator("section", { hasText: "Partnere Atama Bekleyen Leadler" });
      const row1 = section.locator("tbody tr").filter({ hasText: name1 });
      const row2 = section.locator("tbody tr").filter({ hasText: name2 });
      await expect(row1).toBeVisible();
      await expect(row2).toBeVisible();

      await row1.getByRole("checkbox").check();
      await row2.getByRole("checkbox").check();
      await expect(section.getByText("2 seçili")).toBeVisible();

      const bulkSelect = section.locator("select").filter({ hasText: "Partner seç" }).first();
      const partnerOptionValue = await bulkSelect.locator("option").nth(1).getAttribute("value");
      await bulkSelect.selectOption(partnerOptionValue!);

      // Gönderilmeden hemen önce ikinci lead'i eşzamanlı bir silme işlemiyle simüle et.
      await deleteLead(leadIds[1]);

      await section.getByRole("button", { name: "Seçilenleri Ata" }).click();

      await expect(section.getByText(/Toplu atama başarısız/)).toBeVisible({ timeout: 10_000 });

      // Hâlâ var olan geçerli lead (name1) için referral OLUŞMAMIŞ olarak kuyrukta kalmalı.
      await page.reload();
      await expect(
        page.locator("section", { hasText: "Partnere Atama Bekleyen Leadler" }).locator("tbody tr").filter({ hasText: name1 })
      ).toBeVisible();
    } finally {
      const id1 = await findLeadIdByCustomerName(name1);
      if (id1) await deleteLead(id1);
    }
  });
});

test.describe("Partnere tekli atama (assign_lead_to_partner RPC)", () => {
  const { email, password } = getCredentials("admin");

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("admin, kuyruktaki bir lead'i partnere atayabilir", async ({ page }) => {
    // get_leads_needing_partner_assignment yalnızca sales_user_id'nin dolu
    // olmasını arıyor, belirli bir role bağlı değil — SALES_TEST_EMAIL CI'da
    // henüz tanımlı değil (bkz. diğer testlerdeki skip'ler), admin'in kendi
    // id'si burada aynı işi görüyor.
    const adminId = await findUserIdByEmail(email!);
    expect(adminId).not.toBeNull();

    const customerName = `E2E Partner Assign ${Date.now()}`;
    const leadId = await createTestLead({
      customerName,
      ownerId: adminId!,
      salesUserId: adminId!,
      stage: "referred",
    });

    try {
      await loginAs(page, email!, password!);
      await page.goto("/admin/assignments");

      const section = page.locator("section", { hasText: "Partnere Atama Bekleyen Leadler" });
      const row = section.locator("tbody tr").filter({ hasText: customerName });
      await expect(row).toBeVisible();

      await row.locator("select").selectOption({ label: "Test Partner A" });
      await row.getByRole("button", { name: "Ata" }).click();

      // Atama başarılı olunca kuyruktan (artık aktif bir referral'ı olduğu için) düşer.
      await expect(section.locator("tbody tr").filter({ hasText: customerName })).toHaveCount(0, {
        timeout: 10_000,
      });
    } finally {
      await deleteLead(leadId);
    }
  });
});
