import fs from "node:fs";
import path from "node:path";

export type TestRole = "admin" | "sales" | "first_call" | "partner_admin" | "partner_employee";

export type RoleCredentials = { email?: string; password?: string };

const BASE_ENV: Record<TestRole, [string, string]> = {
  admin: ["E2E_TEST_EMAIL", "E2E_TEST_PASSWORD"],
  sales: ["SALES_TEST_EMAIL", "SALES_TEST_PASSWORD"],
  first_call: ["FIRST_CALL_TEST_EMAIL", "FIRST_CALL_TEST_PASSWORD"],
  partner_admin: ["PARTNER_ADMIN_TEST_EMAIL", "PARTNER_ADMIN_TEST_PASSWORD"],
  partner_employee: ["PARTNER_EMPLOYEE_TEST_EMAIL", "PARTNER_EMPLOYEE_TEST_PASSWORD"],
};

export const WORKER_CREDENTIALS_PATH = path.join(__dirname, "..", ".worker-credentials.json");

type WorkerCredentialsFile = Record<
  string,
  Partial<Record<TestRole, { email: string; password: string }>> & { partnerId?: string }
>;

let cache: WorkerCredentialsFile | null = null;

function loadWorkerCredentials(): WorkerCredentialsFile {
  if (cache) return cache;
  if (!fs.existsSync(WORKER_CREDENTIALS_PATH)) {
    cache = {};
    return cache;
  }
  cache = JSON.parse(fs.readFileSync(WORKER_CREDENTIALS_PATH, "utf-8")) as WorkerCredentialsFile;
  return cache;
}

/**
 * Worker 0 (paylaşılan hesaplar, .env.local/CI secret'ları) dışında her
 * worker için, global-setup'ta geçici olarak oluşturulmuş izole bir hesap
 * seti kullanılır — bkz. e2e/global-setup.ts. `.worker-credentials.json`
 * yoksa (setup atlandıysa) worker 0 dışındaki worker'lar da paylaşılan
 * hesaba düşer; mevcut test.skip korumaları eksik kimlik bilgisinde zaten
 * o testi atlıyor.
 */
export function getCredentials(role: TestRole): RoleCredentials {
  const index = process.env.TEST_PARALLEL_INDEX ?? "0";
  if (index !== "0") {
    const extra = loadWorkerCredentials()[index]?.[role];
    if (extra) return extra;
  }
  const [emailVar, passwordVar] = BASE_ENV[role];
  return { email: process.env[emailVar], password: process.env[passwordVar] };
}

/** index>0 worker'lar için global-setup'ta oluşturulan izole partner'ın id'si, aksi halde null. */
export function getWorkerPartnerId(): string | null {
  const index = process.env.TEST_PARALLEL_INDEX ?? "0";
  if (index === "0") return null;
  return loadWorkerCredentials()[index]?.partnerId ?? null;
}
