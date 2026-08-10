import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Şifremi unuttum</h1>
      <ForgotPasswordForm />
      <Link
        href="/login"
        className="mt-6 block text-center text-sm text-muted hover:text-brand"
      >
        Giriş sayfasına dön
      </Link>
    </AuthCard>
  );
}
