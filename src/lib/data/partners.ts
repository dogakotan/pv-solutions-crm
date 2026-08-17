import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PartnerReferralStatus } from "@/types/lead";
import { APPLICATION_AREAS, type Partner, type PartnerEmployee, type PartnerStats, type PartnerStatus } from "@/types/partner";

type TypedSupabaseClient = SupabaseClient<Database>;

type OwnerEmbed = { full_name: string } | { full_name: string }[] | null;

function extractOwnerName(embed: OwnerEmbed): string {
  if (!embed) return "—";
  const owner = Array.isArray(embed) ? embed[0] : embed;
  return owner?.full_name || "—";
}

async function fetchServiceRegionsByPartner(
  supabase: TypedSupabaseClient,
  partnerIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (partnerIds.length === 0) return map;

  const { data, error } = await supabase
    .from("partner_service_regions")
    .select("partner_id, region_code")
    .in("partner_id", partnerIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const list = map.get(row.partner_id) ?? [];
    list.push(row.region_code);
    map.set(row.partner_id, list);
  }

  return map;
}

async function fetchCapabilitiesByPartner(
  supabase: TypedSupabaseClient,
  partnerIds: string[]
): Promise<Map<string, { capabilities: string[]; applicationAreas: string[] }>> {
  const map = new Map<string, { capabilities: string[]; applicationAreas: string[] }>();
  if (partnerIds.length === 0) return map;

  const { data, error } = await supabase
    .from("partner_capabilities")
    .select("partner_id, capability_code")
    .in("partner_id", partnerIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const entry = map.get(row.partner_id) ?? { capabilities: [], applicationAreas: [] };
    if ((APPLICATION_AREAS as readonly string[]).includes(row.capability_code)) {
      entry.applicationAreas.push(row.capability_code);
    } else {
      entry.capabilities.push(row.capability_code);
    }
    map.set(row.partner_id, entry);
  }

  return map;
}

async function computePartnerStats(supabase: TypedSupabaseClient, partnerId: string): Promise<PartnerStats> {
  const map = await computePartnerStatsByPartner(supabase, [partnerId]);
  return map.get(partnerId) ?? { totalLeads: 0, activeLeads: 0, sales: 0, conversionRate: 0 };
}

/**
 * N partner için 2 sorguda istatistik üretir (partner başına ayrı sorgu yerine).
 * `getPartners` listesi büyüdükçe eski hal 2N+1 sorguya çıkıyordu.
 */
async function computePartnerStatsByPartner(
  supabase: TypedSupabaseClient,
  partnerIds: string[]
): Promise<Map<string, PartnerStats>> {
  const statsMap = new Map<string, PartnerStats>();
  if (partnerIds.length === 0) return statsMap;

  const { data: referrals, error } = await supabase
    .from("partner_referrals")
    .select("id, partner_id, status")
    .in("partner_id", partnerIds);

  if (error) throw error;

  const referralRows = referrals ?? [];
  const referralIdToPartnerId = new Map(referralRows.map((r) => [r.id, r.partner_id]));

  const totals = new Map<string, { total: number; activeLeads: number }>();
  for (const row of referralRows) {
    const entry = totals.get(row.partner_id) ?? { total: 0, activeLeads: 0 };
    entry.total += 1;
    if (row.status === "pending" || row.status === "accepted") entry.activeLeads += 1;
    totals.set(row.partner_id, entry);
  }

  const salesByPartner = new Map<string, number>();
  const allReferralIds = referralRows.map((r) => r.id);
  if (allReferralIds.length > 0) {
    const { data: wonOutcomes, error: outcomesError } = await supabase
      .from("sales_outcomes")
      .select("referral_id")
      .eq("outcome", "won")
      .in("referral_id", allReferralIds);

    if (outcomesError) throw outcomesError;

    for (const row of wonOutcomes ?? []) {
      if (!row.referral_id) continue;
      const partnerId = referralIdToPartnerId.get(row.referral_id);
      if (!partnerId) continue;
      salesByPartner.set(partnerId, (salesByPartner.get(partnerId) ?? 0) + 1);
    }
  }

  for (const partnerId of partnerIds) {
    const { total, activeLeads } = totals.get(partnerId) ?? { total: 0, activeLeads: 0 };
    const sales = salesByPartner.get(partnerId) ?? 0;
    statsMap.set(partnerId, {
      totalLeads: total,
      activeLeads,
      sales,
      conversionRate: total > 0 ? (sales / total) * 100 : 0,
    });
  }

  return statsMap;
}

const PARTNER_SELECT = "id, partner_code, name, tax_number, tax_office, phone, email, city, address, status, rating, created_at, profiles!partners_pv_owner_id_fkey(full_name)";

type PartnerRow = {
  id: string;
  partner_code: string | null;
  name: string;
  tax_number: string | null;
  tax_office: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  status: string;
  rating: number | null;
  created_at: string;
  profiles: OwnerEmbed;
};

function buildPartner(
  row: PartnerRow,
  regions: string[],
  caps: { capabilities: string[]; applicationAreas: string[] },
  stats: PartnerStats
): Partner {
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
    serviceRegions: regions,
    capabilities: caps.capabilities,
    applicationAreas: caps.applicationAreas,
    pvOwnerName: extractOwnerName(row.profiles),
    createdAt: row.created_at,
    stats,
  };
}

export async function getPartners(supabase: TypedSupabaseClient): Promise<Partner[]> {
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as PartnerRow[];
  const ids = rows.map((row) => row.id);

  const [regionsMap, capsMap, statsMap] = await Promise.all([
    fetchServiceRegionsByPartner(supabase, ids),
    fetchCapabilitiesByPartner(supabase, ids),
    computePartnerStatsByPartner(supabase, ids),
  ]);

  return rows.map((row) =>
    buildPartner(
      row,
      regionsMap.get(row.id) ?? [],
      capsMap.get(row.id) ?? { capabilities: [], applicationAreas: [] },
      statsMap.get(row.id) ?? { totalLeads: 0, activeLeads: 0, sales: 0, conversionRate: 0 }
    )
  );
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
 * case-insensitive eşleşme aranır; adaylar `partners.rating` (0.0-5.0,
 * admin tarafından elle girilen performans puanı) alanına göre sıralanıp
 * en yüksek 3'ü döner.
 */
export async function getRecommendedPartnersForLead(
  supabase: TypedSupabaseClient,
  lead: { city: string; district: string | null }
): Promise<RecommendedPartner[]> {
  const regionTerms = [lead.district, lead.city].filter((v): v is string => Boolean(v && v.trim()));
  const partnerIds = new Set<string>();

  const [regionResult, cityResult] = await Promise.all([
    regionTerms.length > 0
      ? supabase
          .from("partner_service_regions")
          .select("partner_id, region_code")
          .or(regionTerms.map((term) => `region_code.ilike.${term}`).join(","))
      : Promise.resolve({ data: [], error: null }),
    supabase.from("partners").select("id").eq("status", "active").ilike("city", lead.city),
  ]);

  if (regionResult.error) throw regionResult.error;
  for (const row of regionResult.data ?? []) partnerIds.add(row.partner_id);

  if (cityResult.error) throw cityResult.error;
  for (const row of cityResult.data ?? []) partnerIds.add(row.id);

  if (partnerIds.size === 0) return [];

  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_SELECT)
    .eq("status", "active")
    .in("id", Array.from(partnerIds));

  if (error) throw error;

  const rows = (data ?? []) as PartnerRow[];
  const ids = rows.map((row) => row.id);
  const regionsMap = await fetchServiceRegionsByPartner(supabase, ids);

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city ?? "",
      serviceRegions: regionsMap.get(row.id) ?? [],
      rating: row.rating ?? 0,
    }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
}

export async function getPartnerById(supabase: TypedSupabaseClient, id: string): Promise<Partner | null> {
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as PartnerRow;
  const [regionsMap, capsMap, stats] = await Promise.all([
    fetchServiceRegionsByPartner(supabase, [row.id]),
    fetchCapabilitiesByPartner(supabase, [row.id]),
    computePartnerStats(supabase, row.id),
  ]);

  return buildPartner(
    row,
    regionsMap.get(row.id) ?? [],
    capsMap.get(row.id) ?? { capabilities: [], applicationAreas: [] },
    stats
  );
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
