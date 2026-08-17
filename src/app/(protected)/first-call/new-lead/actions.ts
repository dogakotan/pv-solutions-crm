"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import {
  INTEREST_VALUES,
  COMPETITOR_STATUS_VALUES,
  LEAD_SCORE_VALUES,
  optionalText,
  optionalNumber,
  optionalEnum,
} from "@/lib/validation/lead-qualification";

export type DuplicateLeadMatch = {
  id: string;
  leadNo: string;
  customerName: string;
  stage: string;
};

export type NewLeadState = {
  error?: string;
  duplicates?: DuplicateLeadMatch[];
};

const newLeadSchema = z.object({
  customerType: z.enum(["individual", "company"]),
  customerName: z.string().trim().min(2, "Müşteri adı en az 2 karakter olmalıdır.").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]{7,20}$/, "Telefon numarası geçersiz."),
  city: z.string().trim().min(2, "Şehir en az 2 karakter olmalıdır.").max(100),
  source: z.string().trim().min(2, "Kaynak en az 2 karakter olmalıdır.").max(200),
  idempotencyKey: z.string().trim().uuid().optional(),
  district: optionalText(200, undefined),
  address: optionalText(500, undefined),
  alternatePhone: optionalText(50, undefined),
  email: optionalText(200, undefined),
  buildingType: optionalText(100, undefined),
  roofAreaM2: optionalNumber(undefined),
  estimatedCapacityKwp: optionalNumber(undefined),
  poolInterest: optionalEnum(INTEREST_VALUES, undefined),
  heatPumpInterest: optionalEnum(INTEREST_VALUES, undefined),
  evInterest: optionalEnum(INTEREST_VALUES, undefined),
  batteryInterest: optionalEnum(INTEREST_VALUES, undefined),
  competitorOfferStatus: optionalEnum(COMPETITOR_STATUS_VALUES, undefined),
  competitorOfferNote: optionalText(2000, undefined),
  generalNotes: optionalText(2000, undefined),
  leadScore: optionalEnum(LEAD_SCORE_VALUES, undefined),
});

const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function createLead(
  _prevState: NewLeadState,
  formData: FormData
): Promise<NewLeadState> {
  const parsed = newLeadSchema.safeParse({
    customerType: String(formData.get("customerType") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    city: String(formData.get("city") ?? ""),
    source: String(formData.get("source") ?? ""),
    idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
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
    leadScore: String(formData.get("leadScore") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  const {
    customerType,
    customerName,
    phone,
    city,
    source,
    idempotencyKey,
    ...qualificationFields
  } = parsed.data;
  const confirmDuplicate = formData.get("confirmDuplicate") === "true";

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı." };
  }

  const supabase = await createClient();

  if (!confirmDuplicate) {
    const { data: matches, error: dupError } = await supabase.rpc("find_duplicate_leads_by_phone", {
      p_phone: phone,
    });

    if (dupError) {
      return { error: "Tekrar kontrolü yapılamadı: " + dupError.message };
    }

    if (matches && matches.length > 0) {
      return {
        duplicates: matches.map((m) => ({
          id: m.id,
          leadNo: m.lead_no ?? "",
          customerName: m.customer_name,
          stage: m.stage,
        })),
      };
    }
  }

  /**
   * Lead insert + idempotency key tüketimi create_lead RPC'sinde tek
   * transaction'da yapılır (bkz. create_lead_rpc migration'ı) — anahtar
   * zaten kullanılmışsa unique_violation ile döner, bu isteğin ağ
   * seviyesinde bir tekrarı olduğunu varsayıp işlemi tekrarlamadan
   * doğrudan başarı sonucuna yönlendiriyoruz.
   */
  const { error } = await supabase.rpc("create_lead", {
    p_customer_type: customerType,
    p_customer_name: customerName,
    p_phone: phone,
    p_city: city,
    p_source: source,
    p_idempotency_key: idempotencyKey,
    p_district: qualificationFields.district,
    p_address: qualificationFields.address,
    p_alternate_phone: qualificationFields.alternatePhone,
    p_email: qualificationFields.email,
    p_building_type: qualificationFields.buildingType,
    p_roof_area_m2: qualificationFields.roofAreaM2,
    p_estimated_capacity_kwp: qualificationFields.estimatedCapacityKwp,
    p_pool_interest: qualificationFields.poolInterest,
    p_heat_pump_interest: qualificationFields.heatPumpInterest,
    p_ev_interest: qualificationFields.evInterest,
    p_battery_interest: qualificationFields.batteryInterest,
    p_competitor_offer_status: qualificationFields.competitorOfferStatus,
    p_competitor_offer_note: qualificationFields.competitorOfferNote,
    p_general_notes: qualificationFields.generalNotes,
    p_lead_score: qualificationFields.leadScore,
  });

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      redirect("/first-call/lead-pool");
    }
    return { error: "Lead oluşturulamadı: " + error.message };
  }

  redirect("/first-call/lead-pool");
}
