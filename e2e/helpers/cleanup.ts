import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * E2E testlerinin oluşturduğu veriyi temizlemek için service-role istemci.
 * src/lib/supabase/admin.ts'deki createAdminClient ile aynı desen, ama bu
 * Next.js sunucu isteği bağlamı dışında (Playwright/Node) çalıştığından
 * ayrı tutuluyor.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil — E2E temizliği yapılamaz.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasCleanupCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Lead silme; offers/offer_versions/offer_version_items/partner_referrals/
// activities/sales_outcomes/lead_stage_history/lead_internal_notes hepsi
// leads.id üzerinden ON DELETE CASCADE ile birlikte silinir.
export async function deleteLead(leadId: string): Promise<void> {
  const { error } = await adminClient().from("leads").delete().eq("id", leadId);
  if (error) throw error;
}

export async function findLeadIdByCustomerName(customerName: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("leads")
    .select("id")
    .eq("customer_name", customerName)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Partner silme; partner_service_regions/partner_capabilities/
// partner_internal_notes cascade ile birlikte silinir. NOT: partneri
// silmeden önce ona partner_id ile bağlı bir profiles satırı kalmamalı
// (profiles.partner_id -> partners ON DELETE NO ACTION) — çalışan
// provizyonu testinde önce deleteTestUser çağrılmalı.
export async function deletePartner(partnerId: string): Promise<void> {
  const { error } = await adminClient().from("partners").delete().eq("id", partnerId);
  if (error) throw error;
}

// Auth kullanıcısını silmek profiles + user_role_assignments'ı cascade ile
// birlikte temizler.
export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
