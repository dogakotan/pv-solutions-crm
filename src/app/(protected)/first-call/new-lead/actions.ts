"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type DuplicateLeadMatch = {
  id: string;
  leadNo: string;
  customerName: string;
  stage: string;
};

export type NewLeadState = {
  error?: string;
  duplicates?: DuplicateLeadMatch[];
};

export async function createLead(
  _prevState: NewLeadState,
  formData: FormData
): Promise<NewLeadState> {
  const customerType = String(formData.get("customerType") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const confirmDuplicate = formData.get("confirmDuplicate") === "true";

  if (!customerName || !phone || !city || !source) {
    return { error: "Müşteri adı, telefon, şehir ve kaynak zorunludur." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  if (!confirmDuplicate) {
    const { data: matches, error: dupError } = await supabase.rpc("find_duplicate_leads_by_phone", {
      p_phone: phone,
    });

    if (dupError) {
      return { error: "Tekrar kontrolü yapılamadı: " + dupError.message };
    }

    if (matches && matches.length > 0) {
      return {
        duplicates: matches.map((m) => ({
          id: m.id,
          leadNo: m.lead_no ?? "",
          customerName: m.customer_name,
          stage: m.stage,
        })),
      };
    }
  }

  const { error } = await supabase.from("leads").insert({
    customer_type: customerType === "company" ? "company" : "individual",
    customer_name: customerName,
    phone,
    city,
    source,
    owner_id: user.id,
    created_by: user.id,
    first_call_user_id: user.id,
  });

  if (error) {
    return { error: "Lead oluşturulamadı: " + error.message };
  }

  redirect("/first-call/lead-pool");
}
