import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { createPartnerViaUi } from "./helpers/actions";
import { deletePartner, hasCleanupCredentials } from "./helpers/cleanup";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("partner puanı ve durumu (set_partner_rating / set_partner_status RPC)", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local'e bakınız",
  );

  test("admin puanı ve durumu değiştirebilir, sayfa yenilenince kalıcı olur", async ({ page }) => {
    const name = `E2E-${Date.now()}`;
    let partnerId: string | null = null;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      partnerId = await createPartnerViaUi(page, name);

      await page.getByTestId("partner-rating-input").fill("4.2");
      await page.getByTestId("partner-rating-save").click();
      // Buton metni "Kaydediliyor…"dan "Kaydet"e dönene kadar bekle — bu, server
      // action'ın gerçekten tamamlandığının kanıtı (select/input'un DOM değeri
      // kullanıcı etkileşimiyle anında değişir, sunucu yanıtını beklemez).
      await expect(page.getByTestId("partner-rating-save")).toHaveText("Kaydet", { timeout: 10_000 });

      await page.getByTestId("partner-status-select").selectOption("suspended");
      await page.getByTestId("partner-status-save").click();
      await expect(page.getByTestId("partner-status-save")).toHaveText("Kaydet", { timeout: 10_000 });

      await page.reload();
      await expect(page.getByTestId("partner-rating-input")).toHaveValue("4.2");
      await expect(page.getByTestId("partner-status-select")).toHaveValue("suspended");
    } finally {
      if (partnerId) await deletePartner(partnerId);
    }
  });
});
