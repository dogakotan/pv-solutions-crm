import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createLeadViaUi } from "./helpers/actions";
import { deleteLead, findLeadIdByCustomerName, hasCleanupCredentials } from "./helpers/cleanup";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("lead oluşturma (create_lead RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("formu doldurup gönderince lead havuzunda görünür", async ({ page }) => {
    const customerName = `E2E-${Date.now()}`;

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
