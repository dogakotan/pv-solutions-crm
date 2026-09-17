import { createHmac } from "crypto";
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { deleteNotificationByDedupKey, hasCleanupCredentials } from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

/**
 * Meta webhook, bir leadgen_id'yi işleyemediğinde (örn. Graph API isteği
 * başarısız olduğunda) artık sessizce sadece sunucu loguna yazmıyor —
 * notify_admins_webhook_lead_failure RPC'si üzerinden aktif tüm pv_admin
 * kullanıcılarına bir bildirim düşüyor (yol haritası 5.3). Burada
 * METE_PAGE_ACCESS_TOKEN gerçek bir kimlik bilgisi olmadığı için Graph
 * API isteği zaten her zaman 401/400 ile başarısız olur — bu test o
 * gerçek (mock'lanmamış) başarısızlığı kullanıyor.
 */
test.describe("Webhook lead hatası bildirimi (notify_admins_webhook_lead_failure RPC)", () => {
  const { email, password } = getCredentials("admin");
  const appSecret = process.env.META_WEBHOOK_APP_SECRET;

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!appSecret, "META_WEBHOOK_APP_SECRET tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("Meta webhook lead işleyemeyince admin bildirimler sayfasında görünür", async ({ page, request }) => {
    const externalRef = `e2e-meta-fail-${Date.now()}`;
    const dedupKey = `webhook_lead_failure:Meta Lead Ads:${externalRef}`;

    const payload = JSON.stringify({
      entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: externalRef } }] }],
    });
    const signature = "sha256=" + createHmac("sha256", appSecret!).update(payload).digest("hex");

    const webhookRes = await request.post("/api/webhooks/meta-leads", {
      headers: { "content-type": "application/json", "x-hub-signature-256": signature },
      data: payload,
    });
    expect(webhookRes.status()).toBe(200);

    try {
      await loginAs(page, email!, password!);
      await page.goto("/notifications?type=webhook_lead_failure");

      const list = page.getByTestId("notifications-list");
      await expect(list.getByText(externalRef)).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteNotificationByDedupKey(dedupKey);
    }
  });
});
