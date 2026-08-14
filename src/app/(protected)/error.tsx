"use client";

import { useEffect } from "react";

export default function ProtectedError({
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
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-card-border bg-card p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Bir şeyler ters gitti</h2>
        <p className="text-sm text-muted">
          Bu sayfa yüklenirken bir hata oluştu. Lütfen tekrar deneyin veya sorun devam ederse
          yöneticinizle iletişime geçin.
        </p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Tekrar dene
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background"
          >
            Genel Bakışa Dön
          </a>
        </div>
      </div>
    </div>
  );
}
