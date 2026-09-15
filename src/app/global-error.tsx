"use client";

import { useEffect } from "react";
// global-error kendi ayrı belgesini render eder ve layout.tsx'teki
// globals.css import'unu miras almaz (bkz. Next.js error.js dokümanı,
// "Good to know" notu) — bu yüzden burada ayrıca import ediliyor,
// aksi halde bu son çare ekranı stilsiz/çıplak HTML olarak görünür.
import "./globals.css";

export default function GlobalError({
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
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center gap-3 bg-background font-sans">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-card-border bg-card p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Bir şeyler ters gitti</h2>
          <p className="text-sm text-muted">
            Uygulama yüklenirken beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
