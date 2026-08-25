"use client";

import { useState } from "react";
import { Users, UserPlus } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { TodayActionsCard } from "@/components/today-actions-card";
import { LeadsTable } from "@/components/leads-table";
import type { LeadListItem } from "@/lib/data/leads";
import type { ActivityFeedItem } from "@/lib/data/activities";

const TABS = [
  { key: "genel", label: "Genel" },
  { key: "leadler", label: "Lead Listesi" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * "new" aşamasındaki leadler first_call tarafından nitelendirilip bu
 * satış temsilcisine atanmış ama henüz hiç işlem görmemiş leadlerdir —
 * temsilci pipeline/detay sayfasından aşamayı ilerlettiği an bir sonraki
 * veri çekişinde bu listeden düşüp Leadler sekmesinde belirir, ayrı bir
 * "işleme alındı" bayrağına gerek yok.
 */
export function MyLeadsTabs({
  totalCount,
  leads,
  todayActivities,
}: {
  totalCount: number;
  leads: LeadListItem[];
  todayActivities: ActivityFeedItem[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("genel");

  const newLeads = leads.filter((lead) => lead.stage === "new");
  const otherLeads = leads.filter((lead) => lead.stage !== "new");

  return (
    <>
      <div className="flex gap-1 overflow-x-auto border-b border-card-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={
              activeTab === t.key
                ? "whitespace-nowrap border-b-2 border-brand px-4 py-3 text-sm font-medium text-brand"
                : "whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm text-muted hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "genel" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard icon={Users} label="Toplam Lead" value={String(totalCount)} />
            <StatCard icon={UserPlus} label="Yeni Lead" value={String(newLeads.length)} />
            <TodayActionsCard activities={todayActivities} className="sm:col-span-2" />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-foreground">Yeni Atanan Leadler</h2>
            <LeadsTable
              leads={newLeads}
              emptyMessage="Şu an ilgilenilmeyi bekleyen yeni bir lead yok."
            />
          </div>
        </div>
      )}

      {activeTab === "leadler" && (
        <LeadsTable leads={otherLeads} emptyMessage="Şu an takip edilen bir lead yok." />
      )}
    </>
  );
}
