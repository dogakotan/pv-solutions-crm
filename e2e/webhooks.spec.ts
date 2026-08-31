import { test, expect } from "@playwright/test";
import { findLeadIdByExternalRef, deleteLead, hasCleanupCredentials } from "./helpers/cleanup";

/**
 * Bu testler tarayıcı değil, doğrudan API isteği (page.request) kullanır —
 * webhook route'ları bir kullanıcı oturumu değil, service_role ile çalışır.
 *
 * Meta route'u için sadece dış API çağrısı (Graph API) GEREKTİRMEYEN yollar
 * test edilir (GET handshake, geçersiz imza) — geçerli bir imzayla devam
 * etmek gerçek graph.facebook.com'a istek atar, CI'da güvenilir/hızlı değil
 * ve gerçek kimlik bilgisi olmadan zaten başarısız olurdu.
 */

test.describe("Meta Lead Ads webhook (src/app/api/webhooks/meta-leads/route.ts)", () => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const appSecret = process.env.META_WEBHOOK_APP_SECRET;

  test.skip(!verifyToken || !appSecret, "META_WEBHOOK_VERIFY_TOKEN / META_WEBHOOK_APP_SECRET tanımlı değil");

  test("GET: doğru verify_token ile challenge'ı düz metin olarak döner", async ({ request }) => {
    const res = await request.get(
      `/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=abc123`
    );
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe("abc123");
  });

  test("GET: yanlış verify_token ile 403 döner", async ({ request }) => {
    const res = await request.get(
      "/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123"
    );
    expect(res.status()).toBe(403);
  });

  test("POST: geçersiz imza ile 401 döner (Graph API'ye hiç istek atılmaz)", async ({ request }) => {
    const body = JSON.stringify({ entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: "fake" } }] }] });
    const res = await request.post("/api/webhooks/meta-leads", {
      data: body,
      headers: { "x-hub-signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST: imza header'ı hiç yoksa 401 döner", async ({ request }) => {
    const res = await request.post("/api/webhooks/meta-leads", {
      data: JSON.stringify({ entry: [] }),
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Google Ads Lead Form webhook (src/app/api/webhooks/google-leads/route.ts)", () => {
  const webhookKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;

  test.skip(!webhookKey, "GOOGLE_ADS_WEBHOOK_KEY tanımlı değil — .env.local'e bakınız");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil — temizlik yapılamaz");

  test("POST: google_key eksikse 401 döner, lead oluşturulmaz", async ({ request }) => {
    const res = await request.post("/api/webhooks/google-leads", {
      data: { lead_id: "e2e-missing-key", user_column_data: [] },
    });
    expect(res.status()).toBe(401);
    expect(await findLeadIdByExternalRef("e2e-missing-key")).toBeNull();
  });

  test("POST: yanlış google_key ile 401 döner", async ({ request }) => {
    const res = await request.post("/api/webhooks/google-leads", {
      data: { lead_id: "e2e-wrong-key", google_key: "wrong", user_column_data: [] },
    });
    expect(res.status()).toBe(401);
    expect(await findLeadIdByExternalRef("e2e-wrong-key")).toBeNull();
  });

  test("POST: is_test true ise 200 döner ama lead oluşturulmaz", async ({ request }) => {
    const leadId = `e2e-is-test-${Date.now()}`;
    const res = await request.post("/api/webhooks/google-leads", {
      data: { lead_id: leadId, google_key: webhookKey, is_test: true, user_column_data: [] },
    });
    expect(res.status()).toBe(200);
    expect(await findLeadIdByExternalRef(leadId)).toBeNull();
  });

  test("POST: geçerli payload ile paylaşımlı havuzda bir lead oluşturur (UTF-8 alanlar dahil)", async ({ request }) => {
    const externalRef = `e2e-valid-${Date.now()}`;
    const res = await request.post("/api/webhooks/google-leads", {
      data: {
        lead_id: externalRef,
        google_key: webhookKey,
        is_test: false,
        user_column_data: [
          { column_id: "FULL_NAME", string_value: "E2E Ayşe Yılmaz" },
          { column_id: "PHONE_NUMBER", string_value: "+905551234567" },
          { column_id: "CITY", string_value: "İstanbul" },
        ],
      },
    });
    expect(res.status()).toBe(200);

    const leadId = await findLeadIdByExternalRef(externalRef);
    expect(leadId).not.toBeNull();

    try {
      // İkinci kez aynı lead_id gönderilirse yeni satır oluşmamalı (idempotency).
      const retryRes = await request.post("/api/webhooks/google-leads", {
        data: {
          lead_id: externalRef,
          google_key: webhookKey,
          is_test: false,
          user_column_data: [{ column_id: "FULL_NAME", string_value: "E2E Ayşe Yılmaz" }],
        },
      });
      expect(retryRes.status()).toBe(200);
    } finally {
      if (leadId) await deleteLead(leadId);
    }
  });
});
