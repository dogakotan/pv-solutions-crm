import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <Suspense fallback={null}>
        <AuthGate />
      </Suspense>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Yeni şifre belirle</h1>
      <ResetPasswordForm />
    </AuthCard>
  );
}

async function AuthGate() {
  const userId = await getVerifiedUserId();

  if (!userId) {
    redirect("/login?error=invalid_reset_link");
  }

  return null;
}
