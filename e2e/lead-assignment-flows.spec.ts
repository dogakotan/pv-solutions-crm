import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  findLeadIdByExternalRef,
  findLeadIdByCustomerName,
  deleteLead,
  hasCleanupCredentials,
} from "./helpers/cleanup";

test.describe("Lead Havuzu — sahiplenme (claim_lead RPC)", () => {
  const email = process.env.FIRST_CALL_TEST_EMAIL;
  const password = process.env.FIRST_CALL_TEST_PASSWORD;
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
        user_column_data: [{ column_id: "FULL_NAME", string_value: customerName }],
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
  const email = process.env.FIRST_CALL_TEST_EMAIL;
  const password = process.env.FIRST_CALL_TEST_PASSWORD;

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
});
