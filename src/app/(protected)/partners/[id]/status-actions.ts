"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import type { PartnerStatus } from "@/types/partner";

export type SetStatusState = {
  error?: string;
};

const VALID_STATUSES: PartnerStatus[] = ["candidate", "active", "suspended", "inactive"];

export async function setPartnerStatus(
  partnerId: string,
  _prevState: SetStatusState,
  formData: FormData
): Promise<SetStatusState> {
  await requireRole(["admin"]);

  const status = String(formData.get("status") ?? "");
  if (!VALID_STATUSES.includes(status as PartnerStatus)) {
    return { error: "Geçersiz durum." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_partner_status", {
    p_partner_id: partnerId,
    p_status: status,
  });

  if (error) {
    return { error: "Durum kaydedilemedi: " + error.message };
  }

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/partners");
  return {};
}
