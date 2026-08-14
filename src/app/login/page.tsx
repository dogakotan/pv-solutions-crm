import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_reset_link: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <AuthCard>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Giriş yap</h1>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-background" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const userId = await getVerifiedUserId();

  if (userId) {
    redirect("/dashboard");
  }

  const { next, error } = await searchParams;
  const safeNext = safeRedirectPath(next, "/dashboard");
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <>
      {errorMessage && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
      <LoginForm next={safeNext} />
    </>
  );
}
