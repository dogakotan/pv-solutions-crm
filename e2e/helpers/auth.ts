import type { Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // 3 paralel worker eşzamanlı giriş denediğinde Supabase Auth bazen 15sn'yi
  // aşan bir gecikmeyle yanıt verebiliyor (workers:1 zamanında hiç sorun
  // değildi) — bu yüzden pay bırakıldı.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}
