import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ERROR_BOUNDARY_TEXT = "Bir şeyler ters gitti";

type RoleCase = {
  role: string;
  email: string | undefined;
  password: string | undefined;
  path: string;
  heading: string;
};

const ROLE_CASES: RoleCase[] = [
  {
    role: "admin",
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
    path: "/admin",
    heading: "Genel Bakış",
  },
  {
    role: "sales",
    email: process.env.SALES_TEST_EMAIL,
    password: process.env.SALES_TEST_PASSWORD,
    path: "/sales",
    heading: "Genel Bakış",
  },
  {
    role: "first_call",
    email: process.env.FIRST_CALL_TEST_EMAIL,
    password: process.env.FIRST_CALL_TEST_PASSWORD,
    path: "/first-call",
    heading: "Genel Bakış",
  },
  {
    role: "partner_admin",
    email: process.env.PARTNER_ADMIN_TEST_EMAIL,
    password: process.env.PARTNER_ADMIN_TEST_PASSWORD,
    path: "/partner",
    heading: "Genel Bakış",
  },
];

test.describe("rol bazlı Genel Bakış sayfaları (RPC KPI/aksiyon sorguları)", () => {
  for (const { role, email, password, path, heading } of ROLE_CASES) {
    test(`${role}: ${path} hata sınırına düşmeden yüklenir`, async ({ page }) => {
      test.skip(!email || !password, `${role} için test hesabı .env.local'de tanımlı değil`);

      await loginAs(page, email!, password!);
      await page.goto(path);

      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expect(page.getByText(ERROR_BOUNDARY_TEXT)).toHaveCount(0);
    });
  }
});

test.describe("RPC'ye taşınan admin sayfaları", () => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD tanımlı değil — .env.local'e bakınız");

  test("/reports hata sınırına düşmeden yüklenir", async ({ page }) => {
    await loginAs(page, email!, password!);
    await page.goto("/reports");

    await expect(page.getByRole("heading", { name: "Raporlar", level: 1 })).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_TEXT)).toHaveCount(0);
  });

  test("/offers hata sınırına düşmeden yüklenir", async ({ page }) => {
    await loginAs(page, email!, password!);
    await page.goto("/offers");

    await expect(page.getByRole("heading", { name: "Teklifler", level: 1 })).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_TEXT)).toHaveCount(0);
  });
});
