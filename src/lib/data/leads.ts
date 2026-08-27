import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { LeadStage, LeadScore, PartnerReferralStatus } from "@/types/lead";

type TypedSupabaseClient = SupabaseClient<Database>;
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

/**
 * Bu modüldeki her fonksiyon, çağıran kullanıcının oturumuyla (RLS
 * altında) çalışır. Sorgularda "owner_id = me" gibi bir filtre YOK —
 * hangi satırların görüneceğine zaten leads/partner_referrals RLS
 * politikaları karar veriyor (admin hepsini, first_call/sales kendi
 * leadlerini, partner kendi yönlendirmelerini görür). Burada yalnızca
 * iş kuralı filtreleri (stage, lead_score, tarih) eklenir.
 */

export type LeadListItem = {
  id: string;
  leadNo: string;
  customerName: string;
  city: string;
  stage: LeadStage;
  leadScore: LeadScore | null;
  nextFollowUpAt: string | null;
};

function mapLead(
  row: Pick<LeadRow, "id" | "lead_no" | "customer_name" | "city" | "stage" | "lead_score" | "next_follow_up_at">
): LeadListItem {
  return {
    id: row.id,
    leadNo: row.lead_no ?? "",
    customerName: row.customer_name,
    city: row.city,
    stage: row.stage as LeadStage,
    leadScore: row.lead_score as LeadScore | null,
    nextFollowUpAt: row.next_follow_up_at,
  };
}

export async function getVisibleLeads(supabase: TypedSupabaseClient, limit = 50): Promise<LeadListItem[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, lead_no, customer_name, city, stage, lead_score, next_follow_up_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapLead);
}

export type LeadDetail = {
  id: string;
  leadNo: string;
  customerName: string;
  alternatePhone: string | null;
  email: string | null;
  city: string;
  district: string | null;
  address: string | null;
  buildingType: string | null;
  roofAreaM2: number | null;
  estimatedCapacityKwp: number | null;
  poolInterest: string | null;
  heatPumpInterest: string | null;
  evInterest: string | null;
  batteryInterest: string | null;
  competitorOfferStatus: string | null;
  competitorOfferNote: string | null;
  stage: LeadStage;
  leadScore: LeadScore | null;
  nextFollowUpAt: string | null;
  generalNotes: string | null;
  ownerName: string;
};

type NameEmbed = { full_name: string } | { full_name: string }[] | null;

function extractName(embed: NameEmbed): string | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.full_name ?? null;
}

const LEAD_DETAIL_SELECT = `
  id, lead_no, customer_name, alternate_phone, email,
  city, district, address, building_type, roof_area_m2, estimated_capacity_kwp,
  pool_interest, heat_pump_interest, ev_interest, battery_interest,
  competitor_offer_status, competitor_offer_note,
  stage, lead_score, next_follow_up_at, general_notes,
  owner:profiles!leads_owner_id_fkey(full_name)
`;

export async function getLeadById(supabase: TypedSupabaseClient, id: string): Promise<LeadDetail | null> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_DETAIL_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    leadNo: data.lead_no ?? "",
    customerName: data.customer_name,
    alternatePhone: data.alternate_phone,
    email: data.email,
    city: data.city,
    district: data.district,
    address: data.address,
    buildingType: data.building_type,
    roofAreaM2: data.roof_area_m2,
    estimatedCapacityKwp: data.estimated_capacity_kwp,
    poolInterest: data.pool_interest,
    heatPumpInterest: data.heat_pump_interest,
    evInterest: data.ev_interest,
    batteryInterest: data.battery_interest,
    competitorOfferStatus: data.competitor_offer_status,
    competitorOfferNote: data.competitor_offer_note,
    stage: data.stage as LeadStage,
    leadScore: data.lead_score as LeadScore | null,
    nextFollowUpAt: data.next_follow_up_at,
    generalNotes: data.general_notes,
    ownerName: extractName(data.owner as NameEmbed) ?? "—",
  };
}

type PartnerNameEmbed = { name: string } | { name: string }[] | null;

/**
 * Lead'e en son gönderilen yönlendirmenin partnerini döner (durumdan
 * bağımsız — henüz yanıtlanmamış olsa da "atanan partner" budur).
 */
export async function getAssignedPartnerNameForLead(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .select("partners(name)")
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const embed = data.partners as PartnerNameEmbed;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.name ?? null;
}

export type ActiveReferral = {
  partnerName: string;
  status: PartnerReferralStatus;
};

/**
 * `partner_referrals_one_active_per_lead_idx` (closed_at is null) her lead
 * için en fazla bir aktif yönlendirmeye izin verir — bu yüzden yeni bir
 * partner ataması önerisi göstermeden önce mevcut aktif atamayı bilmemiz
 * gerekiyor (varsa öneri yerine mevcut atama gösterilir).
 */
export async function getActiveReferralForLead(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<ActiveReferral | null> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .select("status, partners(name)")
    .eq("lead_id", leadId)
    .is("closed_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const embed = data.partners as PartnerNameEmbed;
  const row = Array.isArray(embed) ? embed[0] : embed;

  return {
    partnerName: row?.name ?? "—",
    status: data.status as PartnerReferralStatus,
  };
}

/**
 * internal_notes ayrı `lead_internal_notes` tablosunda tutulur (RLS,
 * leads_select_pv ile birebir aynı sahiplik mantığını uygular) — partner
 * rolüne hiçbir zaman görünmez, ayrıca bir pv_sales'in başka bir pv_sales'in
 * lead'inin notunu bu yoldan okuyabilmesi de engellenir.
 */
export async function getLeadInternalNote(supabase: TypedSupabaseClient, leadId: string): Promise<string | null> {
  const { data } = await supabase
    .from("lead_internal_notes")
    .select("note")
    .eq("lead_id", leadId)
    .maybeSingle();

  return data?.note ?? null;
}

export type LeadStageHistoryItem = {
  id: string;
  fromStage: LeadStage | null;
  toStage: LeadStage;
  changedByName: string | null;
  changedAt: string;
};

export async function getLeadStageHistory(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<LeadStageHistoryItem[]> {
  const { data, error } = await supabase
    .from("lead_stage_history")
    .select("id, from_stage, to_stage, changed_at, changed_by:profiles(full_name)")
    .eq("lead_id", leadId)
    .order("changed_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    fromStage: row.from_stage as LeadStage | null,
    toStage: row.to_stage as LeadStage,
    changedByName: extractName(row.changed_by as NameEmbed),
    changedAt: row.changed_at,
  }));
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getAdminLeadKpis(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase.rpc("get_admin_lead_kpis").single();
  if (error) throw error;

  const wonCount = data.won ?? 0;
  const lostCount = data.lost ?? 0;

  return {
    total: data.total ?? 0,
    newLeads: data.new_leads ?? 0,
    awaitingFirstCall: data.awaiting_first_call ?? 0,
    assignedToSales: data.assigned_to_sales ?? 0,
    awaitingPartner: data.awaiting_partner ?? 0,
    overduePartner: data.overdue_partner ?? 0,
    survey: data.survey ?? 0,
    proposal: data.proposal ?? 0,
    won: wonCount,
    lost: lostCount,
    conversionRate: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0,
  };
}

export type ActionItem = {
  id: string;
  leadId: string;
  leadNo: string;
  customerName: string;
  city: string;
  stage: LeadStage;
  reason: "follow_up_overdue" | "partner_response_overdue";
  dueAt: string;
};

type ActionItemReferralLeadEmbed =
  | { id: string; lead_no: string; customer_name: string; city: string; stage: string }
  | { id: string; lead_no: string; customer_name: string; city: string; stage: string }[]
  | null;

export async function getActionItems(supabase: TypedSupabaseClient, limit = 20): Promise<ActionItem[]> {
  const now = new Date().toISOString();

  const [followUpRes, referralRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, lead_no, customer_name, city, stage, next_follow_up_at")
      .is("deleted_at", null)
      .not("stage", "in", "(won,lost,sale_registered)")
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", now)
      .order("next_follow_up_at", { ascending: true })
      .limit(limit),
    supabase
      .from("partner_referrals")
      .select("id, response_due_at, leads(id, lead_no, customer_name, city, stage)")
      .eq("status", "pending")
      .lt("response_due_at", now)
      .order("response_due_at", { ascending: true })
      .limit(limit),
  ]);

  if (followUpRes.error) throw followUpRes.error;
  if (referralRes.error) throw referralRes.error;

  const followUpItems: ActionItem[] = (followUpRes.data ?? []).map((row) => ({
    id: `lead-${row.id}`,
    leadId: row.id,
    leadNo: row.lead_no ?? "",
    customerName: row.customer_name,
    city: row.city,
    stage: row.stage as LeadStage,
    reason: "follow_up_overdue",
    dueAt: row.next_follow_up_at as string,
  }));

  const referralItems: ActionItem[] = (referralRes.data ?? []).flatMap((row) => {
    const lead = extractLead(row.leads as ActionItemReferralLeadEmbed);
    if (!lead) return [];
    return [{
      id: `referral-${row.id}`,
      leadId: lead.id,
      leadNo: lead.lead_no,
      customerName: lead.customer_name,
      city: lead.city,
      stage: lead.stage as LeadStage,
      reason: "partner_response_overdue" as const,
      dueAt: row.response_due_at,
    }];
  });

  return [...followUpItems, ...referralItems]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit);
}

export async function getFirstCallLeadKpis(supabase: TypedSupabaseClient) {
  const { start, end } = todayRange();

  const { data, error } = await supabase.rpc("get_first_call_lead_kpis", { p_start: start, p_end: end }).single();
  if (error) throw error;

  return {
    newAssigned: data.new_assigned ?? 0,
    dueToday: data.due_today ?? 0,
    contacted: data.contacted ?? 0,
    unscored: data.unscored ?? 0,
    readyForSales: data.ready_for_sales ?? 0,
  };
}

export async function getSalesLeadKpis(supabase: TypedSupabaseClient) {
  const { start, end } = todayRange();

  // RLS (private.referral_lead_owned_by_me) zaten bu RPC'yi çağıranın
  // kendi leadlerine ait referral'larla sınırlıyor — fonksiyon SECURITY
  // DEFINER değil, invoker olarak çağıranın rolüyle çalışıyor.
  const { data, error } = await supabase.rpc("get_sales_lead_kpis", { p_start: start, p_end: end }).single();
  if (error) throw error;

  const wonCount = data.won ?? 0;
  const lostCount = data.lost ?? 0;

  return {
    total: data.total ?? 0,
    dueToday: data.due_today ?? 0,
    won: wonCount,
    lost: lostCount,
    conversionRate: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0,
    overduePartner: data.overdue_partner ?? 0,
  };
}

export type PartnerReferralListItem = {
  id: string;
  status: PartnerReferralStatus;
  responseDueAt: string;
  leadNo: string;
  customerName: string;
  city: string;
  stage: LeadStage;
  isOverdue: boolean;
};

type ReferralLeadEmbed =
  | { lead_no: string; customer_name: string; city: string; stage: string }
  | { lead_no: string; customer_name: string; city: string; stage: string }[]
  | null;

function extractLead<T>(embed: T | T[] | null): T | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

export async function getVisiblePartnerReferrals(
  supabase: TypedSupabaseClient,
  limit = 50
): Promise<PartnerReferralListItem[]> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .select("id, status, sent_at, response_due_at, leads(lead_no, customer_name, city, stage)")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const now = new Date().toISOString();

  return (data ?? []).flatMap((row) => {
    const lead = extractLead(row.leads as ReferralLeadEmbed);
    if (!lead) return [];
    return [{
      id: row.id,
      status: row.status as PartnerReferralStatus,
      responseDueAt: row.response_due_at,
      leadNo: lead.lead_no,
      customerName: lead.customer_name,
      city: lead.city,
      stage: lead.stage as LeadStage,
      isOverdue: row.status === "pending" && row.response_due_at < now,
    }];
  });
}

export type SiteVisitItem = {
  referralId: string;
  leadNo: string;
  customerName: string;
  city: string;
  scheduledAt: string | null;
};

type SiteVisitLeadEmbed =
  | { lead_no: string; customer_name: string; city: string; next_follow_up_at: string | null }
  | { lead_no: string; customer_name: string; city: string; next_follow_up_at: string | null }[]
  | null;

export async function getPartnerSiteVisits(supabase: TypedSupabaseClient): Promise<SiteVisitItem[]> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .select("id, leads!inner(lead_no, customer_name, city, next_follow_up_at)")
    .eq("leads.stage", "survey_scheduled")
    .order("next_follow_up_at", { foreignTable: "leads", ascending: true, nullsFirst: false })
    .limit(100);

  if (error) throw error;

  const items = (data ?? []).flatMap((row) => {
    const lead = extractLead(row.leads as SiteVisitLeadEmbed);
    if (!lead) return [];
    return [{
      referralId: row.id,
      leadNo: lead.lead_no,
      customerName: lead.customer_name,
      city: lead.city,
      scheduledAt: lead.next_follow_up_at,
    }];
  });

  return items.sort((a, b) => {
    if (!a.scheduledAt) return 1;
    if (!b.scheduledAt) return -1;
    return a.scheduledAt.localeCompare(b.scheduledAt);
  });
}

export async function getPartnerReferralKpis(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase.rpc("get_partner_referral_kpis").single();
  if (error) throw error;

  const totalCount = data.total ?? 0;
  const completedCount = data.completed ?? 0;

  return {
    total: totalCount,
    pending: data.pending ?? 0,
    overdue: data.overdue ?? 0,
    surveyPlanned: data.survey_planned ?? 0,
    proposalPreparing: data.proposal_preparing ?? 0,
    negotiation: data.negotiation ?? 0,
    completed: completedCount,
    unsuccessful: data.unsuccessful ?? 0,
    conversionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
  };
}
