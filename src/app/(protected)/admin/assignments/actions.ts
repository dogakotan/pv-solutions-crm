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

  revalidatePath("/admin/assignments");
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

  revalidatePath("/admin/assignments");

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    throw new Error(`${failed.length} lead atanamadı: ${failed[0].error?.message}`);
  }
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
  if (error) throw new Error(error.message);

  revalidatePath("/admin/assignments");
}

export async function assignManyToPartner(leadIds: string[], partnerId: string) {
  if (!partnerId) {
    throw new Error("Partner seçilmedi");
  }
  if (leadIds.length === 0) return;

  const supabase = await createClient();
  const results = await Promise.all(
    leadIds.map((leadId) =>
      supabase.rpc("assign_lead_to_partner", { p_lead_id: leadId, p_partner_id: partnerId })
    )
  );

  revalidatePath("/admin/assignments");

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    throw new Error(`${failed.length} lead atanamadı: ${failed[0].error?.message}`);
  }
}
