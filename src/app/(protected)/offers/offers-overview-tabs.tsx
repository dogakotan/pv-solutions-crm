"use client";

import { useMemo, useState } from "react";
import { FileText, Clock, Wallet } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { OffersOverviewTable } from "./offers-overview-table";
import { OffersListFilters } from "./offers-list-filters";
import type { OfferOverviewItem } from "@/lib/data/offers";

const TABS = [
  { key: "genel", label: "Genel" },
  { key: "liste", label: "Teklif Listesi" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function formatOpenValue(offers: OfferOverviewItem[]): string {
  const totalsByCurrency = new Map<string, number>();

  for (const offer of offers) {
    if (offer.status !== "open" || offer.amount === null || !offer.currency) continue;
    totalsByCurrency.set(offer.currency, (totalsByCurrency.get(offer.currency) ?? 0) + offer.amount);
  }

  if (totalsByCurrency.size === 0) return "0";

  return Array.from(totalsByCurrency.entries())
    .map(([currency, total]) => `${total.toLocaleString("tr-TR")} ${currency}`)
    .join(", ");
}

export function OffersOverviewTabs({ offers }: { offers: OfferOverviewItem[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("genel");

  const totalOffers = offers.length;
  const openOffers = useMemo(() => offers.filter((o) => o.status === "open"), [offers]);
  const openValueLabel = useMemo(() => formatOpenValue(offers), [offers]);

  const actionNeeded = useMemo(() => {
    return [...openOffers].sort((a, b) => {
      if (!a.nextActionAt && !b.nextActionAt) return 0;
      if (!a.nextActionAt) return 1;
      if (!b.nextActionAt) return -1;
      return a.nextActionAt.localeCompare(b.nextActionAt);
    });
  }, [openOffers]);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={FileText} label="Toplam Teklif" value={String(totalOffers)} />
            <StatCard
              icon={Clock}
              iconClassName="bg-blue-50 text-blue-700"
              label="Açık Teklif"
              value={String(openOffers.length)}
            />
            <StatCard
              icon={Wallet}
              iconClassName="bg-brand-light text-brand"
              label="Açık Teklif Değeri"
              value={openValueLabel}
            />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-foreground">Aksiyon Gerektiren Teklifler</h2>
            <OffersOverviewTable
              offers={actionNeeded}
              emptyMessage="Şu an aksiyon bekleyen bir teklif yok."
            />
          </div>
        </div>
      )}

      {activeTab === "liste" && <OffersListFilters offers={offers} />}
    </>
  );
}
