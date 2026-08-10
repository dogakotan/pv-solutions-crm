"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function acceptReferral(formData: FormData) {
  const referralId = String(formData.get("referralId"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_referral", {
    p_referral_id: referralId,
    p_decision: "accept",
  });
  if (error) throw error;

  revalidatePath("/partner/assigned-leads");
}

export async function rejectReferral(formData: FormData) {
  const referralId = String(formData.get("referralId"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    throw new Error("Ret için bir gerekçe girilmelidir");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_referral", {
    p_referral_id: referralId,
    p_decision: "reject",
    p_rejection_reason: reason,
  });
  if (error) throw error;

  revalidatePath("/partner/assigned-leads");
}
