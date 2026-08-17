"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export type SetRatingState = {
  error?: string;
};

export async function setPartnerRating(
  partnerId: string,
  _prevState: SetRatingState,
  formData: FormData
): Promise<SetRatingState> {
  await requireRole(["admin"]);

  const raw = String(formData.get("rating") ?? "").trim();
  const rating = raw === "" ? undefined : Number(raw);

  if (rating !== undefined && (Number.isNaN(rating) || rating < 0 || rating > 5)) {
    return { error: "Puan 0 ile 5 arasında olmalıdır." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_partner_rating", {
    p_partner_id: partnerId,
    p_rating: rating,
  });

  if (error) {
    return { error: "Puan kaydedilemedi: " + error.message };
  }

  revalidatePath(`/partners/${partnerId}`);
  return {};
}
