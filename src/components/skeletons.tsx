export function KpiGridSkeleton({
  count = 4,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
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
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="border-b border-card-border p-4 last:border-0">
          <div className="h-4 w-full animate-pulse rounded bg-background" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-background" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, row) => (
          <div key={row} className="h-4 w-full animate-pulse rounded bg-background" />
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ cards = 4, rowsPerCard = 4 }: { cards?: number; rowsPerCard?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: cards }).map((_, index) => (
        <CardSkeleton key={index} lines={rowsPerCard} />
      ))}
    </div>
  );
}
