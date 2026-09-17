import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PartnerReferralStatus } from "@/types/lead";
import type { Partner, PartnerEmployee, PartnerStatus } from "@/types/partner";

type TypedSupabaseClient = SupabaseClient<Database>;

type PartnerWithStatsRow = Database["public"]["Functions"]["get_partners_with_stats"]["Returns"][number];

function buildPartner(row: PartnerWithStatsRow): Partner {
  return {
    id: row.id,
    partnerCode: row.partner_code ?? "",
    name: row.name,
    taxNumber: row.tax_number,
    taxOffice: row.tax_office,
    phone: row.phone ?? "",
    email: row.email ?? "",
    city: row.city ?? "",
    address: row.address,
    status: row.status as PartnerStatus,
    rating: row.rating,
    serviceRegions: row.service_regions ?? [],
    capabilities: row.capabilities ?? [],
    applicationAreas: row.application_areas ?? [],
    pvOwnerName: row.pv_owner_name ?? "—",
    createdAt: row.created_at,
    stats: {
      totalLeads: row.total_leads ?? 0,
      activeLeads: row.active_leads ?? 0,
      sales: row.sales ?? 0,
      conversionRate: row.conversion_rate ?? 0,
    },
  };
}

export async function getPartners(supabase: TypedSupabaseClient): Promise<Partner[]> {
  const { data, error } = await supabase.rpc("get_partners_with_stats");
  if (error) throw error;

  return (data ?? []).map(buildPartner);
}

/**
 * internal_notes ayrı `partner_internal_notes` tablosunda tutulur (RLS,
 * yalnızca pv_admin) — partner rolüne hiçbir zaman görünmez.
 */
export async function getPartnerInternalNote(supabase: TypedSupabaseClient, partnerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("partner_internal_notes")
    .select("note")
    .eq("partner_id", partnerId)
    .maybeSingle();

  return data?.note ?? null;
}

export type RecommendedPartner = {
  id: string;
  name: string;
  city: string;
  serviceRegions: string[];
  rating: number;
};

/**
 * Bir lead için "önce semte, sonra puana göre" ilk 3 partneri önerir.
 * `region_code` serbest metin olduğundan (bkz. partners/new/actions.ts)
 * lead'in semti/şehri ile partnerin service_regions/city'si arasında
 * case-insensitive eşleşme aranır. Sıralama, `computeSuggestedPartnerRating`
 * ile aynı formülün SQL karşılığı olan hesaplanan performans puanına göre
 * yapılır (bkz. `rank_recommended_partners_by_suggested_score` migration'ı);
 * hiç yönlendirme geçmişi olmayan partnerler için bu hesaplanamadığından
 * `partners.rating`e (admin'in elle girdiği puana) geri düşülür.
 */
export async function getRecommendedPartnersForLead(
  supabase: TypedSupabaseClient,
  lead: { city: string; district: string | null }
): Promise<RecommendedPartner[]> {
  const { data, error } = await supabase.rpc("get_recommended_partners_for_lead", {
    p_city: lead.city,
    p_district: lead.district ?? undefined,
  });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city ?? "",
    serviceRegions: row.service_regions ?? [],
    rating: row.rating ?? 0,
  }));
}

export async function getPartnerById(supabase: TypedSupabaseClient, id: string): Promise<Partner | null> {
  const { data, error } = await supabase.rpc("get_partners_with_stats", { p_id: id }).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return buildPartner(data);
}

type RoleEmbed = { role: string } | { role: string }[] | null;

function extractRole(embed: RoleEmbed): string | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0]?.role ?? null) : embed.role;
}

type ReferralLeadEmbed =
  | { lead_no: string; customer_name: string; city: string }
  | { lead_no: string; customer_name: string; city: string }[]
  | null;

function extractReferralLead(embed: ReferralLeadEmbed) {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

export type OpenPartnerReferral = {
  id: string;
  status: PartnerReferralStatus;
  sentAt: string;
  responseDueAt: string;
  isOverdue: boolean;
  leadId: string;
  leadNo: string;
  customerName: string;
  city: string;
};

/**
 * Partner detay sayfasındaki "Açık Yönlendirmeler" sekmesi için — bu
 * partnere gönderilmiş ve henüz kapanmamış (closed_at is null)
 * yönlendirmeler. "Kapanmış" olanlar (kabul edilip sonuçlanmış veya
 * reddedilip iptal edilmiş) burada değil, satış sonuçlarında görünür.
 */
export async function getOpenReferralsForPartner(
  supabase: TypedSupabaseClient,
  partnerId: string
): Promise<OpenPartnerReferral[]> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .select("id, status, sent_at, response_due_at, lead_id, leads(lead_no, customer_name, city)")
    .eq("partner_id", partnerId)
    .is("closed_at", null)
    .is("leads.deleted_at", null)
    .order("sent_at", { ascending: false });

  if (error) throw error;

  const now = Date.now();

  return (data ?? []).flatMap((row) => {
    const lead = extractReferralLead(row.leads as ReferralLeadEmbed);
    if (!lead) return [];
    return [{
      id: row.id,
      status: row.status as PartnerReferralStatus,
      sentAt: row.sent_at,
      responseDueAt: row.response_due_at,
      isOverdue: row.status === "pending" && new Date(row.response_due_at).getTime() < now,
      leadId: row.lead_id,
      leadNo: lead.lead_no,
      customerName: lead.customer_name,
      city: lead.city,
    }];
  });
}

export type PartnerActivityItem = {
  id: string;
  status: PartnerReferralStatus;
  updatedAt: string;
  partnerId: string;
  partnerName: string;
  leadId: string;
  leadNo: string;
  customerName: string;
};

type PartnerNameEmbed = { name: string } | { name: string }[] | null;

function extractPartnerName(embed: PartnerNameEmbed): string {
  if (!embed) return "—";
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.name ?? "—";
}

/**
 * Partnerler > Genel sekmesindeki "Partner Aktiviteleri" akışı için —
 * tüm partnerlere yönelik son yönlendirme olayları (gönderildi/kabul/
 * red/tamamlandı/süresi doldu), en son güncellenene göre sıralı.
 */
export async function getRecentPartnerActivity(
  supabase: TypedSupabaseClient,
  limit = 20
): Promise<PartnerActivityItem[]> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .select("id, status, updated_at, partner_id, lead_id, partners(name), leads(lead_no, customer_name, city)")
    .is("leads.deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const lead = extractReferralLead(row.leads as ReferralLeadEmbed);
    if (!lead) return [];
    return [{
      id: row.id,
      status: row.status as PartnerReferralStatus,
      updatedAt: row.updated_at,
      partnerId: row.partner_id,
      partnerName: extractPartnerName(row.partners as PartnerNameEmbed),
      leadId: row.lead_id,
      leadNo: lead.lead_no,
      customerName: lead.customer_name,
    }];
  });
}

export async function getPartnerEmployees(
  supabase: TypedSupabaseClient,
  partnerId: string
): Promise<PartnerEmployee[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, is_active, user_role_assignments!user_role_assignments_user_id_fkey(role)")
    .eq("partner_id", partnerId);

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const role = extractRole(row.user_role_assignments as RoleEmbed);
    if (role !== "partner_admin" && role !== "partner_employee") return [];

    return [{
      id: row.id,
      fullName: row.full_name,
      role,
      isActive: row.is_active,
      phone: row.phone ?? "",
    }];
  });
}
