import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { getSalesLeadKpis, getVisibleLeads } from "@/lib/data/leads";
import { getActivitiesDueInRange } from "@/lib/data/activities";
import { MyLeadsTabs } from "./my-leads-tabs";

export default function SalesMyLeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <KpiGridSkeleton count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-4 [&>*:last-child]:sm:col-span-2" />
            <TableSkeleton rows={8} />
          </div>
        }
      >
        <MyLeadsContent />
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

async function MyLeadsContent() {
  const supabase = await createClient();
  const { start, end } = todayRange();
  const [kpis, leads, todayActivities] = await Promise.all([
    getSalesLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
    getActivitiesDueInRange(supabase, start, end),
  ]);

  return <MyLeadsTabs totalCount={kpis.total} leads={leads} todayActivities={todayActivities} />;
}
