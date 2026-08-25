"use client";

import { useState } from "react";
import { Users, CheckCircle2, ShoppingCart, Filter } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PartnerActivityCard } from "@/components/partner-activity-card";
import { PartnersTable } from "./partners-table";
import type { Partner } from "@/types/partner";
import type { PartnerActivityItem } from "@/lib/data/partners";

const TABS = [
  { key: "genel", label: "Genel" },
  { key: "liste", label: "Partner Listesi" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PartnersOverviewTabs({
  partners,
  recentActivity,
}: {
  partners: Partner[];
  recentActivity: PartnerActivityItem[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("genel");

  const totalPartners = partners.length;
  const activePartners = partners.filter((p) => p.status === "active").length;
  const monthlySales = partners.reduce((sum, p) => sum + p.stats.sales, 0);
  const avgConversion =
    partners.length === 0
      ? 0
      : partners.reduce((sum, p) => sum + p.stats.conversionRate, 0) / partners.length;

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Toplam Partner" value={String(totalPartners)} />
            <StatCard
              icon={CheckCircle2}
              iconClassName="bg-green-50 text-green-600"
              label="Aktif Partner"
              value={String(activePartners)}
            />
            <StatCard
              icon={ShoppingCart}
              iconClassName="bg-blue-50 text-blue-600"
              label="Bu Ay Satış"
              value={String(monthlySales)}
            />
            <StatCard
              icon={Filter}
              iconClassName="bg-purple-50 text-purple-600"
              label="Ortalama Dönüşüm"
              value={`%${avgConversion.toFixed(1)}`}
            />
          </div>

          <PartnerActivityCard activity={recentActivity} />
        </div>
      )}

      {activeTab === "liste" && <PartnersTable partners={partners} />}
    </>
  );
}
