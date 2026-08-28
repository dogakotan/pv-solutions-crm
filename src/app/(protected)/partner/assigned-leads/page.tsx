import { Suspense } from "react";
import { Users, Clock, AlertTriangle, ClipboardList, FileText, Handshake, Trophy, XCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { getPartnerReferralKpis, getVisiblePartnerReferrals } from "@/lib/data/leads";
import { SetHeaderContent } from "@/components/page-header-slot";
import { acceptReferral, rejectReferral } from "./actions";
import { ReferralsTable } from "./referrals-table";

export default function PartnerAssignedLeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Bana Yönlendirilen Müşteriler</h1>
      </SetHeaderContent>

      <Suspense fallback={<KpiGridSkeleton count={9} />}>
        <ReferralKpiGrid />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={8} />}>
        <ReferralsTableSection />
      </Suspense>
    </div>
  );
}

async function ReferralKpiGrid() {
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

async function ReferralsTableSection() {
  const supabase = await createClient();
  const referrals = await getVisiblePartnerReferrals(supabase);

  return <ReferralsTable referrals={referrals} acceptAction={acceptReferral} rejectAction={rejectReferral} />;
}
