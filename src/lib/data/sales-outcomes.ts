import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MaterialPurchaseStatus, SalesOutcomeType } from "@/types/sales-outcome";

type TypedSupabaseClient = SupabaseClient<Database>;

export type SalesOutcomeItem = {
  id: string;
  outcome: SalesOutcomeType;
  finalAmount: number | null;
  currency: string | null;
  lostReason: string | null;
  resultDate: string;
  notes: string | null;
  offerNo: string | null;
  revisionNo: number | null;
  materialPurchaseStatus: MaterialPurchaseStatus | null;
  erpOrderNumber: string | null;
};

type OfferVersionEmbed =
  | { revision_no: number; offers: { offer_no: string } | { offer_no: string }[] | null }
  | { revision_no: number; offers: { offer_no: string } | { offer_no: string }[] | null }[]
  | null;

function extractOfferVersion(embed: OfferVersionEmbed): { offerNo: string | null; revisionNo: number | null } {
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row) return { offerNo: null, revisionNo: null };
  const offer = Array.isArray(row.offers) ? row.offers[0] : row.offers;
  return { offerNo: offer?.offer_no ?? null, revisionNo: row.revision_no };
}

export async function getSalesOutcomeForLead(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<SalesOutcomeItem | null> {
  const { data, error } = await supabase
    .from("sales_outcomes")
    .select(
      "id, outcome, final_amount, currency, lost_reason, result_date, notes, material_purchase_status, erp_order_number, accepted_offer_version:offer_versions(revision_no, offers(offer_no))"
    )
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { offerNo, revisionNo } = extractOfferVersion(data.accepted_offer_version as OfferVersionEmbed);

  return {
    id: data.id,
    outcome: data.outcome as SalesOutcomeType,
    finalAmount: data.final_amount,
    currency: data.currency,
    lostReason: data.lost_reason,
    resultDate: data.result_date,
    notes: data.notes,
    offerNo,
    revisionNo,
    materialPurchaseStatus: data.material_purchase_status as MaterialPurchaseStatus | null,
    erpOrderNumber: data.erp_order_number,
  };
}

export type PartnerSalesOutcomeItem = {
  id: string;
  outcome: SalesOutcomeType;
  finalAmount: number | null;
  currency: string | null;
  lostReason: string | null;
  resultDate: string;
  leadNo: string;
  customerName: string;
};

type PartnerOutcomeLeadEmbed =
  | { lead_no: string; customer_name: string }
  | { lead_no: string; customer_name: string }[]
  | null;

/**
 * Partner detay sayfasındaki "Satış Sonuçları" sekmesi için — bu
 * partnere yönlendirilmiş (partner_referrals üzerinden) leadlerin
 * kazanılan/kaybedilen sonuçları. Admin bu sorguda pv_admin RLS dalı
 * üzerinden tüm partnerlerin sonuçlarına erişir (burada partner_id ile
 * filtreleniyor); partner detay sayfası artık pv_sales'e de açık olduğu
 * için o rolde çağrılırsa sales_outcomes_select RLS'i zaten yalnızca
 * kendi leadlerinin sonuçlarıyla sınırlıyor — ayrı bir filtre gerekmez.
 */
export async function getSalesOutcomesForPartner(
  supabase: TypedSupabaseClient,
  partnerId: string
): Promise<PartnerSalesOutcomeItem[]> {
  const { data, error } = await supabase
    .from("sales_outcomes")
    .select(
      "id, outcome, final_amount, currency, lost_reason, result_date, partner_referrals!inner(partner_id), leads(lead_no, customer_name)"
    )
    .eq("partner_referrals.partner_id", partnerId)
    .order("result_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const leadEmbed = row.leads as PartnerOutcomeLeadEmbed;
    const lead = Array.isArray(leadEmbed) ? leadEmbed[0] : leadEmbed;
    if (!lead) return [];
    return [{
      id: row.id,
      outcome: row.outcome as SalesOutcomeType,
      finalAmount: row.final_amount,
      currency: row.currency,
      lostReason: row.lost_reason,
      resultDate: row.result_date,
      leadNo: lead.lead_no,
      customerName: lead.customer_name,
    }];
  });
}
