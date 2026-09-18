import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  findLeadIdByExternalRef,
  deleteLead,
  deleteNotificationByDedupKey,
  getLeadPhoneAndPayload,
  setLeadStageForTest,
  hasCleanupCredentials,
} from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

/**
 * Yol haritasının son açık maddesi: create_lead_from_webhook (1) telefon
 * numaralarını normalize etmiyordu, (2) telefon bazlı duplicate kontrolü
 * yapmıyordu, (3) reklam platformunun ham payload'ını hiç saklamıyordu.
 * Her test kendi google_key'li isteğini gönderip (Google Ads route,
 * gerçek dış API çağrısı gerektirmediği için Meta'dan daha güvenilir)
 * doğrudan admin client ile DB'yi okuyor/temizliyor. Kendi sabit sentetik
 * IP'si — diğer webhook test dosyalarıyla paylaşılan "unknown" rate-limit
 * kovasından izole (altıncı tur inceleme).
 */
const SYNTHETIC_IP = "203.0.113.30";

test.describe("Webhook lead veri kalitesi (create_lead_from_webhook)", () => {
  const webhookKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;

  test.skip(!webhookKey, "GOOGLE_ADS_WEBHOOK_KEY tanımlı değil — .env.local'e bakınız");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil — temizlik yapılamaz");

  test("telefon numarası kanonik biçime normalize edilip ham payload saklanıyor", async ({ request }) => {
    const externalRef = `e2e-normalize-${Date.now()}`;
    const res = await request.post("/api/webhooks/google-leads", {
      data: {
        lead_id: externalRef,
        google_key: webhookKey,
        is_test: false,
        user_column_data: [
          { column_id: "FULL_NAME", string_value: "E2E Normalize Test" },
          { column_id: "PHONE_NUMBER", string_value: "+90 555 111 22 33" },
          { column_id: "CITY", string_value: "İstanbul" },
        ],
      },
      headers: { "x-forwarded-for": SYNTHETIC_IP },
    });
    expect(res.status()).toBe(200);

    const leadId = await findLeadIdByExternalRef(externalRef);
    expect(leadId).not.toBeNull();

    try {
      const { phone, webhookRawPayload } = await getLeadPhoneAndPayload(leadId!);
      expect(phone).toBe("05551112233");
      expect(webhookRawPayload).not.toBeNull();
      expect(JSON.stringify(webhookRawPayload)).toContain("FULL_NAME");
    } finally {
      await deleteLead(leadId!);
    }
  });

  test("açık bir lead ile aynı telefonu paylaşan yeni webhook lead'i oluşturulmuyor, admin bildiriliyor", async ({
    page,
    request,
  }) => {
    const { email, password } = getCredentials("admin");
    test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");

    const firstRef = `e2e-dup-first-${Date.now()}`;
    const secondRef = `e2e-dup-second-${Date.now()}`;
    const dedupKey = `webhook_lead_duplicate:Google Ads Lead Form:${secondRef}`;

    const firstRes = await request.post("/api/webhooks/google-leads", {
      data: {
        lead_id: firstRef,
        google_key: webhookKey,
        is_test: false,
        user_column_data: [
          { column_id: "FULL_NAME", string_value: "E2E Dup Birinci" },
          { column_id: "PHONE_NUMBER", string_value: "05559998877" },
          { column_id: "CITY", string_value: "İstanbul" },
        ],
      },
      headers: { "x-forwarded-for": SYNTHETIC_IP },
    });
    expect(firstRes.status()).toBe(200);
    const firstLeadId = await findLeadIdByExternalRef(firstRef);
    expect(firstLeadId).not.toBeNull();

    try {
      // Aynı telefon, farklı yazım biçimi (+90 önekiyle), farklı lead_id.
      const secondRes = await request.post("/api/webhooks/google-leads", {
        data: {
          lead_id: secondRef,
          google_key: webhookKey,
          is_test: false,
          user_column_data: [
            { column_id: "FULL_NAME", string_value: "E2E Dup İkinci" },
            { column_id: "PHONE_NUMBER", string_value: "+905559998877" },
            { column_id: "CITY", string_value: "İstanbul" },
          ],
        },
        headers: { "x-forwarded-for": SYNTHETIC_IP },
      });
      expect(secondRes.status()).toBe(200);
      expect(await findLeadIdByExternalRef(secondRef)).toBeNull();

      await loginAs(page, email!, password!);
      await page.goto("/notifications?type=webhook_lead_duplicate");

      const list = page.getByTestId("notifications-list");
      await expect(list.getByText(secondRef)).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteNotificationByDedupKey(dedupKey);
      await deleteLead(firstLeadId!);
    }
  });

  test("kapanmış (won) bir lead ile aynı telefon yeni bir webhook lead'i engellemiyor", async ({ request }) => {
    const closedRef = `e2e-dup-closed-${Date.now()}`;
    const newRef = `e2e-dup-new-${Date.now()}`;

    const closedRes = await request.post("/api/webhooks/google-leads", {
      data: {
        lead_id: closedRef,
        google_key: webhookKey,
        is_test: false,
        user_column_data: [
          { column_id: "FULL_NAME", string_value: "E2E Kapanmış" },
          { column_id: "PHONE_NUMBER", string_value: "05557776655" },
          { column_id: "CITY", string_value: "İstanbul" },
        ],
      },
      headers: { "x-forwarded-for": SYNTHETIC_IP },
    });
    expect(closedRes.status()).toBe(200);
    const closedLeadId = await findLeadIdByExternalRef(closedRef);
    expect(closedLeadId).not.toBeNull();

    let newLeadId: string | null = null;
    try {
      await setLeadStageForTest(closedLeadId!, "won");

      const newRes = await request.post("/api/webhooks/google-leads", {
        data: {
          lead_id: newRef,
          google_key: webhookKey,
          is_test: false,
          user_column_data: [
            { column_id: "FULL_NAME", string_value: "E2E Yeni Fırsat" },
            { column_id: "PHONE_NUMBER", string_value: "5557776655" },
            { column_id: "CITY", string_value: "İstanbul" },
          ],
        },
        headers: { "x-forwarded-for": SYNTHETIC_IP },
      });
      expect(newRes.status()).toBe(200);
      newLeadId = await findLeadIdByExternalRef(newRef);
      expect(newLeadId).not.toBeNull();
    } finally {
      if (newLeadId) await deleteLead(newLeadId);
      await deleteLead(closedLeadId!);
    }
  });
});
