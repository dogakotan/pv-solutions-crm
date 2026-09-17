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
 * audit_logs/notifications, profiles(id)'e cascade OLMADAN referans veriyor
 * (bkz. memory: "Test user hard-delete vs audit FK") — bu worker hesapları
 * suite boyunca gerçek aksiyonlar aldığı için (create_partner, teklif,
 * atama vb.) auth.admin.deleteUser bunlar temizlenmeden başarısız olur.
 * Ayrıca bir test çökerse kendi finally'sindeki deleteLead hiç çalışmamış
 * olabilir — bu yüzden bu worker'ın sahip olduğu leadler de (varsa) burada
 * ek bir güvenlik olarak temizleniyor (cascade ile offers/referrals/
 * activities/sales_outcomes'un lead'e bağlı kısmı da gider).
 */
async function purgeUserFootprint(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.from("audit_logs").delete().eq("actor_user_id", userId);
  await admin.from("notifications").delete().eq("recipient_user_id", userId);
  await admin
    .from("leads")
    .delete()
    .or(
      `owner_id.eq.${userId},created_by.eq.${userId},first_call_user_id.eq.${userId},sales_user_id.eq.${userId},deleted_by.eq.${userId}`
    );
}

async function deleteRoleAccount(index: number, role: TestRole): Promise<void> {
  const userId = await findUserIdByEmail(emailFor(index, role));
  if (!userId) return;
  await purgeUserFootprint(userId);
  await deleteTestUser(userId);
}

/**
 * Bir worker index'inin tüm izole hesaplarını + partner'ını siler.
 * Sıra önemli: partner_admin/partner_employee (profiles.partner_id bu
 * partner'a bağlı) partner'dan ÖNCE, partner ise admin'den ÖNCE silinmeli
 * (partners.created_by admin'in profiline referans veriyor, cascade yok).
 * global-setup (idempotent yeniden başlatma) ve global-teardown ikisi de
 * bunu kullanıyor.
 */
export async function teardownWorkerIndex(index: number): Promise<void> {
  await deleteRoleAccount(index, "partner_admin");
  await deleteRoleAccount(index, "partner_employee");

  const partnerId = await findPartnerIdByCode(partnerCodeFor(index));
  if (partnerId) {
    const { error } = await adminClient().from("partners").delete().eq("id", partnerId);
    if (error) throw error;
  }

  await deleteRoleAccount(index, "admin");
  await deleteRoleAccount(index, "sales");
  await deleteRoleAccount(index, "first_call");
}
