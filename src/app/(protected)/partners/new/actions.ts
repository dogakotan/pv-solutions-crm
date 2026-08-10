"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreatePartnerState = {
  error?: string;
};

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createPartner(
  _prevState: CreatePartnerState,
  formData: FormData
): Promise<CreatePartnerState> {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  if (!name || !city) {
    return { error: "Firma adı ve şehir zorunludur." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const partnerCode = String(formData.get("partnerCode") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const taxNumber = String(formData.get("taxNumber") ?? "").trim() || null;
  const taxOffice = String(formData.get("taxOffice") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "candidate");
  const internalNotes = String(formData.get("internalNotes") ?? "").trim() || null;
  const pvOwnerId = String(formData.get("pvOwnerId") ?? "").trim() || null;

  const serviceRegions = splitList(formData.get("serviceRegions"));
  const capabilities = splitList(formData.get("capabilities"));
  const applicationAreas = formData.getAll("applicationAreas").map(String);

  const { data: partner, error } = await supabase
    .from("partners")
    .insert({
      name,
      partner_code: partnerCode,
      phone,
      tax_number: taxNumber,
      tax_office: taxOffice,
      email,
      city,
      address,
      status,
      pv_owner_id: pvOwnerId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !partner) {
    return { error: "Partner oluşturulamadı: " + (error?.message ?? "bilinmeyen hata") };
  }

  if (internalNotes) {
    const { error: noteError } = await supabase
      .from("partner_internal_notes")
      .insert({ partner_id: partner.id, note: internalNotes });
    if (noteError) {
      return { error: "Partner oluşturuldu ama iç not kaydedilemedi: " + noteError.message };
    }
  }

  if (serviceRegions.length > 0) {
    const { error: regionsError } = await supabase
      .from("partner_service_regions")
      .insert(serviceRegions.map((region_code) => ({ partner_id: partner.id, region_code })));
    if (regionsError) {
      return { error: "Partner oluşturuldu ama hizmet bölgeleri kaydedilemedi: " + regionsError.message };
    }
  }

  const allCapabilityCodes = [...capabilities, ...applicationAreas];
  if (allCapabilityCodes.length > 0) {
    const { error: capsError } = await supabase
      .from("partner_capabilities")
      .insert(allCapabilityCodes.map((capability_code) => ({ partner_id: partner.id, capability_code })));
    if (capsError) {
      return { error: "Partner oluşturuldu ama yetkinlik/uygulama alanı kaydedilemedi: " + capsError.message };
    }
  }

  redirect(`/partners/${partner.id}`);
}
