"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import type { ActivityType } from "@/types/activity";
import { NEXT_STAGE, type LeadStage } from "@/types/lead";
import {
  INTEREST_VALUES,
  COMPETITOR_STATUS_VALUES,
  LEAD_SCORE_VALUES,
  optionalText,
  optionalNumber,
  optionalEnum,
} from "@/lib/validation/lead-qualification";

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

  const { error } = await supabase.rpc("create_activity", {
    p_lead_id: leadId,
    p_activity_type: activityType,
    p_title: title,
    p_description: description || undefined,
    p_occurred_at: now,
    p_next_follow_up_at: nextFollowUpAt ?? undefined,
    p_visibility: isShared ? "shared_with_partner" : "pv_internal",
    p_referral_id: isShared ? referralId : undefined,
  });

  if (error) {
    return { error: "Aktivite kaydedilemedi: " + error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  return {};
}

export type QualifyLeadState = {
  error?: string;
};

const qualifyLeadSchema = z.object({
  leadId: z.string().trim().min(1, "Lead bulunamadı."),
  leadScore: optionalEnum(LEAD_SCORE_VALUES, null),
  district: optionalText(200, null),
  address: optionalText(500, null),
  alternatePhone: optionalText(50, null),
  email: optionalText(200, null),
  buildingType: optionalText(100, null),
  roofAreaM2: optionalNumber(null),
  estimatedCapacityKwp: optionalNumber(null),
  poolInterest: optionalEnum(INTEREST_VALUES, null),
  heatPumpInterest: optionalEnum(INTEREST_VALUES, null),
  evInterest: optionalEnum(INTEREST_VALUES, null),
  batteryInterest: optionalEnum(INTEREST_VALUES, null),
  competitorOfferStatus: optionalEnum(COMPETITOR_STATUS_VALUES, null),
  competitorOfferNote: optionalText(2000, null),
  generalNotes: optionalText(2000, null),
});

/**
 * lead_score ve nitelendirme alanları (ilgi, teknik detay, rakip teklifi vb.)
 * korumalı kolon değil (bkz. lead_protected_columns_and_assignment_rpc) —
 * leads_update_pv RLS'i first_call'ın kendi lead'ini (created_by/first_call_user_id)
 * doğrudan update etmesine zaten izin veriyor. qualify_lead RPC'si de bu RLS'e
 * güvenir (SECURITY INVOKER) — mevcut stage'i öğrenmek için ayrı bir SELECT
 * yapmak yerine, stage geçişi (new -> contacted) tek UPDATE'in içinde CASE ile
 * yapılır (bkz. qualify_lead_rpc migration'ı).
 */
export async function qualifyLead(
  _prevState: QualifyLeadState,
  formData: FormData
): Promise<QualifyLeadState> {
  const parsed = qualifyLeadSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    leadScore: String(formData.get("leadScore") ?? ""),
    district: String(formData.get("district") ?? ""),
    address: String(formData.get("address") ?? ""),
    alternatePhone: String(formData.get("alternatePhone") ?? ""),
    email: String(formData.get("email") ?? ""),
    buildingType: String(formData.get("buildingType") ?? ""),
    roofAreaM2: String(formData.get("roofAreaM2") ?? ""),
    estimatedCapacityKwp: String(formData.get("estimatedCapacityKwp") ?? ""),
    poolInterest: String(formData.get("poolInterest") ?? ""),
    heatPumpInterest: String(formData.get("heatPumpInterest") ?? ""),
    evInterest: String(formData.get("evInterest") ?? ""),
    batteryInterest: String(formData.get("batteryInterest") ?? ""),
    competitorOfferStatus: String(formData.get("competitorOfferStatus") ?? ""),
    competitorOfferNote: String(formData.get("competitorOfferNote") ?? ""),
    generalNotes: String(formData.get("generalNotes") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  const { leadId, ...fields } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.rpc("qualify_lead", {
    p_lead_id: leadId,
    p_lead_score: fields.leadScore ?? undefined,
    p_district: fields.district ?? undefined,
    p_address: fields.address ?? undefined,
    p_alternate_phone: fields.alternatePhone ?? undefined,
    p_email: fields.email ?? undefined,
    p_building_type: fields.buildingType ?? undefined,
    p_roof_area_m2: fields.roofAreaM2 ?? undefined,
    p_estimated_capacity_kwp: fields.estimatedCapacityKwp ?? undefined,
    p_pool_interest: fields.poolInterest ?? undefined,
    p_heat_pump_interest: fields.heatPumpInterest ?? undefined,
    p_ev_interest: fields.evInterest ?? undefined,
    p_battery_interest: fields.batteryInterest ?? undefined,
    p_competitor_offer_status: fields.competitorOfferStatus ?? undefined,
    p_competitor_offer_note: fields.competitorOfferNote ?? undefined,
    p_general_notes: fields.generalNotes ?? undefined,
  });

  if (error) {
    return { error: "Görüşme sonucu kaydedilemedi: " + error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/first-call/lead-pool");
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
  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/sales/my-leads");
}

/**
 * DB aşama sırasını doğrulamadığı için (yalnızca enum whitelist'i var)
 * hedef aşama burada NEXT_STAGE tablosundaki tek olası değerle
 * sınırlanıyor, formdan gelen keyfi bir stage değeri kabul edilmiyor.
 * advance_lead_stage RPC'si (leads_update_pv RLS'ine güvenen SECURITY
 * INVOKER) update + write_audit_log'u tek çağrıda sarmalıyor — bkz.
 * add_missing_lead_audit_logs migration'ı.
 */
export async function advanceLeadStage(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const currentStage = String(formData.get("currentStage") ?? "") as LeadStage;
  const nextStage = NEXT_STAGE[currentStage];

  if (!leadId || !nextStage) {
    throw new Error("Geçersiz istek.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_lead_stage", { p_lead_id: leadId, p_next_stage: nextStage });
  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/sales/my-leads");
  revalidatePath("/leads");
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

  if (error) throw new Error(error.message);

  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (offerId) revalidatePath(`/offers/${offerId}`);
  revalidatePath("/offers");
}

/**
 * Partnerin gönderilmiş bir teklif revizyonunu kabul/red etmesi — yetki
 * (yalnızca partner_admin) ve durum kontrolü (yalnızca 'sent') RPC'nin
 * içinde yapılıyor, bkz. respond_to_offer_rpc migration'ı. Nihai satış
 * sonucuna (won/lost) dokunmuyor, bu hâlâ ayrı bir adım.
 */
export async function respondToOffer(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const offerVersionId = String(formData.get("offerVersionId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!offerVersionId || (decision !== "accept" && decision !== "reject")) {
    throw new Error("Geçersiz istek.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_offer", {
    p_offer_version_id: offerVersionId,
    p_decision: decision,
  });

  if (error) throw new Error(error.message);

  if (offerId) revalidatePath(`/offers/${offerId}`);
  revalidatePath("/offers");
}

/**
 * Yalnızca pv_admin çağırabilir (yetki kontrolü soft_delete_lead RPC'sinin
 * içinde) — lead'i kalıcı silmez, deleted_at/deleted_by set eder ve
 * audit_logs'a yazar (bkz. lead_protected_columns_and_assignment_rpc
 * migration'ı). Buton yalnızca admin'e gösterilir.
 */
export async function softDeleteLead(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!leadId) {
    throw new Error("Geçersiz istek.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_lead", {
    p_lead_id: leadId,
    p_reason: reason || undefined,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  redirect("/leads");
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
  revalidatePath("/sales/my-leads");
  revalidatePath("/leads");
  return {};
}

/**
 * 'lost' bir lead'i sabit bir yeniden-giriş noktasına ('contacted')
 * döndürür — yalnızca pv_admin veya lead sahibi pv_sales çağırabilir
 * (kontrol reactivate_lead RPC'sinin içinde).
 */
export async function reactivateLead(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");

  if (!leadId) {
    throw new Error("Geçersiz istek.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_lead", { p_lead_id: leadId });
  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/sales/my-leads");
  revalidatePath("/leads");
}
