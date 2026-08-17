import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { LeadStage } from "@/types/lead";

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Bu modüldeki her fonksiyon çağıranın oturumuyla (RLS altında) çalışır.
 * Hiçbir sorguda "owner_id = me" / "partner_id = me" gibi elle bir filtre
 * YOK — leads/partner_referrals RLS politikaları zaten admin'e tümünü,
 * sales/first_call'a kendi işlerini, partner_admin'e kendi firmasını,
 * partner_employee'e kendi atandığı işleri gösteriyor. Rapor sorguları bu
 * yüzden rol bazında ayrı yazılmadı — RLS'in sağladığı satır kümesi
 * üzerinde aynı agregasyon uygulanıyor (bk. leads.ts'teki aynı desen).
 */

export type ReportDateRange = { from: string | null; to: string | null };

const STAGE_ORDER: LeadStage[] = [
  "new",
  "contacted",
  "referred",
  "survey_scheduled",
  "survey_completed",
  "proposal_preparing",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
  "sale_registered",
];

const CLOSED_STAGES = new Set<LeadStage>(["won", "lost", "sale_registered"]);

export type FunnelItem = { stage: LeadStage; count: number };

export async function getLeadFunnel(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<FunnelItem[]> {
  let query = supabase.from("leads").select("stage").is("deleted_at", null);
  if (range.from) query = query.gte("created_at", range.from);
  if (range.to) query = query.lte("created_at", range.to);

  const { data, error } = await query;
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);
  }

  return STAGE_ORDER.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
}

export type SourceConversionItem = {
  source: string;
  total: number;
  won: number;
  lost: number;
  conversionRate: number;
};

export async function getSourceConversion(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<SourceConversionItem[]> {
  let query = supabase.from("leads").select("source, stage").is("deleted_at", null);
  if (range.from) query = query.gte("created_at", range.from);
  if (range.to) query = query.lte("created_at", range.to);

  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<string, { total: number; won: number; lost: number }>();
  for (const row of data ?? []) {
    const entry = map.get(row.source) ?? { total: 0, won: 0, lost: 0 };
    entry.total += 1;
    if (row.stage === "won") entry.won += 1;
    if (row.stage === "lost") entry.lost += 1;
    map.set(row.source, entry);
  }

  return Array.from(map.entries())
    .map(([source, v]) => ({
      source,
      total: v.total,
      won: v.won,
      lost: v.lost,
      conversionRate: v.won + v.lost > 0 ? Math.round((v.won / (v.won + v.lost)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

type OwnerEmbed = { full_name: string } | { full_name: string }[] | null;

function extractOwnerName(embed: OwnerEmbed): string {
  if (!embed) return "—";
  const owner = Array.isArray(embed) ? embed[0] : embed;
  return owner?.full_name || "—";
}

export type WonAmountByCurrency = { currency: string; amount: number };

export type SalespersonPerformanceItem = {
  salesUserId: string;
  salesUserName: string;
  newCount: number;
  openCount: number;
  won: number;
  lost: number;
  conversionRate: number;
  offersSent: number;
  wonAmounts: WonAmountByCurrency[];
};

/**
 * leads.owner_id yaşam döngüsü boyunca el değiştirir: lead oluşturulunca
 * önce onu yaratan first_call kullanıcısına, satışa atanınca satışçıya
 * atanır (bkz. assign_lead_to_sales). Bu yüzden "kim şu an sahip" diye
 * ham owner_id'ye göre gruplamak first_call kullanıcılarını da bu tabloya
 * (yanlışlıkla satışçıymış gibi teklif/kazanılan tutar ile) düşürür —
 * bu fonksiyon yalnızca pv_sales rolündeki sahiplerle sınırlıyor.
 */
export async function getSalespersonPerformance(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<SalespersonPerformanceItem[]> {
  const { data: salesAssignments, error: salesError } = await supabase
    .from("user_role_assignments")
    .select("user_id")
    .eq("role", "pv_sales");
  if (salesError) throw salesError;

  const salesUserIds = new Set((salesAssignments ?? []).map((a) => a.user_id));
  if (salesUserIds.size === 0) return [];

  let query = supabase
    .from("leads")
    .select("id, owner_id, stage, owner:profiles!leads_owner_id_fkey(full_name)")
    .is("deleted_at", null)
    .in("owner_id", Array.from(salesUserIds));
  if (range.from) query = query.gte("created_at", range.from);
  if (range.to) query = query.lte("created_at", range.to);

  const { data, error } = await query;
  if (error) throw error;

  const leads = data ?? [];
  const leadIds = leads.map((l) => l.id);
  const ownerIdByLeadId = new Map(leads.map((l) => [l.id, l.owner_id]));

  const [offersResult, outcomesResult] =
    leadIds.length > 0
      ? await Promise.all([
          supabase.from("offers").select("lead_id").in("lead_id", leadIds),
          supabase
            .from("sales_outcomes")
            .select("lead_id, final_amount, currency")
            .eq("outcome", "won")
            .in("lead_id", leadIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (offersResult.error) throw offersResult.error;
  if (outcomesResult.error) throw outcomesResult.error;

  const map = new Map<
    string,
    {
      name: string;
      newCount: number;
      openCount: number;
      won: number;
      lost: number;
      offersSent: number;
      wonAmounts: Map<string, number>;
    }
  >();

  for (const row of leads) {
    const name = extractOwnerName(row.owner as OwnerEmbed);
    const entry =
      map.get(row.owner_id) ??
      { name, newCount: 0, openCount: 0, won: 0, lost: 0, offersSent: 0, wonAmounts: new Map<string, number>() };
    const stage = row.stage as LeadStage;
    if (stage === "new") entry.newCount += 1;
    if (!CLOSED_STAGES.has(stage)) entry.openCount += 1;
    if (stage === "won") entry.won += 1;
    if (stage === "lost") entry.lost += 1;
    map.set(row.owner_id, entry);
  }

  for (const o of offersResult.data ?? []) {
    const entry = map.get(ownerIdByLeadId.get(o.lead_id) ?? "");
    if (entry) entry.offersSent += 1;
  }

  for (const so of outcomesResult.data ?? []) {
    if (so.final_amount == null || !so.currency) continue;
    const entry = map.get(ownerIdByLeadId.get(so.lead_id) ?? "");
    if (!entry) continue;
    entry.wonAmounts.set(so.currency, (entry.wonAmounts.get(so.currency) ?? 0) + so.final_amount);
  }

  return Array.from(map.entries())
    .map(([ownerId, v]) => ({
      salesUserId: ownerId,
      salesUserName: v.name,
      newCount: v.newCount,
      openCount: v.openCount,
      won: v.won,
      lost: v.lost,
      conversionRate: v.won + v.lost > 0 ? Math.round((v.won / (v.won + v.lost)) * 100) : 0,
      offersSent: v.offersSent,
      wonAmounts: Array.from(v.wonAmounts.entries()).map(([currency, amount]) => ({ currency, amount })),
    }))
    .sort((a, b) => b.openCount - a.openCount);
}

type PartnerEmbed = { name: string; rating: number | null } | { name: string; rating: number | null }[] | null;

function extractPartnerName(embed: PartnerEmbed): string {
  if (!embed) return "—";
  const partner = Array.isArray(embed) ? embed[0] : embed;
  return partner?.name || "—";
}

function extractPartnerRating(embed: PartnerEmbed): number | null {
  if (!embed) return null;
  const partner = Array.isArray(embed) ? embed[0] : embed;
  return partner?.rating ?? null;
}

export type PartnerPerformanceItem = {
  partnerId: string;
  partnerName: string;
  rating: number | null;
  referralCount: number;
  acceptanceRate: number;
  avgResponseHours: number | null;
  offerCount: number;
  salesCount: number;
};

export async function getPartnerPerformance(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<PartnerPerformanceItem[]> {
  let query = supabase
    .from("partner_referrals")
    .select("id, partner_id, status, sent_at, responded_at, partners(name, rating)");
  if (range.from) query = query.gte("sent_at", range.from);
  if (range.to) query = query.lte("sent_at", range.to);

  const { data, error } = await query;
  if (error) throw error;

  const referrals = data ?? [];
  const referralIds = referrals.map((r) => r.id);

  const [offersResult, outcomesResult] =
    referralIds.length > 0
      ? await Promise.all([
          supabase.from("offers").select("referral_id").in("referral_id", referralIds),
          supabase
            .from("sales_outcomes")
            .select("referral_id")
            .eq("outcome", "won")
            .in("referral_id", referralIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (offersResult.error) throw offersResult.error;
  if (outcomesResult.error) throw outcomesResult.error;

  const offerCountByReferral = new Map<string, number>();
  for (const o of offersResult.data ?? []) {
    if (!o.referral_id) continue;
    offerCountByReferral.set(o.referral_id, (offerCountByReferral.get(o.referral_id) ?? 0) + 1);
  }
  const wonReferralIds = new Set((outcomesResult.data ?? []).map((o) => o.referral_id));

  const map = new Map<
    string,
    {
      name: string;
      rating: number | null;
      referralCount: number;
      acceptedCount: number;
      respondedCount: number;
      totalResponseMs: number;
      responseSamples: number;
      offerCount: number;
      salesCount: number;
    }
  >();

  for (const row of referrals) {
    const name = extractPartnerName(row.partners as PartnerEmbed);
    const rating = extractPartnerRating(row.partners as PartnerEmbed);
    const entry =
      map.get(row.partner_id) ?? {
        name,
        rating,
        referralCount: 0,
        acceptedCount: 0,
        respondedCount: 0,
        totalResponseMs: 0,
        responseSamples: 0,
        offerCount: 0,
        salesCount: 0,
      };

    entry.referralCount += 1;
    if (row.status !== "pending") entry.respondedCount += 1;
    if (row.status === "accepted" || row.status === "completed") entry.acceptedCount += 1;
    if (row.responded_at) {
      entry.totalResponseMs += new Date(row.responded_at).getTime() - new Date(row.sent_at).getTime();
      entry.responseSamples += 1;
    }
    entry.offerCount += offerCountByReferral.get(row.id) ?? 0;
    if (wonReferralIds.has(row.id)) entry.salesCount += 1;

    map.set(row.partner_id, entry);
  }

  return Array.from(map.entries())
    .map(([partnerId, v]) => ({
      partnerId,
      partnerName: v.name,
      rating: v.rating,
      referralCount: v.referralCount,
      acceptanceRate: v.respondedCount > 0 ? Math.round((v.acceptedCount / v.respondedCount) * 100) : 0,
      avgResponseHours:
        v.responseSamples > 0 ? Math.round(v.totalResponseMs / v.responseSamples / 3_600_000) : null,
      offerCount: v.offerCount,
      salesCount: v.salesCount,
    }))
    .sort((a, b) => b.referralCount - a.referralCount);
}

export type LostReasonItem = { reason: string; count: number };

export async function getLostReasons(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<LostReasonItem[]> {
  let query = supabase.from("sales_outcomes").select("lost_reason").eq("outcome", "lost");
  if (range.from) query = query.gte("result_date", range.from);
  if (range.to) query = query.lte("result_date", range.to);

  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const reason = row.lost_reason ?? "Belirtilmemiş";
    map.set(reason, (map.get(reason) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export type MonthlyWonAmountItem = { month: string; currency: string; totalAmount: number };

export async function getMonthlyWonAmount(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<MonthlyWonAmountItem[]> {
  let query = supabase.from("sales_outcomes").select("result_date, final_amount, currency").eq("outcome", "won");
  if (range.from) query = query.gte("result_date", range.from);
  if (range.to) query = query.lte("result_date", range.to);

  const { data, error } = await query;
  if (error) throw error;

  // Farklı para birimleri doğrudan toplanmaz (bk. doküman 20. bölüm) —
  // her (ay, para birimi) çifti ayrı satır olarak tutulur.
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.final_amount == null || !row.currency) continue;
    const month = row.result_date.slice(0, 7);
    const key = `${month}|${row.currency}`;
    map.set(key, (map.get(key) ?? 0) + row.final_amount);
  }

  return Array.from(map.entries())
    .map(([key, totalAmount]) => {
      const [month, currency] = key.split("|");
      return { month, currency, totalAmount };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function getOverdueFollowUpCount(supabase: TypedSupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .neq("stage", "won")
    .neq("stage", "lost")
    .neq("stage", "sale_registered")
    .lt("next_follow_up_at", new Date().toISOString());

  if (error) throw error;
  return count ?? 0;
}
