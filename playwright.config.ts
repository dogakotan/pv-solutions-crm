import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Kimlik doğrulanmış testlerin tümü tek, paylaşılan bir E2E test hesabıyla
  // (E2E_TEST_EMAIL) giriş yapıyor — Supabase SSR client'ı her sunucu
  // isteğinde oturumu tazeleyebiliyor (refresh token tek kullanımlık);
  // aynı hesapla eşzamanlı birden çok worker/context bunu yarış durumuna
  // sokup rastgele "sessiz çıkış" (o testin ortasında /login'e düşme)
  // üretiyordu. workers: 1 bu yarışı tamamen ortadan kaldırıyor — küçük
  // bir suit olduğundan toplam süre maliyeti kabul edilebilir.
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
