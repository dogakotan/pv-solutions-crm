import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

/**
 * Supabase Auth e-postalarındaki (şifre sıfırlama, davet vb.) bağlantının
 * hedefi. `type=recovery` için Supabase Dashboard'daki "Reset Password"
 * e-posta şablonu, session'ın URL fragment'ında (server-side erişilemeyen)
 * dönmesini engellemek amacıyla varsayılan {{ .ConfirmationURL }} yerine
 * bu route'a işaret edecek şekilde güncellenmelidir:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get("next"), "/");

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  redirectTo.pathname = next;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "invalid_reset_link");
  return NextResponse.redirect(redirectTo);
}
