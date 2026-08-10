"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/types/lead";

export async function setLeadStage(formData: FormData) {
  const leadId = String(formData.get("leadId"));
  const stage = String(formData.get("stage")) as LeadStage;

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ stage }).eq("id", leadId);
  if (error) throw error;

  revalidatePath("/sales/pipeline");
}
