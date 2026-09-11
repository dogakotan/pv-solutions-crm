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

export type FunnelItem = { stage: LeadStage; count: number };

export async function getLeadFunnel(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<FunnelItem[]> {
  const { data, error } = await supabase.rpc("get_lead_funnel", {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
  });
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.stage, row.count);
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
  const { data, error } = await supabase.rpc("get_source_conversion", {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
  });
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      source: row.source,
      total: row.total,
      won: row.won,
      lost: row.lost,
      conversionRate: row.won + row.lost > 0 ? Math.round((row.won / (row.won + row.lost)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

type WonAmountByCurrency = { currency: string; amount: number };

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
  const { data, error } = await supabase.rpc("get_salesperson_performance", {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
  });
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      salesUserId: row.sales_user_id,
      salesUserName: row.sales_user_name,
      newCount: row.new_count,
      openCount: row.open_count,
      won: row.won,
      lost: row.lost,
      conversionRate: row.won + row.lost > 0 ? Math.round((row.won / (row.won + row.lost)) * 100) : 0,
      offersSent: row.offers_sent,
      wonAmounts: (row.won_amounts as WonAmountByCurrency[] | null) ?? [],
    }))
    .sort((a, b) => b.openCount - a.openCount);
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
  range: ReportDateRange,
  partnerId?: string
): Promise<PartnerPerformanceItem[]> {
  const { data, error } = await supabase.rpc("get_partner_performance", {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
    p_partner_id: partnerId,
  });
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      partnerId: row.partner_id,
      partnerName: row.partner_name,
      rating: row.rating,
      referralCount: row.referral_count,
      acceptanceRate: row.acceptance_rate,
      avgResponseHours: row.avg_response_hours,
      offerCount: row.offer_count,
      salesCount: row.sales_count,
    }))
    .sort((a, b) => b.referralCount - a.referralCount);
}

export type LostReasonItem = { reason: string; count: number };

export async function getLostReasons(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<LostReasonItem[]> {
  const { data, error } = await supabase.rpc("get_lost_reasons", {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
  });
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({ reason: row.reason, count: row.count }))
    .sort((a, b) => b.count - a.count);
}

export type MonthlyWonAmountItem = { month: string; currency: string; totalAmount: number };

export async function getMonthlyWonAmount(
  supabase: TypedSupabaseClient,
  range: ReportDateRange
): Promise<MonthlyWonAmountItem[]> {
  // Farklı para birimleri doğrudan toplanmaz (bk. doküman 20. bölüm) —
  // her (ay, para birimi) çifti ayrı satır olarak tutulur.
  const { data, error } = await supabase.rpc("get_monthly_won_amount", {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
  });
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({ month: row.month, currency: row.currency, totalAmount: row.total_amount }))
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
