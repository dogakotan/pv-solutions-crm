import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireRole, getCurrentUserRole } from "@/lib/auth/require-role";
import { getDefaultRouteForRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getSalesLeadKpis, getVisibleLeads } from "@/lib/data/leads";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { LeadsOverviewTabs } from "./leads-overview-tabs";

/**
 * Yalnızca admin buraya gelir (bkz. requireRole altında). Diğer roller
 * (first_call/sales/partner) kendi tek-amaçlı sayfasına yönlenmeye
 * devam eder — bu sayfa onların yerini almıyor, admin'in üç ayrı sayfa
 * arasında gezinmek yerine tek yerden görebilmesi için var.
 */
export default async function LeadsPage() {
  const { appRole } = await getCurrentUserRole();

  if (appRole !== "admin") {
    redirect(getDefaultRouteForRole(appRole));
  }

  await requireRole(["admin"]);

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Leadler</h1>
      </SetHeaderContent>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <KpiGridSkeleton count={2} className="grid grid-cols-1 gap-4 sm:grid-cols-2" />
            <TableSkeleton rows={8} />
          </div>
        }
      >
        <LeadsOverviewContent />
      </Suspense>
    </div>
  );
}

async function LeadsOverviewContent() {
  const supabase = await createClient();
  const [salesKpis, leads] = await Promise.all([
    getSalesLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
  ]);

  return <LeadsOverviewTabs salesKpis={salesKpis} leads={leads} />;
}
