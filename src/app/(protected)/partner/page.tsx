import { Suspense } from "react";
import { Users, Clock, AlertTriangle, ClipboardList, FileText, Handshake, Trophy, XCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { ActionItemsTable } from "@/components/action-items-table";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { getPartnerReferralKpis, getActionItems } from "@/lib/data/leads";

export default function PartnerDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Genel Bakış</h1>
      </SetHeaderContent>

      <Suspense fallback={<KpiGridSkeleton count={9} />}>
        <PartnerKpiGrid />
      </Suspense>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Aksiyon Gerektirenler</h2>
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <PartnerActionItemsSection />
        </Suspense>
      </div>
    </div>
  );
}

async function PartnerKpiGrid() {
  const supabase = await createClient();
  const kpis = await getPartnerReferralKpis(supabase);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <StatCard icon={Users} label="Toplam" value={String(kpis.total)} />
      <StatCard icon={Clock} label="Görüşme Bekleyen" value={String(kpis.pending)} />
      <StatCard icon={AlertTriangle} label="Süresi Geçen" value={String(kpis.overdue)} iconClassName="bg-red-50 text-red-700" />
      <StatCard icon={ClipboardList} label="Keşif Planlanan" value={String(kpis.surveyPlanned)} />
      <StatCard icon={FileText} label="Teklif Hazırlanacak" value={String(kpis.proposalPreparing)} />
      <StatCard icon={Handshake} label="Pazarlıkta" value={String(kpis.negotiation)} />
      <StatCard icon={Trophy} label="Başarılı" value={String(kpis.completed)} iconClassName="bg-green-50 text-green-700" />
      <StatCard icon={XCircle} label="Başarısız" value={String(kpis.unsuccessful)} iconClassName="bg-red-50 text-red-700" />
      <StatCard icon={TrendingUp} label="Dönüşüm Oranı" value={`%${kpis.conversionRate}`} iconClassName="bg-brand-light text-brand" />
    </div>
  );
}

async function PartnerActionItemsSection() {
  const supabase = await createClient();
  const [{ appRole }, items] = await Promise.all([getCurrentUserRole(), getActionItems(supabase)]);

  return <ActionItemsTable items={items} canOpenLead={appRole !== "partner"} />;
}
