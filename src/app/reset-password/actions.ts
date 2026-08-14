"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";

export type ResetPasswordState = {
  error?: string;
};

export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 8) {
    return { error: "Şifre en az 8 karakter olmalıdır." };
  }

  if (password !== passwordConfirm) {
    return { error: "Şifreler eşleşmiyor." };
  }

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı. Lütfen sıfırlama bağlantısını yeniden isteyin." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Şifre güncellenemedi. Lütfen tekrar deneyin." };
  }

  redirect("/dashboard");
}
