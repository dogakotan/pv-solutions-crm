import { Suspense } from "react";
import { Users, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { TodayActionsCard } from "@/components/today-actions-card";
import { ActionItemsTable } from "@/components/action-items-table";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { getSalesLeadKpis, getVisibleLeads, getActionItems } from "@/lib/data/leads";
import { getActivitiesDueInRange } from "@/lib/data/activities";

export default function SalesDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Genel Bakış</h1>
      </SetHeaderContent>

      <Suspense fallback={<KpiGridSkeleton count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-4 [&>*:last-child]:sm:col-span-2" />}>
        <SalesKpiGrid />
      </Suspense>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Aksiyon Gerektirenler</h2>
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <SalesActionItemsSection />
        </Suspense>
      </div>
    </div>
  );
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function SalesKpiGrid() {
  const supabase = await createClient();
  const { start, end } = todayRange();
  const [kpis, leads, todayActivities] = await Promise.all([
    getSalesLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
    getActivitiesDueInRange(supabase, start, end),
  ]);
  const newLeadCount = leads.filter((lead) => lead.stage === "new").length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <StatCard icon={Users} label="Toplam Lead" value={String(kpis.total)} />
      <StatCard icon={UserPlus} label="Yeni Lead" value={String(newLeadCount)} />
      <TodayActionsCard activities={todayActivities} className="sm:col-span-2" />
    </div>
  );
}

async function SalesActionItemsSection() {
  const supabase = await createClient();
  const items = await getActionItems(supabase);

  return <ActionItemsTable items={items} />;
}
