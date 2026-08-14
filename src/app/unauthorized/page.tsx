import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import { AuthCard } from "@/components/auth-card";
import { logout } from "@/app/(protected)/actions";

export default function UnauthorizedPage() {
  return (
    <AuthCard>
      <Suspense fallback={null}>
        <AuthGate />
      </Suspense>
      <h1 className="mb-2 text-xl font-semibold text-foreground">Yetkiniz yok</h1>
      <p className="mb-6 text-sm text-muted">
        Bu sayfayı görüntüleme yetkiniz bulunmuyor, ya da hesabınıza henüz bir rol
        atanmamış. Yanlış olduğunu düşünüyorsanız yöneticinizle iletişime geçin.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="w-full rounded-lg bg-brand px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-dark"
        >
          Panelime dön
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            Çıkış yap
          </button>
        </form>
      </div>
    </AuthCard>
  );
}

async function AuthGate() {
  const userId = await getVerifiedUserId();

  if (!userId) {
    redirect("/login");
  }

  return null;
}
