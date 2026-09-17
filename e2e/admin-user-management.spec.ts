import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { findUserIdByEmail, deleteTestUser, hasCleanupCredentials } from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

test.describe("Kullanıcı rolü/durumu yönetimi (set_user_role / set_user_active RPC)", () => {
  const { email, password } = getCredentials("admin");

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil");
  test.skip(!hasCleanupCredentials(), "SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("admin, atılabilir bir kullanıcının rolünü değiştirebilir ve pasifleştirebilir", async ({ page }) => {
    const newEmail = `e2e-user-mgmt-${Date.now()}@pvsolutionstr.com`;
    const fullName = `E2E User Mgmt ${Date.now()}`;

    await loginAs(page, email!, password!);
    await page.goto("/admin/users");

    await page.getByRole("button", { name: "+ Yeni Kullanıcı" }).click();
    const addForm = page.locator("form").filter({ has: page.locator('input[name="fullName"]') });
    await addForm.locator('input[name="fullName"]').fill(fullName);
    await addForm.locator('input[name="email"]').fill(newEmail);
    await addForm.locator('select[name="role"]').selectOption("pv_sales");
    await addForm.getByRole("button", { name: "Hesap Oluştur" }).click();

    await expect(page.getByText(`Hesap oluşturuldu: ${newEmail}`)).toBeVisible({ timeout: 10_000 });

    let userId: string | null = null;
    try {
      userId = await findUserIdByEmail(newEmail);
      expect(userId).not.toBeNull();

      // Sayfa yeniden yüklenmeden (revalidatePath server-action içinde
      // çalıştığı için mevcut render'a yeni satır otomatik yansımıyor,
      // AddStaffUserForm da "tempPassword" state'ine kilitli kalıyor).
      await page.goto("/admin/users");
      const row = page.locator("tbody tr").filter({ hasText: fullName });
      await expect(row).toBeVisible();

      // set_user_role
      await row.locator('select[name="role"]').selectOption("first_call");
      await row.getByRole("button", { name: "Kaydet" }).click();
      // Buton, server action'ın (fetch tabanlı, client-side await edilen)
      // isteği tamamlanana kadar "Kaydediliyor..." gösterip disable oluyor —
      // sabit bir waitForTimeout yerine bu durumun geçmesini bekle.
      await expect(row.getByRole("button", { name: "Kaydet" })).toBeEnabled({ timeout: 10_000 });
      await page.goto("/admin/users");
      await expect(
        page.locator("tbody tr").filter({ hasText: fullName }).locator('select[name="role"]')
      ).toHaveValue("first_call");

      // set_user_active
      const rowAfterRoleChange = page.locator("tbody tr").filter({ hasText: fullName });
      await expect(rowAfterRoleChange.getByText("Aktif", { exact: true })).toBeVisible();
      await rowAfterRoleChange.getByRole("button", { name: "Pasif yap" }).click();
      await expect(rowAfterRoleChange.getByText("Pasif", { exact: true })).toBeVisible({ timeout: 10_000 });
    } finally {
      if (userId) await deleteTestUser(userId);
    }
  });
});
