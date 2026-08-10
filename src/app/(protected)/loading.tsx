/**
 * (protected) altındaki tüm sayfalar için otomatik Suspense fallback'i.
 * Next.js bunu layout.tsx'teki {children}'ın etrafına sarar — link'e
 * tıklandığı anda, hedef sayfanın verisi henüz gelmeden bu iskelet
 * gösterilir. Gerçek sorgu süresini kısaltmaz, yalnızca geçişin "hiçbir
 * şey olmuyor" hissini ortadan kaldırır.
 */
export default function ProtectedLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-2xl border border-card-border bg-card p-5 shadow-sm"
          >
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-background" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-20 animate-pulse rounded bg-background" />
              <div className="h-5 w-12 animate-pulse rounded bg-background" />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border-b border-card-border p-4 last:border-0">
            <div className="h-4 w-full animate-pulse rounded bg-background" />
          </div>
        ))}
      </div>
    </div>
  );
}
