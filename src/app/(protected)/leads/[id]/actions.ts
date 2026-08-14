"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import type { ActivityType } from "@/types/activity";

export type CreateActivityState = {
  error?: string;
};

const VALID_TYPES: ActivityType[] = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "survey_scheduled",
  "survey_completed",
  "note",
  "task",
  "proposal_followup",
];

const isValidDateString = (v: string) => v === "" || !Number.isNaN(Date.parse(v));

const createActivitySchema = z.object({
  leadId: z.string().trim().min(1, "Lead bulunamadı."),
  activityType: z.enum(VALID_TYPES as [ActivityType, ...ActivityType[]], {
    error: "Tür ve başlık zorunludur.",
  }),
  title: z.string().trim().min(1, "Tür ve başlık zorunludur.").max(200),
  description: z.string().trim().max(2000),
  nextFollowUpAt: z.string().trim().refine(isValidDateString, "Takip tarihi geçersiz."),
  referralId: z.string().trim().max(100),
});

export async function createActivity(
  _prevState: CreateActivityState,
  formData: FormData
): Promise<CreateActivityState> {
  const parsed = createActivitySchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    activityType: String(formData.get("activityType") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? ""),
    referralId: String(formData.get("referralId") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  const { leadId, activityType, title, description, nextFollowUpAt: nextFollowUpAtRaw, referralId } =
    parsed.data;
  const shareWithPartner = formData.get("shareWithPartner") === "on";

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı." };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const nextFollowUpAt = nextFollowUpAtRaw ? new Date(nextFollowUpAtRaw).toISOString() : null;
  const isShared = shareWithPartner && referralId.length > 0;

  const { error } = await supabase.from("activities").insert({
    lead_id: leadId,
    activity_type: activityType,
    visibility: isShared ? "shared_with_partner" : "pv_internal",
    referral_id: isShared ? referralId : null,
    title,
    description: description || null,
    occurred_at: now,
    next_follow_up_at: nextFollowUpAt,
    created_by: userId,
  });

  if (error) {
    return { error: "Aktivite kaydedilemedi: " + error.message };
  }

  if (nextFollowUpAt) {
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({ next_follow_up_at: nextFollowUpAt })
      .eq("id", leadId);

    if (leadUpdateError) {
      return { error: "Aktivite kaydedildi ama lead'in takip tarihi güncellenemedi: " + leadUpdateError.message };
    }
  }

  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function assignPartner(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const partnerId = String(formData.get("partnerId") ?? "");

  if (!leadId || !partnerId) {
    throw new Error("Partner seçilmedi");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_lead_to_partner", {
    p_lead_id: leadId,
    p_partner_id: partnerId,
  });
  if (error) throw error;

  revalidatePath(`/leads/${leadId}`);
}

export type OfferFormState = {
  error?: string;
};

const OFFER_CURRENCIES = ["TRY", "USD", "EUR"] as const;

const offerFieldsSchema = z.object({
  leadId: z.string().trim().min(1, "Lead bulunamadı."),
  amount: z.coerce
    .number({ error: "Tutar ve para birimi zorunludur." })
    .positive("Tutar pozitif bir sayı olmalıdır."),
  currency: z.enum(OFFER_CURRENCIES, { error: "Tutar ve para birimi zorunludur." }),
  vatIncluded: z.boolean(),
  validUntilRaw: z.string().trim().refine(isValidDateString, "Geçerlilik tarihi geçersiz."),
  scopeSummary: z.string().trim().max(2000),
  paymentMethod: z.string().trim().max(200),
  shippingTerms: z.string().trim().max(200),
});

function parseOfferFields(formData: FormData) {
  return {
    leadId: String(formData.get("leadId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    currency: String(formData.get("currency") ?? "").trim(),
    vatIncluded: formData.get("vatIncluded") === "on",
    validUntilRaw: String(formData.get("validUntil") ?? "").trim(),
    scopeSummary: String(formData.get("scopeSummary") ?? "").trim(),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim(),
    shippingTerms: String(formData.get("shippingTerms") ?? "").trim(),
  };
}

type ParsedOfferItem = {
  productCode: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
};

const offerItemSchema = z.object({
  productCode: z.string().trim().max(100).optional(),
  productName: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().positive("Adet pozitif bir sayı olmalıdır.").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "Birim fiyat negatif olamaz."),
});

/**
 * Ürün kalemi satırları formda paralel diziler halinde gelir (her satır
 * için aynı index'te bir değer) — boş "Ürün" alanına sahip satırlar
 * (kullanıcının doldurmadan bıraktığı boş satırlar) sessizce atlanır.
 */
function parseOfferItems(formData: FormData): { items: ParsedOfferItem[]; error?: string } {
  const codes = formData.getAll("itemProductCode");
  const names = formData.getAll("itemProductName");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");

  const items: ParsedOfferItem[] = [];

  for (let i = 0; i < names.length; i++) {
    const productName = String(names[i] ?? "").trim();
    if (!productName) continue;

    const parsed = offerItemSchema.safeParse({
      productCode: String(codes[i] ?? "").trim() || undefined,
      productName,
      quantity: String(quantities[i] ?? ""),
      unitPrice: String(unitPrices[i] ?? ""),
    });

    if (!parsed.success) {
      return { items: [], error: `Ürün kalemi ${i + 1}: ${parsed.error.issues[0]?.message ?? "geçersiz."}` };
    }

    items.push({
      productCode: parsed.data.productCode ?? null,
      productName: parsed.data.productName,
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice,
    });
  }

  return { items };
}

function toOfferItemsPayload(items: ParsedOfferItem[]) {
  return items.map((item, index) => ({
    product_code: item.productCode,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    sort_order: index,
  }));
}

/**
 * Teklif (offer + ilk revizyon + kalemler) create_offer RPC'sinde tek
 * transaction'da oluşturulur — bkz. create_offer_and_revise_offer_rpc
 * migration'ı.
 */
export async function sendOffer(
  _prevState: OfferFormState,
  formData: FormData
): Promise<OfferFormState> {
  const parsed = offerFieldsSchema.safeParse(parseOfferFields(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  const { items, error: itemsParseError } = parseOfferItems(formData);
  if (itemsParseError) {
    return { error: itemsParseError };
  }

  const {
    leadId,
    amount,
    currency,
    vatIncluded,
    validUntilRaw,
    scopeSummary,
    paymentMethod,
    shippingTerms,
  } = parsed.data;

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_offer", {
    p_lead_id: leadId,
    p_amount: amount,
    p_currency: currency,
    p_vat_included: vatIncluded,
    p_valid_until: validUntilRaw || undefined,
    p_scope_summary: scopeSummary || undefined,
    p_payment_method: paymentMethod || undefined,
    p_shipping_terms: shippingTerms || undefined,
    p_items: toOfferItemsPayload(items),
  });

  if (error) {
    return { error: "Teklif oluşturulamadı: " + error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function reviseOffer(
  _prevState: OfferFormState,
  formData: FormData
): Promise<OfferFormState> {
  const parsed = offerFieldsSchema.safeParse(parseOfferFields(formData));
  const offerId = String(formData.get("offerId") ?? "");

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  if (!offerId) {
    return { error: "Teklif bulunamadı." };
  }

  const { items, error: itemsParseError } = parseOfferItems(formData);
  if (itemsParseError) {
    return { error: itemsParseError };
  }

  const {
    leadId,
    amount,
    currency,
    vatIncluded,
    validUntilRaw,
    scopeSummary,
    paymentMethod,
    shippingTerms,
  } = parsed.data;

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("revise_offer", {
    p_offer_id: offerId,
    p_amount: amount,
    p_currency: currency,
    p_vat_included: vatIncluded,
    p_valid_until: validUntilRaw || undefined,
    p_scope_summary: scopeSummary || undefined,
    p_payment_method: paymentMethod || undefined,
    p_shipping_terms: shippingTerms || undefined,
    p_items: toOfferItemsPayload(items),
  });

  if (error) {
    return { error: "Revizyon kaydedilemedi: " + error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  return {};
}

/**
 * Yanlışlıkla girilmiş bir teklif revizyonunu kalıcı olarak siler.
 * Yetki/durum kontrolü (kabul edilmiş bir revizyon silinemez, yalnızca
 * pv_admin veya revizyonu oluşturan kullanıcı silebilir) RPC'nin
 * içinde yapılıyor — bkz. delete_offer_version migration'ı.
 */
export async function deleteOfferVersion(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const offerId = String(formData.get("offerId") ?? "").trim();
  const offerVersionId = String(formData.get("offerVersionId") ?? "");

  if (!offerVersionId) {
    throw new Error("Geçersiz istek.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_offer_version", { p_offer_version_id: offerVersionId });

  if (error) throw error;

  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (offerId) revalidatePath(`/offers/${offerId}`);
  revalidatePath("/offers");
}

export type RecordOutcomeState = {
  error?: string;
};

export async function recordSalesOutcome(
  _prevState: RecordOutcomeState,
  formData: FormData
): Promise<RecordOutcomeState> {
  const leadId = String(formData.get("leadId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const offerVersionId = String(formData.get("offerVersionId") ?? "").trim();
  const finalAmountRaw = String(formData.get("finalAmount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();
  const lostReason = String(formData.get("lostReason") ?? "").trim();
  const lostReasonDetail = String(formData.get("lostReasonDetail") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!leadId || (outcome !== "won" && outcome !== "lost")) {
    return { error: "Geçersiz istek." };
  }

  let finalAmount: number | undefined;

  if (outcome === "won") {
    if (!offerVersionId || !finalAmountRaw || !currency) {
      return { error: "Kazanılan satış için teklif revizyonu, tutar ve para birimi zorunludur." };
    }
    const amountCheck = z.coerce.number().positive().safeParse(finalAmountRaw);
    if (!amountCheck.success) {
      return { error: "Tutar pozitif bir sayı olmalıdır." };
    }
    finalAmount = amountCheck.data;
  }

  if (outcome === "lost" && !lostReason) {
    return { error: "Kaybedilen satış için bir gerekçe girilmelidir." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_sales_outcome", {
    p_lead_id: leadId,
    p_outcome: outcome,
    p_accepted_offer_version_id: outcome === "won" ? offerVersionId : undefined,
    p_final_amount: outcome === "won" ? finalAmount : undefined,
    p_currency: outcome === "won" ? currency : undefined,
    p_lost_reason: outcome === "lost" ? lostReason : undefined,
    p_lost_reason_detail: outcome === "lost" ? (lostReasonDetail || undefined) : undefined,
    p_notes: notes || undefined,
  });

  if (error) {
    return { error: "Satış sonucu kaydedilemedi: " + error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/sales/pipeline");
  revalidatePath("/leads");
  return {};
}
