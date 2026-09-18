import { test, expect } from "@playwright/test";

/**
 * Yol haritası 5.5: public webhook route'larında hız sınırlama yoktu.
 * src/lib/rate-limit.ts artık her route için IP başına sabit-pencere bir
 * sayaç tutuyor (bkz. Next.js Backend for Frontend rehberindeki
 * checkRateLimit deseni). Her testin kendi sentetik x-forwarded-for IP'sini
 * kullanması önemli — aksi halde bu testler diğer webhook testleriyle
 * (webhooks.spec.ts, webhook-failure-notification.spec.ts) aynı "unknown"
 * kovasını paylaşıp birbirini yanlışlıkla 429'a düşürebilir.
 *
 * Dokuzuncu tur inceleme: `Date.now() % 250` aralığı 0-249'du ve
 * webhooks.spec.ts/webhook-failure-notification.spec.ts/
 * webhook-lead-quality.spec.ts'in kendi kovalarını açık tutmak için
 * güvendiği SABİT IP'lerle (.10/.20/.30) ~%1 ihtimalle çakışabiliyordu.
 * Aralık bu sabitlerin üzerine (50-249) kaydırıldı.
 */
test.describe("Webhook route'larında hız sınırlama (checkRateLimit)", () => {
  test("google-leads webhook'u dakikada 60 isteğin üzerinde 429 döner", async ({ request }) => {
    const syntheticIp = `203.0.113.${50 + (Date.now() % 200)}`;
    const statuses: number[] = [];

    for (let i = 0; i < 65; i++) {
      const res = await request.post("/api/webhooks/google-leads", {
        headers: { "x-forwarded-for": syntheticIp },
        data: { google_key: "wrong-key", lead_id: `rl-${i}` },
      });
      statuses.push(res.status());
    }

    // Sadece 429 sayısını (ve tümleyenini) kontrol ediyoruz, spesifik bir
    // 401 beklemiyoruz — CI'da GOOGLE_ADS_WEBHOOK_KEY tanımlı değil, bu da
    // limit altındaki istekleri 401 yerine 500 "Not configured" yapıyor;
    // hız sınırlayıcının kendisi ortam yapılandırmasından bağımsız çalışmalı.
    const rateLimitedCount = statuses.filter((s) => s === 429).length;
    const notRateLimitedCount = statuses.length - rateLimitedCount;
    expect(notRateLimitedCount).toBe(60);
    expect(rateLimitedCount).toBe(5);
  });

  test("meta-leads webhook GET (hub verify) dakikada 20 isteğin üzerinde 429 döner", async ({ request }) => {
    const syntheticIp = `203.0.113.${50 + ((Date.now() + 1) % 200)}`;
    const statuses: number[] = [];

    for (let i = 0; i < 23; i++) {
      const res = await request.get("/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=wrong", {
        headers: { "x-forwarded-for": syntheticIp },
      });
      statuses.push(res.status());
    }

    const rateLimitedCount = statuses.filter((s) => s === 429).length;
    const forbiddenCount = statuses.filter((s) => s === 403).length;
    expect(forbiddenCount).toBe(20);
    expect(rateLimitedCount).toBe(3);
  });
});
