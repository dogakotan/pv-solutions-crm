import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  delta,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-card-border bg-card p-5 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          iconClassName ?? "bg-brand-light text-brand"
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {delta && <p className="text-xs text-green-600">{delta}</p>}
      </div>
    </div>
  );
}
