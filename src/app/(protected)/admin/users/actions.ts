"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import type { DbRole } from "@/lib/auth/roles";

const DB_ROLES: DbRole[] = ["pv_admin", "pv_sales", "first_call", "partner_admin", "partner_employee"];
const STAFF_ROLES = ["pv_admin", "pv_sales", "first_call"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export async function updateUserRole(formData: FormData) {
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));

  if (!DB_ROLES.includes(role as DbRole)) {
    throw new Error("Geçersiz rol");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role as DbRole });
  if (error) throw error;

  revalidatePath("/admin/users");
}

export async function updateUserActive(formData: FormData) {
  const userId = String(formData.get("userId"));
  const isActive = formData.get("isActive") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_active", { p_user_id: userId, p_is_active: isActive });
  if (error) throw error;

  revalidatePath("/admin/users");
}

export type CreateStaffUserState = {
  error?: string;
  tempPassword?: string;
  createdEmail?: string;
};

function generateTempPassword(): string {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

export async function createStaffUser(
  _prevState: CreateStaffUserState,
  formData: FormData
): Promise<CreateStaffUserState> {
  await requireRole(["admin"]);

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");

  if (!fullName || !email) {
    return { error: "Ad soyad ve e-posta zorunludur." };
  }
  if (!STAFF_ROLES.includes(role as StaffRole)) {
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

  const { error: provisionError } = await supabase.rpc("provision_staff_user", {
    p_user_id: userId,
    p_role: role as StaffRole,
    p_phone: phone ?? undefined,
  });

  if (provisionError) {
    await admin.auth.admin.deleteUser(userId);
    return {
      error: "Kullanıcı kaydedilemedi, hesap geri alındı: " + provisionError.message,
    };
  }

  revalidatePath("/admin/users");
  return { tempPassword, createdEmail: email };
}
