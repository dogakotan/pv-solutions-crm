import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { getVisibleActivities, getActivitiesDueInRange } from "@/lib/data/activities";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { ListChecks } from "lucide-react";
import { ActivitiesList } from "./activities-list";
import { MonthlyCalendar } from "./monthly-calendar";
import { WeeklyAgenda } from "./weekly-agenda";
import { addDays, getMonthGrid, parseMonthParam, parseWeekParam } from "./calendar-utils";

const TABS = [
  { key: "calendar", label: "Takvim" },
  { key: "list", label: "Tüm Aktiviteler" },
] as const;

const CALENDAR_MODES = [
  { key: "week", label: "Haftalık" },
  { key: "month", label: "Aylık" },
] as const;

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; mode?: string; week?: string; month?: string }>;
}) {
  const { appRole } = await getCurrentUserRole();
  const supabase = await createClient();
  const { view: viewParam, mode: modeParam, week: weekParam, month: monthParam } = await searchParams;
  const view = viewParam === "list" ? "list" : "calendar";
  const mode = modeParam === "month" ? "month" : "week";

  // Lead detay sayfası (/leads/[id]) yalnızca admin/first_call/sales'e açık
  // (internal_notes/phone gibi partnere hiç gösterilmemesi gereken alanlar
  // içeriyor) — partner burada lead'e tıklayamaz, düz metin görür.
  const canOpenLead = appRole !== "partner";

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Takvim</h1>
      </SetHeaderContent>

      <div className="flex gap-1 border-b border-card-border">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/activities?view=${tab.key}`}
            className={
              view === tab.key
                ? "border-b-2 border-brand px-4 py-3 text-sm font-medium text-brand"
                : "border-b-2 border-transparent px-4 py-3 text-sm text-muted hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {view === "calendar" ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 self-start rounded-lg border border-card-border p-1">
            {CALENDAR_MODES.map((m) => (
              <Link
                key={m.key}
                href={`/activities?view=calendar&mode=${m.key}`}
                className={
                  mode === m.key
                    ? "rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-md px-3 py-1.5 text-xs text-muted hover:text-foreground"
                }
              >
                {m.label}
              </Link>
            ))}
          </div>

          {mode === "week" ? (
            <Suspense fallback={<TableSkeleton rows={6} />}>
              <WeeklyAgendaSection supabase={supabase} weekParam={weekParam} canOpenLead={canOpenLead} />
            </Suspense>
          ) : (
            <Suspense fallback={<TableSkeleton rows={6} />}>
              <MonthlyCalendarSection supabase={supabase} monthParam={monthParam} canOpenLead={canOpenLead} />
            </Suspense>
          )}
        </div>
      ) : (
        <Suspense fallback={<TableSkeleton rows={8} />}>
          <ActivitiesListSection supabase={supabase} canOpenLead={canOpenLead} />
        </Suspense>
      )}
    </div>
  );
}

async function WeeklyAgendaSection({
  supabase,
  weekParam,
  canOpenLead,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  weekParam?: string;
  canOpenLead: boolean;
}) {
  const weekStart = parseWeekParam(weekParam);
  const weekEnd = addDays(weekStart, 7);
  const activities = await getActivitiesDueInRange(supabase, weekStart.toISOString(), weekEnd.toISOString());

  return <WeeklyAgenda activities={activities} weekStart={weekStart} canOpenLead={canOpenLead} />;
}

async function MonthlyCalendarSection({
  supabase,
  monthParam,
  canOpenLead,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  monthParam?: string;
  canOpenLead: boolean;
}) {
  const monthStart = parseMonthParam(monthParam);
  const grid = getMonthGrid(monthStart);
  const gridStart = grid[0];
  const gridEnd = addDays(grid[grid.length - 1], 1);
  const activities = await getActivitiesDueInRange(supabase, gridStart.toISOString(), gridEnd.toISOString());

  return <MonthlyCalendar activities={activities} monthStart={monthStart} canOpenLead={canOpenLead} />;
}

async function ActivitiesListSection({
  supabase,
  canOpenLead,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  canOpenLead: boolean;
}) {
  const activities = await getVisibleActivities(supabase, 200);

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Henüz aktivite yok"
        description="Bir lead üzerinde görüşme, not veya görev kaydettiğinizde burada görünecek."
      />
    );
  }

  return <ActivitiesList activities={activities} canOpenLead={canOpenLead} />;
}
