import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { getVisibleActivities, getActivitiesDueInRange } from "@/lib/data/activities";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { ListChecks } from "lucide-react";
import { ActivitiesList } from "./activities-list";
import { WeeklyAgenda } from "./weekly-agenda";
import { addDays, parseWeekParam } from "./week-utils";

const TABS = [
  { key: "agenda", label: "Ajanda" },
  { key: "list", label: "Tüm Aktiviteler" },
] as const;

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string }>;
}) {
  const { appRole } = await getCurrentUserRole();
  const supabase = await createClient();
  const { view: viewParam, week: weekParam } = await searchParams;
  const view = viewParam === "list" ? "list" : "agenda";

  // Lead detay sayfası (/leads/[id]) yalnızca admin/first_call/sales'e açık
  // (internal_notes/phone gibi partnere hiç gösterilmemesi gereken alanlar
  // içeriyor) — partner burada lead'e tıklayamaz, düz metin görür.
  const canOpenLead = appRole !== "partner";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Aktiviteler</h1>

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

      {view === "agenda" ? (
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <WeeklyAgendaSection supabase={supabase} weekParam={weekParam} canOpenLead={canOpenLead} />
        </Suspense>
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
