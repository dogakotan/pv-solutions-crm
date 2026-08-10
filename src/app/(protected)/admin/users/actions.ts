"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DbRole } from "@/lib/auth/roles";

const DB_ROLES: DbRole[] = ["pv_admin", "pv_sales", "first_call", "partner_admin", "partner_employee"];

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
