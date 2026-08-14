"use client";

import { useState, type ReactNode } from "react";
import type { Partner, PartnerEmployee } from "@/types/partner";
import type { PartnerSalesOutcomeItem } from "@/lib/data/sales-outcomes";
import { PartnerEmployeesTab } from "./partner-employees-tab";
import { PARTNER_TABS, type PartnerTabKey } from "./partner-tabs";

/**
 * Sekmeler artık ayrı bir sayfa navigasyonu (eskiden `?tab=` ile <Link>,
 * her tıklamada tüm sayfayı — partner bilgisi + istatistikler dahil —
 * sunucudan yeniden çekiyordu) DEĞİL, saf client-side state. Tüm sekme
 * verisi (partner, çalışanlar) sayfa ilk yüklendiğinde bir kez, paralel
 * olarak çekiliyor; sekmeler arası geçiş artık sıfır ağ isteği.
 * URL'deki ?tab= yalnızca paylaşılabilir link için history API ile
 * senkronize edilir — router.push/replace kullanılmıyor (o da yeniden
 * sunucu round trip'i tetikler).
 */
export function PartnerDetailTabs({
  partner,
  employees,
  salesOutcomes,
  internalNote,
  initialTab,
  infoTab,
}: {
  partner: Partner;
  employees: PartnerEmployee[];
  salesOutcomes: PartnerSalesOutcomeItem[];
  internalNote: string | null;
  initialTab: PartnerTabKey;
  /**
   * Server tarafında önceden render edilmiş "Firma Bilgileri" sekmesi.
   * PartnerInfoTab -> PartnerMap zincirinde server-only bir geocode
   * fetch'i var; bu Client Component o modülü doğrudan import edemez
   * (server-only ihlali) — bu yüzden page.tsx onu server'da render edip
   * hazır JSX olarak buraya geçiriyor.
   */
  infoTab: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<PartnerTabKey>(initialTab);

  function selectTab(key: PartnerTabKey) {
    setActiveTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="flex gap-1 overflow-x-auto border-b border-card-border">
        {PARTNER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
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

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        {activeTab === "info" && infoTab}
        {activeTab === "employees" && (
          <PartnerEmployeesTab partnerId={partner.id} employees={employees} />
        )}
        {activeTab === "internal-notes" && (
          <p className="text-sm text-foreground">
            {internalNote ?? "Bu partner için iç not girilmemiş."}
          </p>
        )}
        {activeTab === "outcomes" && (
          salesOutcomes.length === 0 ? (
            <p className="text-sm text-muted">Bu partner üzerinden henüz kapanmış bir satış yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-card-border text-muted">
                  <tr>
                    <th className="py-2 font-medium">Lead No</th>
                    <th className="py-2 font-medium">Müşteri</th>
                    <th className="py-2 font-medium">Sonuç</th>
                    <th className="py-2 font-medium">Tutar / Gerekçe</th>
                    <th className="py-2 font-medium">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {salesOutcomes.map((o) => (
                    <tr key={o.id} className="border-b border-card-border last:border-0">
                      <td className="py-2 font-medium text-foreground">{o.leadNo}</td>
                      <td className="py-2 text-foreground">{o.customerName}</td>
                      <td className={o.outcome === "won" ? "py-2 font-medium text-green-700" : "py-2 font-medium text-red-700"}>
                        {o.outcome === "won" ? "Kazanıldı" : "Kaybedildi"}
                      </td>
                      <td className="py-2 text-muted">
                        {o.outcome === "won" ? `${o.finalAmount?.toLocaleString("tr-TR")} ${o.currency}` : o.lostReason}
                      </td>
                      <td className="py-2 text-muted">{new Date(o.resultDate).toLocaleDateString("tr-TR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {(activeTab === "referrals" || activeTab === "offers" || activeTab === "performance") && (
          <p className="text-sm text-muted">
            Bu sekmenin verisi ilerleyen fazlarda (yönlendirme/teklif modülleri) bağlanacak.
          </p>
        )}
      </div>
    </>
  );
}
