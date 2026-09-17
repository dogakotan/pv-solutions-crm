import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { hasCleanupCredentials } from "./helpers/cleanup";
import { WORKER_CREDENTIALS_PATH, type TestRole } from "./helpers/credentials";
import { adminClient, emailFor, partnerCodeFor, teardownWorkerIndex } from "./helpers/worker-provisioning";

/**
 * playwright.config.ts'de workers: 3 — worker 0 paylaşılan kalıcı hesapları
 * (E2E_TEST_EMAIL vb.) kullanmaya devam ediyor, aşağıdaki index'ler ise
 * kendi izole hesap setini alıyor (Supabase SSR'ın tek kullanımlık refresh
 * token'ı, aynı hesabın eşzamanlı worker'larca kullanılmasını yarış
 * durumuna sokuyordu). workers sayısı değişirse bu liste de güncellenmeli.
 */
const EXTRA_WORKER_INDICES = [1];

const ROLES: { role: TestRole; namePrefix: string }[] = [
  { role: "admin", namePrefix: "Admin" },
  { role: "sales", namePrefix: "Satış" },
  { role: "first_call", namePrefix: "İlk Görüşme" },
  { role: "partner_admin", namePrefix: "Partner Yönetici" },
  { role: "partner_employee", namePrefix: "Partner Çalışanı" },
];

function generateTempPassword(): string {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12) + "!Aa1";
}

type WorkerEntry = Partial<Record<TestRole, { email: string; password: string }>> & { partnerId?: string };

/**
 * create_partner/provision_staff_user/provision_partner_employee gerçek
 * pv_admin oturumuyla (kalıcı, paylaşılan E2E_TEST_EMAIL hesabı) çağrılmak
 * ZORUNDA (private.current_role() service-role'de NULL döner) — ama bu,
 * her CI run'ında bu gerçek hesabın adına kalıcı audit_logs satırları
 * (create_partner + her hesap için set_role) yazması, gerçek
 * /admin/audit-log'u test gürültüsüyle sonsuza dek kirletmesi demek.
 * Bu satırları kendi entity_id'lerine göre hedefleyerek (yalnızca BU
 * setup çağrısının yazdıklarını, admin'in başka gerçek aksiyonlarını
 * ASLA silmeden) temizliyoruz.
 */
async function purgeSetupAuditNoise(baseAdminId: string, partnerId: string, userIds: string[]): Promise<void> {
  const admin = adminClient();
  await admin
    .from("audit_logs")
    .delete()
    .eq("actor_user_id", baseAdminId)
    .eq("entity_type", "partners")
    .eq("entity_id", partnerId);
  if (userIds.length > 0) {
    // set_user_role (provision_staff_user/provision_partner_employee'nin
    // içinden çağrılıyor) 'set_role' aksiyonunu entity_type='user_role_assignments'
    // ile logluyor — 'profiles' değil.
    await admin
      .from("audit_logs")
      .delete()
      .eq("actor_user_id", baseAdminId)
      .eq("entity_type", "user_role_assignments")
      .in("entity_id", userIds);
  }
}

async function provisionWorkerIndex(
  index: number,
  asAdmin: ReturnType<typeof createClient<Database>>,
  baseAdminId: string
): Promise<WorkerEntry> {
  const admin = adminClient();
  const entry: WorkerEntry = {};
  const createdUserIds: string[] = [];

  const { data: partner, error: partnerError } = await asAdmin.rpc("create_partner", {
    p_name: `E2E Worker ${index} Partner`,
    p_city: "İstanbul",
    p_partner_code: partnerCodeFor(index),
    p_status: "active",
  });
  if (partnerError || !partner) throw partnerError ?? new Error("create_partner boş sonuç döndü");
  entry.partnerId = partner.id;

  for (const { role, namePrefix } of ROLES) {
    const email = emailFor(index, role);
    const password = generateTempPassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${namePrefix} (E2E Worker ${index})` },
    });
    if (createError || !created.user) throw createError ?? new Error("createUser boş sonuç döndü");

    const userId = created.user.id;
    createdUserIds.push(userId);

    if (role === "admin" || role === "sales" || role === "first_call") {
      const dbRole = role === "admin" ? "pv_admin" : role === "sales" ? "pv_sales" : "first_call";
      const { error: provisionError } = await asAdmin.rpc("provision_staff_user", {
        p_user_id: userId,
        p_role: dbRole,
      });
      if (provisionError) {
        await admin.auth.admin.deleteUser(userId);
        throw provisionError;
      }
    } else {
      const dbRole = role === "partner_admin" ? "partner_admin" : "partner_employee";
      const { error: provisionError } = await asAdmin.rpc("provision_partner_employee", {
        p_user_id: userId,
        p_partner_id: partner.id,
        p_role: dbRole,
      });
      if (provisionError) {
        await admin.auth.admin.deleteUser(userId);
        throw provisionError;
      }
    }

    entry[role] = { email, password };
  }

  await purgeSetupAuditNoise(baseAdminId, partner.id, createdUserIds);

  return entry;
}

export default async function globalSetup(): Promise<void> {
  if (fs.existsSync(WORKER_CREDENTIALS_PATH)) fs.unlinkSync(WORKER_CREDENTIALS_PATH);

  const baseEmail = process.env.E2E_TEST_EMAIL;
  const basePassword = process.env.E2E_TEST_PASSWORD;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasCleanupCredentials() || !baseEmail || !basePassword || !anonKey) {
    console.log(
      "[global-setup] Gerekli kimlik bilgileri eksik — izole worker hesapları atlanıyor, tüm worker'lar paylaşılan hesaba düşecek."
    );
    return;
  }

  const asAdmin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInError } = await asAdmin.auth.signInWithPassword({
    email: baseEmail,
    password: basePassword,
  });
  if (signInError || !signInData.user) {
    console.warn(`[global-setup] pv_admin girişi başarısız (${signInError?.message}) — izole worker hesapları atlanıyor.`);
    return;
  }
  const baseAdminId = signInData.user.id;

  const result: Record<string, WorkerEntry> = {};

  for (const index of EXTRA_WORKER_INDICES) {
    try {
      await teardownWorkerIndex(index); // önceki bir run yarıda kesildiyse kalanları temizle (idempotentlik)
      result[String(index)] = await provisionWorkerIndex(index, asAdmin, baseAdminId);
      console.log(`[global-setup] Worker ${index} için izole hesap seti hazır.`);
    } catch (err) {
      console.warn(
        `[global-setup] Worker ${index} için izole hesap seti oluşturulamadı (${err instanceof Error ? err.message : String(err)}) — bu worker paylaşılan hesaba düşecek.`
      );
    }
  }

  fs.writeFileSync(WORKER_CREDENTIALS_PATH, JSON.stringify(result, null, 2));
}
