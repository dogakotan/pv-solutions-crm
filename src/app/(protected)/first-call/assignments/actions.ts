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
  if (error) throw new Error(error.message);

  revalidatePath("/first-call/assignments");
  revalidatePath("/first-call/lead-pool");
}

export async function assignManyToSales(leadIds: string[], salesUserId: string) {
  if (!salesUserId) {
    throw new Error("Satış çalışanı seçilmedi");
  }
  if (leadIds.length === 0) return;

  const supabase = await createClient();
  const results = await Promise.all(
    leadIds.map((leadId) =>
      supabase.rpc("assign_lead_to_sales", { p_lead_id: leadId, p_sales_user_id: salesUserId })
    )
  );

  revalidatePath("/first-call/assignments");
  revalidatePath("/first-call/lead-pool");

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    throw new Error(`${failed.length} lead atanamadı: ${failed[0].error?.message}`);
  }
}
