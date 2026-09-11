import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { getSalesLeadKpis, getVisibleLeads } from "@/lib/data/leads";
import { getActivitiesDueInRange } from "@/lib/data/activities";
import { SetHeaderContent } from "@/components/page-header-slot";
import { TruncationNotice } from "@/components/truncation-notice";
import { MyLeadsTabs } from "./my-leads-tabs";

export default function SalesMyLeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Leadlerim</h1>
      </SetHeaderContent>

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
  const [kpis, { leads, totalCount }, todayActivities] = await Promise.all([
    getSalesLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
    getActivitiesDueInRange(supabase, start, end),
  ]);

  return (
    <>
      <TruncationNotice totalCount={totalCount} shown={leads.length} />
      <MyLeadsTabs kpis={kpis} leads={leads} todayActivities={todayActivities} />
    </>
  );
}
