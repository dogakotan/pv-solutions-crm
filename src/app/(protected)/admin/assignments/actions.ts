"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function assignToSales(formData: FormData) {
  const leadId = String(formData.get("leadId"));
  const salesUserId = String(formData.get("salesUserId"));

  if (!salesUserId) {
    throw new Error("Satış çalışanı seçilmedi");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_lead_to_sales", {
    p_lead_id: leadId,
    p_sales_user_id: salesUserId,
  });
  if (error) throw error;

  revalidatePath("/admin/assignments");
}

export async function assignToPartner(formData: FormData) {
  const leadId = String(formData.get("leadId"));
  const partnerId = String(formData.get("partnerId"));

  if (!partnerId) {
    throw new Error("Partner seçilmedi");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_lead_to_partner", {
    p_lead_id: leadId,
    p_partner_id: partnerId,
  });
  if (error) throw error;

  revalidatePath("/admin/assignments");
}
