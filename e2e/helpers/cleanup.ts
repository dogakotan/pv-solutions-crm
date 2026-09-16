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

export async function findLeadIdByExternalRef(externalRef: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("leads")
    .select("id")
    .eq("external_ref", externalRef)
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

/**
 * record_sales_outcome / soft_delete_lead gibi belirli bir sahiplik/atama
 * durumu gerektiren senaryolar için doğrudan (create_lead RPC'sini atlayarak)
 * bir test lead'i oluşturur. protect_lead_privileged_columns trigger'ı sadece
 * UPDATE'te devreye girer (OLD/NEW karşılaştırır), düz bir INSERT'i etkilemez
 * — bypass GUC'una gerek yok.
 */
export async function createTestLead(fields: {
  customerName: string;
  ownerId: string;
  salesUserId?: string | null;
  firstCallUserId?: string | null;
  stage?: string;
}): Promise<string> {
  const { data, error } = await adminClient()
    .from("leads")
    .insert({
      customer_type: "individual",
      customer_name: fields.customerName,
      phone: `05${Date.now().toString().slice(-9)}`,
      city: "İstanbul",
      source: "e2e-test",
      owner_id: fields.ownerId,
      created_by: fields.ownerId,
      first_call_user_id: fields.firstCallUserId ?? fields.ownerId,
      sales_user_id: fields.salesUserId ?? null,
      stage: fields.stage ?? "new",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function createTestReferral(fields: {
  leadId: string;
  partnerId: string;
  referredBy: string;
  assignedEmployeeId?: string;
}): Promise<string> {
  const { data, error } = await adminClient()
    .from("partner_referrals")
    .insert({
      lead_id: fields.leadId,
      partner_id: fields.partnerId,
      referred_by: fields.referredBy,
      assigned_employee_id: fields.assignedEmployeeId ?? null,
      status: "pending",
      sent_at: new Date().toISOString(),
      response_due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteNotificationByDedupKey(dedupKey: string): Promise<void> {
  const { error } = await adminClient().from("notifications").delete().eq("dedup_key", dedupKey);
  if (error) throw error;
}

export async function findOfferIdByLeadId(leadId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("offers")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function getOfferStatus(offerId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("offers")
    .select("status")
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

export async function findPartnerIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("partner_id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data?.partner_id ?? null;
}

export async function getPartnerPerformanceRow(partnerId: string): Promise<{
  acceptance_rate: number;
  avg_response_hours: number | null;
  sales_count: number;
  referral_count: number;
} | null> {
  const { data, error } = await adminClient().rpc("get_partner_performance", {
    p_partner_id: partnerId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}
