import { Users, CalendarClock, Flame, Sun, Cloud, Snowflake, FileText, Handshake, Trophy, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { LeadsTable } from "@/components/leads-table";
import { getSalesLeadKpis, getVisibleLeads } from "@/lib/data/leads";

export default async function SalesMyLeadsPage() {
  const supabase = await createClient();
  const [kpis, leads] = await Promise.all([
    getSalesLeadKpis(supabase),
    getVisibleLeads(supabase, 200),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Leadlerim</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Users} label="Toplam" value={String(kpis.total)} />
        <StatCard icon={CalendarClock} label="Bugünkü Takip" value={String(kpis.dueToday)} />
        <StatCard icon={Flame} label="Sıcak" value={String(kpis.hot)} iconClassName="bg-red-50 text-red-700" />
        <StatCard icon={Sun} label="Ilık" value={String(kpis.warm)} iconClassName="bg-orange-50 text-orange-700" />
        <StatCard icon={Cloud} label="Orta" value={String(kpis.mid)} iconClassName="bg-amber-50 text-amber-700" />
        <StatCard icon={Snowflake} label="Soğuk" value={String(kpis.cold)} iconClassName="bg-blue-50 text-blue-700" />
        <StatCard icon={FileText} label="Teklif Bekleyen" value={String(kpis.proposalPreparing)} />
        <StatCard icon={Handshake} label="Pazarlıkta" value={String(kpis.negotiation)} />
        <StatCard icon={Trophy} label="Kazanılan" value={String(kpis.won)} iconClassName="bg-green-50 text-green-700" />
        <StatCard icon={XCircle} label="Kaybedilen" value={String(kpis.lost)} iconClassName="bg-red-50 text-red-700" />
      </div>

      <LeadsTable leads={leads} />
    </div>
  );
}
