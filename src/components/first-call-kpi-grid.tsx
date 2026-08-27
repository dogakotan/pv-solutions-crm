import { UserPlus, MessageCircle, HelpCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { TodayActionsCard } from "@/components/today-actions-card";
import { getFirstCallLeadKpis } from "@/lib/data/leads";
import { getActivitiesDueInRange } from "@/lib/data/activities";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function FirstCallKpiGrid() {
  const supabase = await createClient();
  const { start, end } = todayRange();
  const [kpis, todayActivities] = await Promise.all([
    getFirstCallLeadKpis(supabase),
    getActivitiesDueInRange(supabase, start, end),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <StatCard icon={UserPlus} label="Yeni Atanan" value={String(kpis.newAssigned)} />
      <StatCard icon={MessageCircle} label="Görüşme Tamamlanan" value={String(kpis.contacted)} />
      <StatCard
        icon={HelpCircle}
        label="Puanlama Bekleyen"
        value={String(kpis.unscored)}
        iconClassName={kpis.unscored > 0 ? "bg-red-50 text-red-600" : undefined}
      />
      <StatCard icon={Send} label="Satışa Aktarılacak" value={String(kpis.readyForSales)} />
      <TodayActionsCard activities={todayActivities} className="sm:col-span-2" />
    </div>
  );
}
