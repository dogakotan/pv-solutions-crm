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

export type OfferLineItem = {
  id: string;
  productCode: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type OfferVersionItem = {
  id: string;
  revisionNo: number;
  amount: number;
  currency: string;
  vatIncluded: boolean;
  validUntil: string | null;
  scopeSummary: string | null;
  paymentMethod: string | null;
  shippingTerms: string | null;
  status: OfferVersionStatus;
  createdAt: string;
  items: OfferLineItem[];
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

export type PartnerOfferItem = OfferListItem & {
  latestAmount: number | null;
  latestCurrency: string | null;
};

/**
 * Partner detay sayfasındaki "Teklifler" sekmesi için — bu partnere
 * yönlendirilmiş (partner_referrals üzerinden) leadler için oluşturulmuş
 * tekliflerin listesi, en son revizyonun tutarıyla birlikte. offer_versions
 * tek başına partner_id taşımadığı için offers -> partner_referrals join'i
 * gerekiyor (bkz. getSalesOutcomesForPartner'daki aynı desen).
 */
export async function getOffersForPartner(
  supabase: TypedSupabaseClient,
  partnerId: string
): Promise<PartnerOfferItem[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("id, offer_no, status, created_at, leads(lead_no, customer_name), partner_referrals!inner(partner_id)")
    .eq("partner_referrals.partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const offers = (data ?? []).flatMap((row) => {
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

  const offerIds = offers.map((o) => o.id);
  const latestByOffer = new Map<string, { amount: number; currency: string; revisionNo: number }>();

  if (offerIds.length > 0) {
    const { data: versions, error: versionsError } = await supabase
      .from("offer_versions")
      .select("offer_id, amount, currency, revision_no")
      .in("offer_id", offerIds);

    if (versionsError) throw versionsError;

    for (const v of versions ?? []) {
      const current = latestByOffer.get(v.offer_id);
      if (!current || v.revision_no > current.revisionNo) {
        latestByOffer.set(v.offer_id, { amount: v.amount, currency: v.currency, revisionNo: v.revision_no });
      }
    }
  }

  return offers.map((o) => ({
    ...o,
    latestAmount: latestByOffer.get(o.id)?.amount ?? null,
    latestCurrency: latestByOffer.get(o.id)?.currency ?? null,
  }));
}

export async function getOfferById(supabase: TypedSupabaseClient, id: string): Promise<OfferListItem | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("id, offer_no, status, created_at, leads(lead_no, customer_name)")
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
  };
}

export type LeadOfferVersionOption = {
  id: string;
  offerNo: string;
  revisionNo: number;
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
    .select("id, revision_no, amount, currency, offers!inner(offer_no, lead_id)")
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
      amount: row.amount,
      currency: row.currency,
    }];
  });
}

export type LeadOfferHistory = {
  offerId: string;
  versions: OfferVersionItem[];
};

/**
 * Lead detay sayfasındaki "Teklif Geçmişi" kartı için — bu lead'in
 * (varsa) tek teklifini ve tüm revizyonlarını döner. Şu an bir lead
 * için en fazla bir `offers` satırı açılan iş akışı var (revizyonlar
 * offer_versions'a yeni satır olarak eklenir); birden fazla teklif
 * açılırsa en eskisi kullanılır.
 */
export async function getOfferHistoryForLead(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<LeadOfferHistory | null> {
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (offerError) throw offerError;
  if (!offer) return null;

  const versions = await getOfferVersions(supabase, offer.id);

  return { offerId: offer.id, versions };
}

export async function getOfferVersions(supabase: TypedSupabaseClient, offerId: string): Promise<OfferVersionItem[]> {
  const { data, error } = await supabase
    .from("offer_versions")
    .select(
      "id, revision_no, amount, currency, vat_included, valid_until, scope_summary, payment_method, shipping_terms, status, created_at, offer_version_items(id, product_code, product_name, quantity, unit_price, sort_order)"
    )
    .eq("offer_id", offerId)
    .order("revision_no", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    revisionNo: row.revision_no,
    amount: row.amount,
    currency: row.currency,
    vatIncluded: row.vat_included,
    validUntil: row.valid_until,
    scopeSummary: row.scope_summary,
    paymentMethod: row.payment_method,
    shippingTerms: row.shipping_terms,
    status: row.status as OfferVersionStatus,
    createdAt: row.created_at,
    items: [...row.offer_version_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        productCode: item.product_code,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
  }));
}

export type OfferVersionForExport = OfferVersionItem & {
  offerNo: string;
  customerName: string;
};

/**
 * Excel çıktısı için tek bir revizyonun tüm bağlamını (teklif no, müşteri
 * adı, kalemler) tek sorguda döner — offer_versions'ın kendi RLS'i zaten
 * görünürlüğü sınırlıyor, burada ek bir yetki kontrolüne gerek yok.
 */
export async function getOfferVersionForExport(
  supabase: TypedSupabaseClient,
  offerVersionId: string
): Promise<OfferVersionForExport | null> {
  const { data, error } = await supabase
    .from("offer_versions")
    .select(
      "id, revision_no, amount, currency, vat_included, valid_until, scope_summary, payment_method, shipping_terms, status, created_at, offer_version_items(id, product_code, product_name, quantity, unit_price, sort_order), offers!inner(offer_no, leads(customer_name))"
    )
    .eq("id", offerVersionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  type OfferEmbed = {
    offer_no: string;
    leads: { customer_name: string } | { customer_name: string }[] | null;
  };

  const offer = Array.isArray(data.offers) ? data.offers[0] : (data.offers as OfferEmbed | null);
  if (!offer) return null;

  const lead = Array.isArray(offer.leads) ? offer.leads[0] : offer.leads;
  if (!lead) return null;

  return {
    id: data.id,
    revisionNo: data.revision_no,
    amount: data.amount,
    currency: data.currency,
    vatIncluded: data.vat_included,
    validUntil: data.valid_until,
    scopeSummary: data.scope_summary,
    paymentMethod: data.payment_method,
    shippingTerms: data.shipping_terms,
    status: data.status as OfferVersionStatus,
    createdAt: data.created_at,
    items: [...data.offer_version_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        productCode: item.product_code,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
    offerNo: offer.offer_no,
    customerName: lead.customer_name,
  };
}
