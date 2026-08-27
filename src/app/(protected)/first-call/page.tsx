import { Suspense } from "react";
import { UserPlus, PhoneCall, MessageCircle, HelpCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { ActionItemsTable } from "@/components/action-items-table";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { getFirstCallLeadKpis, getActionItems } from "@/lib/data/leads";

export default function FirstCallDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Genel Bakış</h1>
      </SetHeaderContent>

      <Suspense fallback={<KpiGridSkeleton count={5} />}>
        <FirstCallKpiGrid />
      </Suspense>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Aksiyon Gerektirenler</h2>
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <FirstCallActionItemsSection />
        </Suspense>
      </div>
    </div>
  );
}

async function FirstCallKpiGrid() {
  const supabase = await createClient();
  const kpis = await getFirstCallLeadKpis(supabase);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard icon={UserPlus} label="Yeni Atanan" value={String(kpis.newAssigned)} />
      <StatCard icon={PhoneCall} label="Bugün Aranacak" value={String(kpis.dueToday)} />
      <StatCard icon={MessageCircle} label="Görüşme Tamamlanan" value={String(kpis.contacted)} />
      <StatCard icon={HelpCircle} label="Puanlama Bekleyen" value={String(kpis.unscored)} />
      <StatCard icon={Send} label="Satışa Aktarılacak" value={String(kpis.readyForSales)} />
    </div>
  );
}

async function FirstCallActionItemsSection() {
  const supabase = await createClient();
  const items = await getActionItems(supabase);

  return <ActionItemsTable items={items} />;
}
