import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ActionItemsTable } from "@/components/action-items-table";
import { FirstCallKpiGrid } from "@/components/first-call-kpi-grid";
import { KpiGridSkeleton, TableSkeleton, CardSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { getActionItems, getFirstCallQualifiedTrend } from "@/lib/data/leads";

export default function FirstCallDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Genel Bakış</h1>
      </SetHeaderContent>

      <Suspense
        fallback={
          <KpiGridSkeleton count={5} className="grid grid-cols-1 gap-4 sm:grid-cols-4 [&>*:last-child]:sm:col-span-2" />
        }
      >
        <FirstCallKpiGrid />
      </Suspense>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Aksiyon Gerektirenler</h2>
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <FirstCallActionItemsSection />
        </Suspense>
      </div>

      <Suspense fallback={<CardSkeleton lines={6} />}>
        <QualifiedTrendCard />
      </Suspense>
    </div>
  );
}

async function FirstCallActionItemsSection() {
  const supabase = await createClient();
  const items = await getActionItems(supabase);

  return <ActionItemsTable items={items} />;
}

async function QualifiedTrendCard() {
  const supabase = await createClient();
  const trend = await getFirstCallQualifiedTrend(supabase);
  const trendMax = Math.max(1, ...trend.map((t) => t.qualifiedCount));

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-medium text-foreground">Haftalık Nitelendirme Performansım</h2>
      {trend.length === 0 ? (
        <p className="text-sm text-muted">Henüz nitelendirilmiş bir lead yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {trend.map((t) => (
            <div key={t.weekStart} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-xs text-muted">
                {new Date(t.weekStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
              </div>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(t.qualifiedCount / trendMax) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm text-foreground">{t.qualifiedCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
