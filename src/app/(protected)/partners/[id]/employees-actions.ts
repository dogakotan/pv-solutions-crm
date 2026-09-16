"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateEmployeeState = {
  error?: string;
  tempPassword?: string;
  createdEmail?: string;
};

function generateTempPassword(): string {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

export async function createPartnerEmployee(
  partnerId: string,
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  await requireRole(["admin"]);

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");

  if (!fullName || !email) {
    return { error: "Ad soyad ve e-posta zorunludur." };
  }
  if (role !== "partner_admin" && role !== "partner_employee") {
    return { error: "Geçersiz rol." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Admin istemcisi oluşturulamadı." };
  }

  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return { error: "Hesap oluşturulamadı: " + (createError?.message ?? "bilinmeyen hata") };
  }

  const userId = created.user.id;
  const supabase = await createClient();

  const { error: provisionError } = await supabase.rpc("provision_partner_employee", {
    p_user_id: userId,
    p_partner_id: partnerId,
    p_phone: phone ?? undefined,
    p_role: role as "partner_admin" | "partner_employee",
  });

  if (provisionError) {
    await admin.auth.admin.deleteUser(userId);
    return {
      error: "Çalışan kaydedilemedi, hesap geri alındı: " + provisionError.message,
    };
  }

  revalidatePath(`/partners/${partnerId}`);
  return { tempPassword, createdEmail: email };
}

/**
 * set_user_active RPC'si zaten herhangi bir profile için çalışıyor
 * (yalnızca çağıranın pv_admin olmasını kontrol ediyor) — partner
 * çalışanı/yöneticisi için ayrı bir RPC gerekmiyordu, eksik olan
 * yalnızca bu UI kontrolüydü.
 */
export async function setPartnerEmployeeActive(
  partnerId: string,
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole(["admin"]);

  const userId = String(formData.get("userId") ?? "");
  const isActive = formData.get("isActive") === "true";

  if (!userId) {
    return { error: "Geçersiz istek." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_active", { p_user_id: userId, p_is_active: isActive });
  if (error) return { error: error.message };

  revalidatePath(`/partners/${partnerId}`);
  return {};
}
