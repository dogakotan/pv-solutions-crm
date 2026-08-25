import { Suspense } from "react";
import { Users, UserPlus, Trophy, XCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { TodayActionsCard } from "@/components/today-actions-card";
import { LeadsTable } from "@/components/leads-table";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { getSalesLeadKpis, getVisibleLeads } from "@/lib/data/leads";
import { getActivitiesDueInRange } from "@/lib/data/activities";
import { SetHeaderContent } from "@/components/page-header-slot";

export default function SalesOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Genel Bakış</h1>
      </SetHeaderContent>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <KpiGridSkeleton count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-4 [&>*:last-child]:sm:col-span-2" />
            <KpiGridSkeleton count={4} />
            <TableSkeleton rows={8} />
          </div>
        }
      >
        <SalesOverviewContent />
      </Suspense>
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

async function SalesOverviewContent() {
  const supabase = await createClient();
  const { start, end } = todayRange();
  const [kpis, leads, todayActivities] = await Promise.all([
    getSalesLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
    getActivitiesDueInRange(supabase, start, end),
  ]);

  const newLeads = leads.filter((lead) => lead.stage === "new");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Toplam Lead" value={String(kpis.total)} />
        <StatCard icon={UserPlus} label="Yeni Lead" value={String(newLeads.length)} />
        <TodayActionsCard activities={todayActivities} className="sm:col-span-2" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={Trophy} label="Kazanılan" value={String(kpis.won)} iconClassName="bg-green-50 text-green-700" />
        <StatCard icon={XCircle} label="Kaybedilen" value={String(kpis.lost)} iconClassName="bg-red-50 text-red-700" />
        <StatCard
          icon={TrendingUp}
          label="Dönüşüm Oranı"
          value={`%${kpis.conversionRate}`}
          iconClassName="bg-brand-light text-brand"
        />
        <StatCard
          icon={AlertTriangle}
          label="Partner Yanıtı Gecikmiş"
          value={String(kpis.overduePartner)}
          iconClassName={kpis.overduePartner > 0 ? "bg-red-50 text-red-700" : undefined}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Yeni Atanan Leadler</h2>
        <LeadsTable leads={newLeads} emptyMessage="Şu an ilgilenilmeyi bekleyen yeni bir lead yok." />
      </div>
    </div>
  );
}
