"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";

export type UpdateProfileState = {
  error?: string;
  success?: boolean;
};

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Ad soyad zorunludur.").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]{0,20}$/, "Telefon numarası geçersiz."),
});

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const parsed = updateProfileSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  const { fullName, phone: parsedPhone } = parsed.data;
  const phone = parsedPhone || null;

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", userId);

  if (error) {
    return { error: "Profil güncellenemedi: " + error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export type ChangePasswordState = {
  error?: string;
  success?: boolean;
};

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 8) {
    return { error: "Şifre en az 8 karakter olmalıdır." };
  }

  if (password !== passwordConfirm) {
    return { error: "Şifreler eşleşmiyor." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Şifre güncellenemedi: " + error.message };
  }

  return { success: true };
}
