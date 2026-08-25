import Link from "next/link";
import { ListChecks } from "lucide-react";
import type { ActivityFeedItem } from "@/lib/data/activities";
import { ActivityTypeBadge } from "@/components/activity-badges";

export function TodayActionsCard({
  activities,
  className,
}: {
  activities: ActivityFeedItem[];
  className?: string;
}) {
  const sorted = [...activities].sort((a, b) =>
    (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? "")
  );

  return (
    <div
      className={`flex flex-col rounded-2xl border border-card-border bg-card p-5 shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted">Bugünkü Aksiyonlar</p>
          <p className="text-2xl font-semibold text-foreground">{sorted.length}</p>
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2 overflow-y-auto border-t border-card-border pt-4">
          {sorted.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <ActivityTypeBadge type={activity.activityType} />
                <Link href={`/leads/${activity.leadId}`} className="truncate text-brand hover:underline">
                  {activity.customerName}
                </Link>
              </div>
              <span className="whitespace-nowrap text-muted">
                {activity.nextFollowUpAt
                  ? new Date(activity.nextFollowUpAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 border-t border-card-border pt-4 text-xs text-muted">
          Bugün için planlanmış bir aksiyon yok.
        </p>
      )}
    </div>
  );
}
