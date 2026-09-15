"use client";

import { useEffect } from "react";

/**
 * (protected)/error.tsx yalnızca /dashboard, /leads vb. korumalı segmenti
 * kapsıyor — /login, /health, /unauthorized, /account-disabled,
 * /forgot-password, /reset-password gibi public route'larda hiçbir
 * error.tsx yoktu (yol haritası 5.6), bu yüzden bir hata doğrudan
 * global-error.tsx'e (kendi ayrı belgesini render eden, global stilleri
 * içermeyen son çare) düşüyordu. Bu dosya kök segmentteki (protected
 * dışındaki) tüm route'ları kapsar.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center py-16">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-card-border bg-card p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Bir şeyler ters gitti</h2>
        <p className="text-sm text-muted">
          Bu sayfa yüklenirken bir hata oluştu. Lütfen tekrar deneyin veya sorun devam ederse
          yöneticinizle iletişime geçin.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Tekrar dene
        </button>
      </div>
    </div>
  );
}
