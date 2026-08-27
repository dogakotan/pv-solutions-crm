import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOffersOverview } from "@/lib/data/offers";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { OffersOverviewTabs } from "./offers-overview-tabs";

export default function OffersPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Teklifler</h1>
      </SetHeaderContent>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <KpiGridSkeleton count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-3" />
            <TableSkeleton rows={8} />
          </div>
        }
      >
        <OffersContent />
      </Suspense>
    </div>
  );
}

async function OffersContent() {
  const supabase = await createClient();
  const offers = await getOffersOverview(supabase, 500);

  return <OffersOverviewTabs offers={offers} />;
}
