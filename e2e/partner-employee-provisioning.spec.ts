import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createPartnerViaUi } from "./helpers/actions";
import {
  deletePartner,
  deleteTestUser,
  findUserIdByEmail,
  hasCleanupCredentials,
} from "./helpers/cleanup";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("partner çalışanı ekleme (provision_partner_employee RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("çalışan hesabı oluşturulunca geçici şifre gösterilir", async ({ page }) => {
    const ts = Date.now();
    const partnerName = `E2E-${ts}`;
    const employeeEmail = `e2e-employee-${ts}@example.com`;
    let partnerId: string | null = null;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);

      // Çalışanın bağlanacağı atılabilir partner
      partnerId = await createPartnerViaUi(page, partnerName);

      await page.goto(`/partners/${partnerId}?tab=employees`);
      await page.getByRole("button", { name: "+ Çalışan Ekle" }).click();
      await page.fill('input[name="fullName"]', "E2E Test Çalışanı");
      await page.fill('input[name="email"]', employeeEmail);
      await page.getByRole("button", { name: "Hesap Oluştur" }).click();

      await expect(page.getByText("Hesap oluşturuldu:")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Geçici şifre:")).toBeVisible();
    } finally {
      const userId = await findUserIdByEmail(employeeEmail);
      if (userId) await deleteTestUser(userId);
      if (partnerId) await deletePartner(partnerId);
    }
  });
});
