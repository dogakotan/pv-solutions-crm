import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Next.js dev server .env.local'i kendisi yükler ama Playwright test runner
// ayrı bir Node process'i — CI'da GitHub Secrets zaten gerçek env değişkeni
// olarak enjekte ediyor, ama lokalde bu satır olmadan process.env.E2E_TEST_EMAIL
// vb. hep undefined kalıyor ve kimlik doğrulanmış testlerin tamamı sessizce
// skip ediliyordu. Next'in kendi yükleyicisi kullanıldı (aynı .env.local /
// .env öncelik sırası), ekstra bir dotenv bağımlılığı gerekmedi.
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Kimlik doğrulanmış testler paylaşılan E2E test hesaplarıyla (E2E_TEST_EMAIL
  // vb.) giriş yapıyor — Supabase SSR client'ının refresh token'ı tek
  // kullanımlık olduğundan, aynı hesabın eşzamanlı birden çok worker/context
  // tarafından kullanılması bunu yarış durumuna sokup rastgele "sessiz çıkış"
  // (o testin ortasında /login'e düşme) üretiyordu. Gerçek düzeltim: her
  // worker'a kendi izole hesap setini vermek. globalSetup (e2e/global-setup.ts)
  // worker 0 dışındaki her worker için geçici bir partner + 5 rol hesabı
  // oluşturur (globalTeardown'da silinir) — bkz. e2e/helpers/credentials.ts.
  // Worker 0 hâlâ paylaşılan hesapları kullanıyor, davranışı değişmedi.
  workers: 3,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
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
