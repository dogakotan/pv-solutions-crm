"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimLead(leadId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_lead", { p_lead_id: leadId });
  if (error) throw new Error(error.message);

  revalidatePath("/first-call/lead-pool");
}
