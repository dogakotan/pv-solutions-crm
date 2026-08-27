import { Suspense } from "react";
import Link from "next/link";
import { UserPlus, PhoneCall, MessageCircle, HelpCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { LeadsTable } from "@/components/leads-table";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { getFirstCallLeadKpis, getVisibleLeads } from "@/lib/data/leads";
import { SetHeaderContent } from "@/components/page-header-slot";

export default function FirstCallLeadPoolPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Lead Havuzu</h1>
      </SetHeaderContent>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/first-call/assignments"
          className="flex items-center gap-2 rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Satışa Ata
        </Link>
        <Link
          href="/first-call/new-lead"
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Yeni Lead
        </Link>
      </div>

      <Suspense fallback={<KpiGridSkeleton count={5} />}>
        <LeadPoolKpiGrid />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <TableSkeleton rows={5} />
            <TableSkeleton rows={5} />
          </div>
        }
      >
        <LeadPoolTables />
      </Suspense>
    </div>
  );
}

async function LeadPoolKpiGrid() {
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

async function LeadPoolTables() {
  const supabase = await createClient();
  const leads = await getVisibleLeads(supabase, 200);

  const poolLeads = leads.filter((lead) => lead.stage === "new");
  const followUpLeads = leads.filter((lead) => lead.stage !== "new");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Havuzdaki Yeni Leadler</h2>
        <LeadsTable leads={poolLeads} emptyMessage="Havuzda henüz aranmamış yeni lead yok." />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Takip Ettiklerim</h2>
        <LeadsTable leads={followUpLeads} emptyMessage="Şu an takip ettiğiniz bir lead yok." />
      </div>
    </div>
  );
}
