"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function acceptReferral(formData: FormData): Promise<{ error?: string }> {
  const referralId = String(formData.get("referralId"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_referral", {
    p_referral_id: referralId,
    p_decision: "accept",
  });
  if (error) return { error: error.message };

  revalidatePath("/partner/assigned-leads");
  return {};
}

export async function rejectReferral(formData: FormData): Promise<{ error?: string }> {
  const referralId = String(formData.get("referralId"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    return { error: "Ret için bir gerekçe girilmelidir" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_referral", {
    p_referral_id: referralId,
    p_decision: "reject",
    p_rejection_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath("/partner/assigned-leads");
  return {};
}
