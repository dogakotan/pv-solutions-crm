import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createTestLead, deleteLead, findUserIdByEmail, hasCleanupCredentials } from "./helpers/cleanup";

// İkinci tur inceleme: global_search RPC'sinin (header'daki arama kutusu)
// hiç e2e kapsamı yoktu.
test.describe("Genel arama (global_search RPC)", () => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("bir lead'i isimle arayıp sonuca tıklayınca detay sayfasına gidilir", async ({ page }) => {
    const adminId = await findUserIdByEmail(email!);
    expect(adminId).not.toBeNull();

    const customerName = `E2E Search Test ${Date.now()}`;
    const leadId = await createTestLead({ customerName, ownerId: adminId! });

    try {
      await loginAs(page, email!, password!);
      await page.goto("/leads");

      await page.getByPlaceholder("Lead, partner, teklif ara...").fill(customerName);
      const resultLink = page.getByRole("link", { name: new RegExp(customerName) });
      await expect(resultLink).toBeVisible({ timeout: 10_000 });
      await resultLink.click();

      await page.waitForURL(`**/leads/${leadId}`);
    } finally {
      await deleteLead(leadId);
    }
  });
});
