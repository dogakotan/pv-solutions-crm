import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { findUserIdByEmail, deleteTestUser } from "./cleanup";
import type { TestRole } from "./credentials";

export const ALL_ROLES: TestRole[] = ["admin", "sales", "first_call", "partner_admin", "partner_employee"];

export function emailFor(index: number, role: TestRole): string {
  return `e2e-w${index}-${role.replace("_", "-")}@pvsolutions.invalid`;
}

export function partnerCodeFor(index: number): string {
  return `E2E-WORKER-${index}`;
}

export function adminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function findPartnerIdByCode(code: string): Promise<string | null> {
  const { data, error } = await adminClient().from("partners").select("id").eq("partner_code", code).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * audit_logs/notifications ve bir dizi başka tablo (partner_referrals.
 * referred_by/assigned_employee_id/responded_by, lead_stage_history.
 * changed_by, sales_outcomes.created_by/updated_by, partner_internal_notes/
 * lead_internal_notes.updated_by), profiles(id)'e cascade OLMADAN referans
 * veriyor (bkz. memory: "Test user hard-delete vs audit FK") — bu worker
 * hesapları suite boyunca gerçek aksiyonlar aldığı için (create_partner,
 * teklif, atama, referral yanıtlama vb.) auth.admin.deleteUser bunlar
 * temizlenmeden başarısız olur. Bu referanslar yalnızca bu worker'ın SAHİP
 * OLDUĞU lead'ler silindiğinde cascade ile gitmiyor — altıncı tur incelemede
 * somut bir örnekle doğrulandı: bir test admin'in sahibi olduğu bir lead'e
 * bu worker'ın partner_admin'ini responded_by olarak yazabiliyor; o testin
 * kendi finally'si (deleteLead) hiç çalışmazsa (crash/kill), bu referans
 * owner_id/created_by/first_call_user_id/sales_user_id/deleted_by üzerinden
 * ARANMADIĞI için hayatta kalıp bir sonraki run'da hesap silmeyi tıkıyordu.
 * Bu yüzden bu tablolardaki doğrudan referanslar da (yalnızca bu worker'ın
 * sahibi olduğu leadler değil) ayrıca temizleniyor.
 */
async function purgeUserFootprint(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.from("audit_logs").delete().eq("actor_user_id", userId);
  await admin.from("notifications").delete().eq("recipient_user_id", userId);
  await admin.from("lead_stage_history").delete().eq("changed_by", userId);
  await admin
    .from("partner_referrals")
    .delete()
    .or(`referred_by.eq.${userId},assigned_employee_id.eq.${userId},responded_by.eq.${userId}`);
  await admin.from("sales_outcomes").delete().or(`created_by.eq.${userId},updated_by.eq.${userId}`);
  await admin.from("partner_internal_notes").delete().eq("updated_by", userId);
  await admin.from("lead_internal_notes").delete().eq("updated_by", userId);
  await admin
    .from("leads")
    .delete()
    .or(
      `owner_id.eq.${userId},created_by.eq.${userId},first_call_user_id.eq.${userId},sales_user_id.eq.${userId},deleted_by.eq.${userId}`
    );
}

/**
 * Tek bir hesabın silinmesi başarısız olursa (beklenmeyen bir FK referansı
 * kalmışsa) zincirin geri kalanını ASLA durdurmamalı — önceki bir tasarımda
 * flat sıralı bir await zinciriydi, ilk hata tüm sonraki hesapları/partner'ı
 * hiç denemeden bırakıyordu ve worker sessizce paylaşılan hesaba düşüyordu
 * (hiçbir görünür test hatası olmadan). Şimdi her adım kendi try/catch'inde;
 * bir adımın başarısızlığı diğerlerini engellemiyor.
 */
async function deleteRoleAccount(index: number, role: TestRole): Promise<void> {
  const userId = await findUserIdByEmail(emailFor(index, role));
  if (!userId) return;
  await purgeUserFootprint(userId);
  await deleteTestUser(userId);
}

async function safely(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.warn(`[worker-provisioning] ${label} başarısız (${err instanceof Error ? err.message : String(err)}).`);
  }
}

/**
 * Bir worker index'inin tüm izole hesaplarını + partner'ını siler.
 * Sıra önemli: partner_admin/partner_employee (profiles.partner_id bu
 * partner'a bağlı) partner'dan ÖNCE, partner ise admin'den ÖNCE silinmeli
 * (partners.created_by admin'in profiline referans veriyor, cascade yok).
 * global-setup (idempotent yeniden başlatma) ve global-teardown ikisi de
 * bunu kullanıyor. Her adım bağımsız try/catch'e sarılı — biri başarısız
 * olsa bile geri kalanı denenir (bkz. deleteRoleAccount'un kendi yorumu).
 */
export async function teardownWorkerIndex(index: number): Promise<void> {
  await safely(`worker ${index} partner_admin`, () => deleteRoleAccount(index, "partner_admin"));
  await safely(`worker ${index} partner_employee`, () => deleteRoleAccount(index, "partner_employee"));

  await safely(`worker ${index} partner`, async () => {
    const partnerId = await findPartnerIdByCode(partnerCodeFor(index));
    if (partnerId) {
      const { error } = await adminClient().from("partners").delete().eq("id", partnerId);
      if (error) throw error;
    }
  });

  await safely(`worker ${index} admin`, () => deleteRoleAccount(index, "admin"));
  await safely(`worker ${index} sales`, () => deleteRoleAccount(index, "sales"));
  await safely(`worker ${index} first_call`, () => deleteRoleAccount(index, "first_call"));
}
