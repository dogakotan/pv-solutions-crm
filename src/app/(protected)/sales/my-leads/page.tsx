import { Suspense } from "react";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { TodayFollowUpCard } from "@/components/today-followup-card";
import { LeadsTable } from "@/components/leads-table";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { getSalesLeadKpis, getVisibleLeads } from "@/lib/data/leads";

export default function SalesMyLeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Leadlerim</h1>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <KpiGridSkeleton count={2} className="grid grid-cols-1 gap-4 sm:grid-cols-2" />
            <TableSkeleton rows={8} />
          </div>
        }
      >
        <MyLeadsContent />
      </Suspense>
    </div>
  );
}

async function MyLeadsContent() {
  const supabase = await createClient();
  const [kpis, leads] = await Promise.all([
    getSalesLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={Users} label="Toplam Lead" value={String(kpis.total)} />
        <TodayFollowUpCard dueToday={kpis.dueToday} leads={leads} />
      </div>

      <LeadsTable leads={leads} />
    </div>
  );
}
