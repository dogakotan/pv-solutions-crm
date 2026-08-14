"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { TodayFollowUpCard } from "@/components/today-followup-card";
import { LeadsTable } from "@/components/leads-table";
import type { LeadListItem } from "@/lib/data/leads";
import type { getSalesLeadKpis } from "@/lib/data/leads";

const TABS = [
  { key: "pool", label: "Lead Havuzu" },
  { key: "mine", label: "Leadlerim" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Admin için Lead Havuzu / Leadlerim artık ayrı sayfalar (ayrı
 * navigasyon = ayrı auth+veri round trip'i) değil, tek sayfada
 * client-side sekme. Tüm veri sayfa yüklendiğinde bir kez, paralel
 * çekiliyor; sekme geçişi sıfır ağ isteği.
 *
 * "Bana Yönlendirilenler" sekmesi kaldırıldı — partnere yönlendirilen
 * leadler zaten Lead Havuzu/Leadlerim tablolarında (aşama = "referred"
 * ve sonrası) görünür, ayrı bir sekmeye gerek yok.
 */
export function LeadsOverviewTabs({
  salesKpis,
  leads,
}: {
  salesKpis: Awaited<ReturnType<typeof getSalesLeadKpis>>;
  leads: LeadListItem[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("pool");

  const poolLeads = leads.filter((lead) => lead.stage === "new");
  const followUpLeads = leads.filter((lead) => lead.stage !== "new");

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

      {activeTab === "pool" && (
        <div className="flex flex-col gap-6">
          <LeadsTable leads={poolLeads} emptyMessage="Havuzda henüz aranmamış yeni lead yok." />
        </div>
      )}

      {activeTab === "mine" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard icon={Users} label="Toplam Lead" value={String(salesKpis.total)} />
            <TodayFollowUpCard dueToday={salesKpis.dueToday} leads={leads} />
          </div>

          <LeadsTable leads={followUpLeads} emptyMessage="Şu an takip edilen bir lead yok." />
        </div>
      )}
    </>
  );
}
