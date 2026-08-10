"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

export async function createActivity(
  _prevState: CreateActivityState,
  formData: FormData
): Promise<CreateActivityState> {
  const leadId = String(formData.get("leadId") ?? "");
  const activityType = String(formData.get("activityType") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const nextFollowUpAtRaw = String(formData.get("nextFollowUpAt") ?? "").trim();
  const shareWithPartner = formData.get("shareWithPartner") === "on";
  const referralId = String(formData.get("referralId") ?? "").trim();

  if (!leadId || !VALID_TYPES.includes(activityType as ActivityType) || !title) {
    return { error: "Tür ve başlık zorunludur." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

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
    created_by: user.id,
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

  if (outcome === "won" && (!offerVersionId || !finalAmountRaw || !currency)) {
    return { error: "Kazanılan satış için teklif revizyonu, tutar ve para birimi zorunludur." };
  }

  if (outcome === "lost" && !lostReason) {
    return { error: "Kaybedilen satış için bir gerekçe girilmelidir." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_sales_outcome", {
    p_lead_id: leadId,
    p_outcome: outcome,
    p_accepted_offer_version_id: outcome === "won" ? offerVersionId : undefined,
    p_final_amount: outcome === "won" ? Number(finalAmountRaw) : undefined,
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
