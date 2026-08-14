export default function ProtectedNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-card-border bg-card p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Bulunamadı</h2>
        <p className="text-sm text-muted">
          Aradığınız kayıt bulunamadı. Silinmiş veya taşınmış olabilir.
        </p>
        <a
          href="/dashboard"
          className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Genel Bakışa Dön
        </a>
      </div>
    </div>
  );
}
