import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { LeadListItem } from "@/lib/data/leads";

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function TodayFollowUpCard({ dueToday, leads }: { dueToday: number; leads: LeadListItem[] }) {
  const today = new Date();
  const todayLeads = leads
    .filter((lead) => lead.nextFollowUpAt && isSameLocalDay(new Date(lead.nextFollowUpAt), today))
    .sort((a, b) => (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""));

  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted">Bugünkü Takip</p>
          <p className="text-2xl font-semibold text-foreground">{dueToday}</p>
        </div>
      </div>

      {todayLeads.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-card-border pt-4">
          {todayLeads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between gap-2 text-xs">
              <Link href={`/leads/${lead.id}`} className="truncate text-brand hover:underline">
                {lead.customerName}
              </Link>
              <span className="whitespace-nowrap text-muted">
                {new Date(lead.nextFollowUpAt as string).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
