import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getPartners, getRecentPartnerActivity } from "@/lib/data/partners";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { PartnersOverviewTabs } from "./partners-overview-tabs";

export default async function PartnersPage() {
  const { appRole } = await requireRole(["admin", "sales"]);
  const canManagePartners = appRole === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Partnerler</h1>
          <p className="text-sm text-muted">Bayi ve iş ortağı firmalar</p>
        </div>
        {canManagePartners && (
          <Link
            href="/partners/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Yeni Partner
          </Link>
        )}
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <KpiGridSkeleton count={4} />
            <TableSkeleton rows={8} />
          </div>
        }
      >
        <PartnersContent />
      </Suspense>
    </div>
  );
}

async function PartnersContent() {
  const supabase = await createClient();
  const [partners, recentActivity] = await Promise.all([
    getPartners(supabase),
    getRecentPartnerActivity(supabase),
  ]);

  return <PartnersOverviewTabs partners={partners} recentActivity={recentActivity} />;
}
