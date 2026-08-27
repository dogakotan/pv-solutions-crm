"use client";

import { useState } from "react";
import { LeadsTable } from "@/components/leads-table";
import type { LeadListItem } from "@/lib/data/leads";

const TABS = [
  { key: "havuz", label: "Havuzdaki Yeni Leadler" },
  { key: "takip", label: "Takip Ettiklerim" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function LeadPoolTabs({ leads }: { leads: LeadListItem[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("havuz");

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

      {activeTab === "havuz" && (
        <LeadsTable leads={poolLeads} emptyMessage="Havuzda henüz aranmamış yeni lead yok." />
      )}
      {activeTab === "takip" && (
        <LeadsTable leads={followUpLeads} emptyMessage="Şu an takip ettiğiniz bir lead yok." />
      )}
    </>
  );
}
