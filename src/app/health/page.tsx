import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export default function HealthPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
      <h1 className="text-2xl font-semibold">PV Solutions CRM — Sistem Sağlık Kontrolü</h1>
      <Suspense fallback={<p className="text-lg">Kontrol ediliyor...</p>}>
        <ConnectionStatus />
      </Suspense>
    </main>
  );
}

async function ConnectionStatus() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let connectionStatus: "ok" | "error" | "not_configured" = "not_configured";
  let errorMessage: string | null = null;

  if (envUrl && envKey && !envUrl.includes("xxxxxxxxxxxx")) {
    try {
      const supabase = await createClient();
      // Gerçek bağlantı doğrulaması: oturum yoksa da bu çağrı
      // Supabase Auth sunucusuna ulaşıp ulaşamadığımızı gösterir.
      const { error } = await supabase.auth.getSession();
      connectionStatus = error ? "error" : "ok";
      errorMessage = error?.message ?? null;
    } catch (err) {
      connectionStatus = "error";
      errorMessage = err instanceof Error ? err.message : "Bilinmeyen hata";
    }
  }

  const statusLabel: Record<typeof connectionStatus, string> = {
    ok: "✅ Supabase bağlantısı çalışıyor",
    error: "❌ Supabase bağlantı hatası",
    not_configured: "⚠️ Supabase ortam değişkenleri henüz ayarlanmadı",
  };

  return (
    <>
      <p className="text-lg">{statusLabel[connectionStatus]}</p>
      {errorMessage && (
        <p className="max-w-xl text-center text-sm text-red-600">{errorMessage}</p>
      )}
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-neutral-600">
        <dt className="font-medium">NEXT_PUBLIC_SUPABASE_URL</dt>
        <dd>{envUrl ? "tanımlı" : "tanımlı değil"}</dd>
        <dt className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY</dt>
        <dd>{envKey ? "tanımlı" : "tanımlı değil"}</dd>
        <dt className="font-medium">Node.js</dt>
        <dd>{process.version}</dd>
      </dl>
    </>
  );
}
