"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function assignToSales(formData: FormData): Promise<{ error?: string }> {
  const leadId = String(formData.get("leadId"));
  const salesUserId = String(formData.get("salesUserId"));

  if (!salesUserId) {
    return { error: "Satış çalışanı seçilmedi" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_lead_to_sales", {
    p_lead_id: leadId,
    p_sales_user_id: salesUserId,
  });
  if (error) return { error: error.message };

  revalidatePath("/first-call/assignments");
  revalidatePath("/first-call/lead-pool");
  return {};
}

export async function assignManyToSales(leadIds: string[], salesUserId: string): Promise<{ error?: string }> {
  if (!salesUserId) {
    return { error: "Satış çalışanı seçilmedi" };
  }
  if (leadIds.length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_leads_to_sales_batch", {
    p_lead_ids: leadIds,
    p_sales_user_id: salesUserId,
  });

  if (error) {
    return { error: `Toplu atama başarısız oldu, hiçbir lead atanmadı: ${error.message}` };
  }

  revalidatePath("/first-call/assignments");
  revalidatePath("/first-call/lead-pool");
  return {};
}
