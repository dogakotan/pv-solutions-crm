import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ActivityFeedItem } from "@/lib/data/activities";
import {
  addMonths,
  formatMonthLabel,
  getMonthGrid,
  isSameDay,
  toMonthParam,
  WEEKDAY_SHORT_LABELS,
} from "./calendar-utils";

const MAX_VISIBLE_PER_DAY = 3;

export function MonthlyCalendar({
  activities,
  monthStart,
  canOpenLead,
}: {
  activities: ActivityFeedItem[];
  monthStart: Date;
  canOpenLead: boolean;
}) {
  const today = new Date();
  const days = getMonthGrid(monthStart);
  const isCurrentMonth =
    monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth();

  const prevMonthHref = `/activities?view=calendar&mode=month&month=${toMonthParam(addMonths(monthStart, -1))}`;
  const nextMonthHref = `/activities?view=calendar&mode=month&month=${toMonthParam(addMonths(monthStart, 1))}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={prevMonthHref}
            aria-label="Önceki ay"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-border hover:bg-background"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={nextMonthHref}
            aria-label="Sonraki ay"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-border hover:bg-background"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-sm font-medium text-foreground">{formatMonthLabel(monthStart)}</span>
        </div>

        {!isCurrentMonth && (
          <Link
            href="/activities?view=calendar&mode=month"
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm hover:bg-background"
          >
            Bu ay
          </Link>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-card-border bg-card-border text-xs">
        {WEEKDAY_SHORT_LABELS.map((label) => (
          <div
            key={label}
            className="bg-background px-2 py-2 text-center font-medium uppercase tracking-wide text-muted"
          >
            {label}
          </div>
        ))}

        {days.map((day, index) => {
          const dayActivities = activities.filter(
            (activity) => activity.nextFollowUpAt && isSameDay(new Date(activity.nextFollowUpAt), day)
          );
          const isToday = isSameDay(day, today);
          const inMonth = day.getMonth() === monthStart.getMonth();
          const visible = dayActivities.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayActivities.length - visible.length;

          return (
            <div key={index} className={`flex min-h-28 flex-col gap-1 bg-card p-1.5 ${inMonth ? "" : "bg-background/60"}`}>
              <span
                className={
                  isToday
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white"
                    : `text-[11px] font-medium ${inMonth ? "text-foreground" : "text-muted"}`
                }
              >
                {day.getDate()}
              </span>

              <div className="flex flex-col gap-0.5">
                {visible.map((activity) => {
                  const time = activity.nextFollowUpAt
                    ? new Date(activity.nextFollowUpAt).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  const label = `${time} ${activity.customerName}`.trim();

                  return canOpenLead ? (
                    <Link
                      key={activity.id}
                      href={`/leads/${activity.leadId}`}
                      title={label}
                      className="truncate rounded bg-brand-light px-1 py-0.5 text-[10px] text-brand hover:underline"
                    >
                      {label}
                    </Link>
                  ) : (
                    <div
                      key={activity.id}
                      title={label}
                      className="truncate rounded bg-background px-1 py-0.5 text-[10px] text-muted"
                    >
                      {label}
                    </div>
                  );
                })}
                {overflow > 0 && <span className="px-1 text-[10px] text-muted">+{overflow} daha</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
