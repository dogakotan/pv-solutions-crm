import Link from "next/link";
import { UserPlus, PhoneCall, MessageCircle, HelpCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { LeadsTable } from "@/components/leads-table";
import { getFirstCallLeadKpis, getVisibleLeads } from "@/lib/data/leads";

export default async function FirstCallLeadPoolPage() {
  const supabase = await createClient();
  const [kpis, leads] = await Promise.all([
    getFirstCallLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
  ]);

  const poolLeads = leads.filter((lead) => lead.stage === "new");
  const followUpLeads = leads.filter((lead) => lead.stage !== "new");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Lead Havuzu</h1>
        <Link
          href="/first-call/new-lead"
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Yeni Lead
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={UserPlus} label="Yeni Atanan" value={String(kpis.newAssigned)} />
        <StatCard icon={PhoneCall} label="Bugün Aranacak" value={String(kpis.dueToday)} />
        <StatCard icon={MessageCircle} label="Görüşme Tamamlanan" value={String(kpis.contacted)} />
        <StatCard icon={HelpCircle} label="Puanlama Bekleyen" value={String(kpis.unscored)} />
        <StatCard icon={Send} label="Satışa Aktarılacak" value={String(kpis.readyForSales)} />
      </div>

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
