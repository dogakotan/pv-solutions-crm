"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import type { PartnerStatus } from "@/types/partner";

export type CreatePartnerState = {
  error?: string;
};

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

const PARTNER_STATUSES: PartnerStatus[] = ["candidate", "active", "suspended", "inactive"];

const newPartnerSchema = z.object({
  name: z.string().trim().min(2, "Firma adı en az 2 karakter olmalıdır.").max(200),
  city: z.string().trim().min(2, "Şehir en az 2 karakter olmalıdır.").max(100),
  partnerCode: optionalTrimmed(50),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]{0,20}$/, "Telefon numarası geçersiz.")
    .transform((v) => v || null)
    .nullable(),
  taxNumber: z
    .string()
    .trim()
    .regex(/^(\d{10}|\d{11})?$/, "Vergi numarası 10 veya 11 hane olmalıdır.")
    .transform((v) => v || null)
    .nullable(),
  taxOffice: optionalTrimmed(200),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-posta adresi geçersiz.")
    .transform((v) => v || null)
    .nullable(),
  address: optionalTrimmed(500),
  status: z.enum(PARTNER_STATUSES as [PartnerStatus, ...PartnerStatus[]]).default("candidate"),
  internalNotes: optionalTrimmed(2000),
  pvOwnerId: optionalTrimmed(100),
});

export async function createPartner(
  _prevState: CreatePartnerState,
  formData: FormData
): Promise<CreatePartnerState> {
  const parsed = newPartnerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    city: String(formData.get("city") ?? ""),
    partnerCode: String(formData.get("partnerCode") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    taxNumber: String(formData.get("taxNumber") ?? ""),
    taxOffice: String(formData.get("taxOffice") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    status: String(formData.get("status") ?? "candidate"),
    internalNotes: String(formData.get("internalNotes") ?? ""),
    pvOwnerId: String(formData.get("pvOwnerId") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  const {
    name,
    city,
    partnerCode,
    phone,
    taxNumber,
    taxOffice,
    email,
    address,
    status,
    internalNotes,
    pvOwnerId,
  } = parsed.data;

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı." };
  }

  const supabase = await createClient();

  const serviceRegions = splitList(formData.get("serviceRegions"));
  const capabilities = splitList(formData.get("capabilities"));
  const applicationAreas = formData.getAll("applicationAreas").map(String);

  const { data: partner, error } = await supabase.rpc("create_partner", {
    p_name: name,
    p_city: city,
    p_partner_code: partnerCode ?? undefined,
    p_phone: phone ?? undefined,
    p_tax_number: taxNumber ?? undefined,
    p_tax_office: taxOffice ?? undefined,
    p_email: email ?? undefined,
    p_address: address ?? undefined,
    p_status: status,
    p_pv_owner_id: pvOwnerId ?? undefined,
    p_internal_notes: internalNotes ?? undefined,
    p_service_regions: serviceRegions,
    p_capability_codes: [...capabilities, ...applicationAreas],
  });

  if (error || !partner) {
    return { error: "Partner oluşturulamadı: " + (error?.message ?? "bilinmeyen hata") };
  }

  redirect(`/partners/${partner.id}`);
}
