import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth-card";
import { logout } from "@/app/(protected)/actions";

export default function AccountDisabledPage() {
  return (
    <AuthCard>
      <Suspense fallback={null}>
        <AuthGate />
      </Suspense>
      <h1 className="mb-2 text-xl font-semibold text-foreground">Hesabınız pasif durumda</h1>
      <p className="mb-6 text-sm text-muted">
        Hesabınız bir yönetici tarafından pasif hâle getirilmiş. Sisteme erişebilmek için
        yöneticinizle iletişime geçin.
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-lg border border-card-border px-4 py-2 text-sm font-medium hover:bg-background"
        >
          Çıkış yap
        </button>
      </form>
    </AuthCard>
  );
}

async function AuthGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return null;
}
