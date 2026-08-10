import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OfferStatus, OfferVersionStatus } from "@/types/offer";

type TypedSupabaseClient = SupabaseClient<Database>;

export type OfferListItem = {
  id: string;
  offerNo: string;
  status: OfferStatus;
  createdAt: string;
  leadNo: string;
  customerName: string;
};

export type OfferVersionItem = {
  id: string;
  revisionNo: number;
  capacityKwp: number;
  amount: number;
  currency: string;
  vatIncluded: boolean;
  validUntil: string | null;
  scopeSummary: string | null;
  status: OfferVersionStatus;
  sentAt: string | null;
  createdAt: string;
};

type LeadEmbed =
  | { lead_no: string; customer_name: string }
  | { lead_no: string; customer_name: string }[]
  | null;

function extractLead(embed: LeadEmbed) {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

export async function getVisibleOffers(supabase: TypedSupabaseClient, limit = 50): Promise<OfferListItem[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("id, offer_no, status, created_at, leads(lead_no, customer_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const lead = extractLead(row.leads as LeadEmbed);
    if (!lead) return [];
    return [{
      id: row.id,
      offerNo: row.offer_no,
      status: row.status as OfferStatus,
      createdAt: row.created_at,
      leadNo: lead.lead_no,
      customerName: lead.customer_name,
    }];
  });
}

export type OfferDetail = OfferListItem & {
  createdByOrganizationType: "pv" | "partner";
};

export async function getOfferById(supabase: TypedSupabaseClient, id: string): Promise<OfferDetail | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("id, offer_no, status, created_at, created_by_organization_type, leads(lead_no, customer_name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const lead = extractLead(data.leads as LeadEmbed);
  if (!lead) return null;

  return {
    id: data.id,
    offerNo: data.offer_no,
    status: data.status as OfferStatus,
    createdAt: data.created_at,
    leadNo: lead.lead_no,
    customerName: lead.customer_name,
    createdByOrganizationType: data.created_by_organization_type as "pv" | "partner",
  };
}

export type LeadOfferVersionOption = {
  id: string;
  offerNo: string;
  revisionNo: number;
  capacityKwp: number;
  amount: number;
  currency: string;
};

/**
 * Satış sonucu formunda "hangi teklif kabul edildi" seçimi için —
 * bir lead'in tüm tekliflerindeki tüm revizyonları düz bir liste olarak
 * döner (offer_versions tek başına lead_id taşımıyor, offers üzerinden
 * join gerekiyor).
 */
export async function getOfferVersionsForLead(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<LeadOfferVersionOption[]> {
  const { data, error } = await supabase
    .from("offer_versions")
    .select("id, revision_no, capacity_kwp, amount, currency, offers!inner(offer_no, lead_id)")
    .eq("offers.lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  type OfferEmbed = { offer_no: string; lead_id: string } | { offer_no: string; lead_id: string }[] | null;

  return (data ?? []).flatMap((row) => {
    const offer = Array.isArray(row.offers) ? row.offers[0] : (row.offers as OfferEmbed);
    if (!offer) return [];
    return [{
      id: row.id,
      offerNo: offer.offer_no,
      revisionNo: row.revision_no,
      capacityKwp: row.capacity_kwp,
      amount: row.amount,
      currency: row.currency,
    }];
  });
}

export async function getOfferVersions(supabase: TypedSupabaseClient, offerId: string): Promise<OfferVersionItem[]> {
  const { data, error } = await supabase
    .from("offer_versions")
    .select("id, revision_no, capacity_kwp, amount, currency, vat_included, valid_until, scope_summary, status, sent_at, created_at")
    .eq("offer_id", offerId)
    .order("revision_no", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    revisionNo: row.revision_no,
    capacityKwp: row.capacity_kwp,
    amount: row.amount,
    currency: row.currency,
    vatIncluded: row.vat_included,
    validUntil: row.valid_until,
    scopeSummary: row.scope_summary,
    status: row.status as OfferVersionStatus,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }));
}
