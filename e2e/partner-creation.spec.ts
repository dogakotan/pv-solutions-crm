import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createPartnerViaUi } from "./helpers/actions";
import { deletePartner, hasCleanupCredentials } from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

const { email: TEST_EMAIL, password: TEST_PASSWORD } = getCredentials("admin");

test.describe("partner oluşturma (create_partner RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("formu doldurup gönderince partner detay sayfasına yönlenir", async ({ page }) => {
    const name = `E2E-${Date.now()}`;
    let partnerId: string | null = null;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      partnerId = await createPartnerViaUi(page, name);

      // getByText(name) Next.js'in kendi route-announcer (erişilebilirlik)
      // div'ini de eşleştiriyor — başlığa (h1) daraltmak gerekiyor.
      await expect(page.getByRole("heading", { name })).toBeVisible();
    } finally {
      if (partnerId) await deletePartner(partnerId);
    }
  });
});
