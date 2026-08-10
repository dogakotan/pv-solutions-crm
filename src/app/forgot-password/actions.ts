"use server";

import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  message?: string;
  error?: string;
};

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "E-posta zorunludur." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  // Kayıtlı olmayan bir e-postanın var/yok bilgisini sızdırmamak için
  // sonuç her durumda aynı mesajla dönüyor.
  return {
    message: "Bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.",
  };
}
