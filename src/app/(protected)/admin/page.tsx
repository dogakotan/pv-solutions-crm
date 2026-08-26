import { Suspense } from "react";
import { Users, UserPlus, PhoneCall, Handshake, AlertTriangle, ClipboardList, FileText, Trophy, XCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { getAdminLeadKpis, getAdminActionItems } from "@/lib/data/leads";
import { AdminActionItemsTable } from "./admin-action-items-table";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Genel Bakış</h1>

      <Suspense fallback={<KpiGridSkeleton count={11} />}>
        <AdminKpiGrid />
      </Suspense>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Aksiyon Gerektirenler</h2>
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <AdminActionItemsSection />
        </Suspense>
      </div>

      <p className="text-xs text-muted">
        Satış çalışanı ve partner performans kırılımları (kişi bazlı), yeterli veri
        birikince ayrı bir raporlama geçişinde eklenecek.
      </p>
    </div>
  );
}

async function AdminActionItemsSection() {
  const supabase = await createClient();
  const items = await getAdminActionItems(supabase);

  return <AdminActionItemsTable items={items} />;
}

async function AdminKpiGrid() {
  const supabase = await createClient();
  const kpis = await getAdminLeadKpis(supabase);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <StatCard icon={Users} label="Toplam Lead" value={String(kpis.total)} />
      <StatCard icon={UserPlus} label="Yeni Lead" value={String(kpis.newLeads)} />
      <StatCard icon={PhoneCall} label="First Call Bekleyen" value={String(kpis.awaitingFirstCall)} />
      <StatCard icon={Users} label="Satışa Atanan" value={String(kpis.assignedToSales)} />
      <StatCard icon={Handshake} label="Partner Bekleyen" value={String(kpis.awaitingPartner)} />
      <StatCard icon={AlertTriangle} label="Partner Yanıtı Gecikmiş" value={String(kpis.overduePartner)} iconClassName="bg-red-50 text-red-700" />
      <StatCard icon={ClipboardList} label="Keşif Aşamasında" value={String(kpis.survey)} />
      <StatCard icon={FileText} label="Teklif Aşamasında" value={String(kpis.proposal)} />
      <StatCard icon={Trophy} label="Kazanılan" value={String(kpis.won)} iconClassName="bg-green-50 text-green-700" />
      <StatCard icon={XCircle} label="Kaybedilen" value={String(kpis.lost)} iconClassName="bg-red-50 text-red-700" />
      <StatCard
        icon={TrendingUp}
        label="Dönüşüm Oranı"
        value={`%${kpis.conversionRate}`}
        iconClassName="bg-brand-light text-brand"
      />
    </div>
  );
}
