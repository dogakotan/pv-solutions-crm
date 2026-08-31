import type { Page } from "@playwright/test";

/**
 * NOT: Bu sayfalardaki ("protected" layout) header'da da `type="submit"`
 * bir "Çıkış yap" butonu var — bu yüzden formun submit butonuna asla
 * genel `button[type="submit"]` seçiciyle değil, her zaman görünür
 * metniyle (getByRole) tıklanmalı. Aksi halde test sessizce çıkış
 * yapıp oturumu düşürür (bu, ilk yazımda gerçekten yaşanan bir hataydı).
 */

export async function createLeadViaUi(page: Page, customerName: string): Promise<void> {
  await page.goto("/first-call/new-lead");
  await page.fill('input[name="customerName"]', customerName);
  await page.fill('input[name="phone"]', `05${Date.now().toString().slice(-9)}`);
  await page.fill('input[name="city"]', "İstanbul");
  // Kaynak alanı artık sabit bir listeden seçiliyor (name="source" olan
  // input hidden ve bu seçime göre türetiliyor) — görünür <select>'in kendi
  // name/label'ı yok, bu yüzden kendine özgü bir option value'suyla bulunuyor.
  await page.locator("select").filter({ has: page.locator('option[value="inbound_call"]') }).selectOption("inbound_call");
  await page.getByRole("button", { name: "Lead Oluştur" }).click();
  await page.waitForURL(/\/first-call\/lead-pool/, { timeout: 15_000 });
}

export async function createPartnerViaUi(page: Page, name: string): Promise<string> {
  await page.goto("/partners/new");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="city"]', "İstanbul");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await page.waitForURL(/\/partners\/[0-9a-f-]{36}(\?.*)?$/, { timeout: 15_000 });
  const partnerId = new URL(page.url()).pathname.split("/").pop();
  if (!partnerId) throw new Error("Partner id URL'den okunamadı: " + page.url());
  return partnerId;
}
