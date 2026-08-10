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
  createdAt: string;
};

function mapLead(
  row: Pick<LeadRow, "id" | "lead_no" | "customer_name" | "city" | "stage" | "lead_score" | "next_follow_up_at" | "created_at">
): LeadListItem {
  return {
    id: row.id,
    leadNo: row.lead_no ?? "",
    customerName: row.customer_name,
    city: row.city,
    stage: row.stage as LeadStage,
    leadScore: row.lead_score as LeadScore | null,
    nextFollowUpAt: row.next_follow_up_at,
    createdAt: row.created_at,
  };
}

export async function getVisibleLeads(supabase: TypedSupabaseClient, limit = 50): Promise<LeadListItem[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, lead_no, customer_name, city, stage, lead_score, next_follow_up_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapLead);
}

export type LeadDetail = {
  id: string;
  leadNo: string;
  customerType: "individual" | "company";
  customerName: string;
  phone: string;
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
  source: string;
  priority: string;
  stage: LeadStage;
  leadScore: LeadScore | null;
  nextFollowUpAt: string | null;
  generalNotes: string | null;
  createdAt: string;
  ownerName: string;
  firstCallUserName: string | null;
  salesUserName: string | null;
};

type NameEmbed = { full_name: string } | { full_name: string }[] | null;

function extractName(embed: NameEmbed): string | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.full_name ?? null;
}

const LEAD_DETAIL_SELECT = `
  id, lead_no, customer_type, customer_name, phone, alternate_phone, email,
  city, district, address, building_type, roof_area_m2, estimated_capacity_kwp,
  pool_interest, heat_pump_interest, ev_interest, battery_interest,
  competitor_offer_status, competitor_offer_note, source, priority, stage,
  lead_score, next_follow_up_at, general_notes, created_at,
  owner:profiles!leads_owner_id_fkey(full_name),
  first_call_user:profiles!leads_first_call_user_id_fkey(full_name),
  sales_user:profiles!leads_sales_user_id_fkey(full_name)
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
    customerType: data.customer_type as "individual" | "company",
    customerName: data.customer_name,
    phone: data.phone,
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
    source: data.source,
    priority: data.priority,
    stage: data.stage as LeadStage,
    leadScore: data.lead_score as LeadScore | null,
    nextFollowUpAt: data.next_follow_up_at,
    generalNotes: data.general_notes,
    createdAt: data.created_at,
    ownerName: extractName(data.owner as NameEmbed) ?? "—",
    firstCallUserName: extractName(data.first_call_user as NameEmbed),
    salesUserName: extractName(data.sales_user as NameEmbed),
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
  changeSource: string;
  reason: string | null;
  changedByName: string | null;
  changedAt: string;
};

export async function getLeadStageHistory(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<LeadStageHistoryItem[]> {
  const { data, error } = await supabase
    .from("lead_stage_history")
    .select("id, from_stage, to_stage, change_source, reason, changed_at, changed_by:profiles(full_name)")
    .eq("lead_id", leadId)
    .order("changed_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    fromStage: row.from_stage as LeadStage | null,
    toStage: row.to_stage as LeadStage,
    changeSource: row.change_source,
    reason: row.reason,
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
  const [
    { count: total },
    { count: newLeads },
    { count: awaitingFirstCall },
    { count: assignedToSales },
    { count: awaitingPartner },
    { count: overduePartner },
    { count: survey },
    { count: proposal },
    { count: won },
    { count: lost },
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "new"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "new").is("first_call_user_id", null),
    supabase.from("leads").select("id", { count: "exact", head: true }).not("sales_user_id", "is", null),
    supabase.from("partner_referrals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("partner_referrals").select("id", { count: "exact", head: true })
      .eq("status", "pending").lt("response_due_at", new Date().toISOString()),
    supabase.from("leads").select("id", { count: "exact", head: true }).in("stage", ["survey_scheduled", "survey_completed"]),
    supabase.from("leads").select("id", { count: "exact", head: true }).in("stage", ["proposal_preparing", "proposal_sent"]),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "won"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "lost"),
  ]);

  const wonCount = won ?? 0;
  const lostCount = lost ?? 0;

  return {
    total: total ?? 0,
    newLeads: newLeads ?? 0,
    awaitingFirstCall: awaitingFirstCall ?? 0,
    assignedToSales: assignedToSales ?? 0,
    awaitingPartner: awaitingPartner ?? 0,
    overduePartner: overduePartner ?? 0,
    survey: survey ?? 0,
    proposal: proposal ?? 0,
    won: wonCount,
    lost: lostCount,
    conversionRate: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0,
  };
}

export async function getFirstCallLeadKpis(supabase: TypedSupabaseClient) {
  const { start, end } = todayRange();

  const [
    { count: newAssigned },
    { count: dueToday },
    { count: contacted },
    { count: unscored },
    { count: readyForSales },
    { count: total },
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "new"),
    supabase.from("leads").select("id", { count: "exact", head: true })
      .gte("next_follow_up_at", start).lte("next_follow_up_at", end),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "contacted"),
    supabase.from("leads").select("id", { count: "exact", head: true }).is("lead_score", null).neq("stage", "new"),
    supabase.from("leads").select("id", { count: "exact", head: true }).not("lead_score", "is", null).is("sales_user_id", null),
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  return {
    newAssigned: newAssigned ?? 0,
    dueToday: dueToday ?? 0,
    contacted: contacted ?? 0,
    unscored: unscored ?? 0,
    readyForSales: readyForSales ?? 0,
    total: total ?? 0,
  };
}

export async function getSalesLeadKpis(supabase: TypedSupabaseClient) {
  const { start, end } = todayRange();

  const [
    { count: total },
    { count: dueToday },
    { count: hot },
    { count: warm },
    { count: mid },
    { count: cold },
    { count: proposalPreparing },
    { count: negotiation },
    { count: won },
    { count: lost },
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("leads").select("id", { count: "exact", head: true })
      .gte("next_follow_up_at", start).lte("next_follow_up_at", end),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("lead_score", "hot"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("lead_score", "warm"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("lead_score", "mid"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("lead_score", "cold"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "proposal_preparing"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "negotiation"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "won"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "lost"),
  ]);

  return {
    total: total ?? 0,
    dueToday: dueToday ?? 0,
    hot: hot ?? 0,
    warm: warm ?? 0,
    mid: mid ?? 0,
    cold: cold ?? 0,
    proposalPreparing: proposalPreparing ?? 0,
    negotiation: negotiation ?? 0,
    won: won ?? 0,
    lost: lost ?? 0,
  };
}

export type PartnerReferralListItem = {
  id: string;
  status: PartnerReferralStatus;
  sentAt: string;
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
      sentAt: row.sent_at,
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
    .eq("leads.stage", "survey_scheduled");

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
  const now = new Date().toISOString();

  const [
    { count: total },
    { count: pending },
    { count: overdue },
    { count: completed },
    { count: unsuccessful },
    { count: surveyPlanned },
    { count: proposalPreparing },
    { count: negotiation },
  ] = await Promise.all([
    supabase.from("partner_referrals").select("id", { count: "exact", head: true }),
    supabase.from("partner_referrals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("partner_referrals").select("id", { count: "exact", head: true })
      .eq("status", "pending").lt("response_due_at", now),
    supabase.from("partner_referrals").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("partner_referrals").select("id", { count: "exact", head: true }).in("status", ["rejected", "cancelled", "expired"]),
    supabase.from("partner_referrals").select("id, leads!inner(stage)", { count: "exact", head: true }).eq("leads.stage", "survey_scheduled"),
    supabase.from("partner_referrals").select("id, leads!inner(stage)", { count: "exact", head: true }).eq("leads.stage", "proposal_preparing"),
    supabase.from("partner_referrals").select("id, leads!inner(stage)", { count: "exact", head: true }).eq("leads.stage", "negotiation"),
  ]);

  const totalCount = total ?? 0;
  const completedCount = completed ?? 0;

  return {
    total: totalCount,
    pending: pending ?? 0,
    overdue: overdue ?? 0,
    surveyPlanned: surveyPlanned ?? 0,
    proposalPreparing: proposalPreparing ?? 0,
    negotiation: negotiation ?? 0,
    completed: completedCount,
    unsuccessful: unsuccessful ?? 0,
    conversionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
  };
}
