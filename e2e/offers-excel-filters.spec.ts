import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { loginAs } from "./helpers/auth";
import { createLeadViaUi } from "./helpers/actions";
import {
  createTestReferral,
  deleteLead,
  findLeadIdByCustomerName,
  findUserIdByEmail,
  findPartnerIdByEmail,
  hasCleanupCredentials,
} from "./helpers/cleanup";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const PARTNER_ADMIN_TEST_EMAIL = process.env.PARTNER_ADMIN_TEST_EMAIL;

// Dördüncü tur inceleme: Teklifler > Teklif Listesi'ndeki Excel export'u
// tarih/tutar filtrelerini hiç forward etmiyordu — ekranda "tutar >= 10000"
// ile daraltılmış bir görünüm varken export tüm teklifleri (filtrelenmemiş)
// indiriyordu. Bu test, tutar filtresi uygulandığında export'un da aynı
// daraltılmış kümeyi yansıttığını doğruluyor.
test.describe("Teklifler Excel export'u ekrandaki tutar filtresini yansıtır", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !PARTNER_ADMIN_TEST_EMAIL || !hasCleanupCredentials(),
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD / PARTNER_ADMIN_TEST_EMAIL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil",
  );

  test("amountMin filtresi uygulanınca export'ta yalnızca eşiği geçen teklif yer alır", async ({ page }) => {
    const cheapName = `E2E-ExcelFilter-Cheap-${Date.now()}`;
    const expensiveName = `E2E-ExcelFilter-Expensive-${Date.now()}`;

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      const partnerId = await findPartnerIdByEmail(PARTNER_ADMIN_TEST_EMAIL!);
      const adminId = await findUserIdByEmail(TEST_EMAIL!);
      expect(partnerId).not.toBeNull();
      expect(adminId).not.toBeNull();

      for (const [name, amount] of [
        [cheapName, "5000"],
        [expensiveName, "50000"],
      ] as const) {
        await createLeadViaUi(page, name);
        const leadId = await findLeadIdByCustomerName(name);
        expect(leadId).toBeTruthy();
        await createTestReferral({ leadId: leadId!, partnerId: partnerId!, referredBy: adminId! });

        await page.goto(`/leads/${leadId}`);
        await page.getByRole("button", { name: "Teklif Gönder" }).click();
        await page.fill('input[name="amount"]', amount);
        await page.getByRole("button", { name: "Teklifi Gönder" }).click();
        await expect(page.getByRole("button", { name: /Rev\.0/ })).toBeVisible({ timeout: 15_000 });
      }

      await page.goto("/offers");
      await page.getByRole("button", { name: "Teklif Listesi" }).click();
      await page.getByPlaceholder("Min").fill("10000");

      const excelHref = await page.getByRole("link", { name: "Excel'e Aktar" }).getAttribute("href");
      expect(excelHref).toBeTruthy();

      const response = await page.request.get(excelHref!);
      expect(response.ok()).toBeTruthy();
      const buffer = await response.body();

      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.getWorksheet("Teklifler");
      expect(sheet).toBeTruthy();

      const customerNamesInSheet: string[] = [];
      sheet!.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        customerNamesInSheet.push(String(row.getCell(3).value));
      });

      expect(customerNamesInSheet).toContain(expensiveName);
      expect(customerNamesInSheet).not.toContain(cheapName);
    } finally {
      const [cheapId, expensiveId] = await Promise.all([
        findLeadIdByCustomerName(cheapName),
        findLeadIdByCustomerName(expensiveName),
      ]);
      await Promise.all([cheapId, expensiveId].filter(Boolean).map((id) => deleteLead(id!)));
    }
  });
});
