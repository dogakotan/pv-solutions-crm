import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ActivityFeedItem } from "@/lib/data/activities";
import { ActivityTypeBadge } from "@/components/activity-badges";
import { addDays, formatWeekRangeLabel, getMonday, isSameDay, toDateParam, WEEKDAY_LABELS } from "./week-utils";

export function WeeklyAgenda({
  activities,
  weekStart,
  canOpenLead,
}: {
  activities: ActivityFeedItem[];
  weekStart: Date;
  canOpenLead: boolean;
}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameDay(weekStart, getMonday(today));

  const prevWeekHref = `/activities?view=agenda&week=${toDateParam(addDays(weekStart, -7))}`;
  const nextWeekHref = `/activities?view=agenda&week=${toDateParam(addDays(weekStart, 7))}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={prevWeekHref}
            aria-label="Önceki hafta"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-border hover:bg-background"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={nextWeekHref}
            aria-label="Sonraki hafta"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-border hover:bg-background"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-sm font-medium text-foreground">{formatWeekRangeLabel(weekStart)}</span>
        </div>

        {!isCurrentWeek && (
          <Link
            href="/activities?view=agenda"
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm hover:bg-background"
          >
            Bu hafta
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        {days.map((day, index) => {
          const dayActivities = activities.filter(
            (activity) => activity.nextFollowUpAt && isSameDay(new Date(activity.nextFollowUpAt), day)
          );
          const isToday = isSameDay(day, today);

          return (
            <div
              key={index}
              className={
                isToday
                  ? "flex flex-col gap-2 rounded-2xl border border-brand bg-card p-3"
                  : "flex flex-col gap-2 rounded-2xl border border-card-border bg-card p-3"
              }
            >
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {WEEKDAY_LABELS[index]}
                </p>
                <p className={isToday ? "text-sm font-semibold text-brand" : "text-sm font-semibold text-foreground"}>
                  {day.getDate()}
                </p>
              </div>

              {dayActivities.length === 0 ? (
                <p className="text-xs text-muted">Takip yok</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dayActivities.map((activity) => (
                    <div key={activity.id} className="rounded-xl border border-card-border bg-background p-2 text-xs">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <ActivityTypeBadge type={activity.activityType} />
                        <span className="whitespace-nowrap text-muted">
                          {new Date(activity.nextFollowUpAt as string).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="font-medium text-foreground">{activity.title}</p>
                      <p className="mt-0.5 text-muted">
                        {canOpenLead ? (
                          <Link href={`/leads/${activity.leadId}`} className="text-brand hover:underline">
                            {activity.leadNo}
                          </Link>
                        ) : (
                          activity.leadNo
                        )}
                        {" — "}
                        {activity.customerName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
