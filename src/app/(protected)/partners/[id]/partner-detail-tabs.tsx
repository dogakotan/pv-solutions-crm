"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { Partner, PartnerEmployee } from "@/types/partner";
import type { PartnerSalesOutcomeItem } from "@/lib/data/sales-outcomes";
import type { OpenPartnerReferral } from "@/lib/data/partners";
import type { PartnerOfferItem } from "@/lib/data/offers";
import type { PartnerPerformanceItem } from "@/lib/data/reports";
import { ReferralStatusBadge } from "@/components/lead-badges";
import { OfferStatusBadge } from "@/components/offer-badges";
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
  openReferrals,
  offers,
  performance,
  initialTab,
  infoTab,
  canManagePartners,
}: {
  partner: Partner;
  employees: PartnerEmployee[];
  salesOutcomes: PartnerSalesOutcomeItem[];
  internalNote: string | null;
  openReferrals: OpenPartnerReferral[];
  offers: PartnerOfferItem[];
  performance: PartnerPerformanceItem | null;
  initialTab: PartnerTabKey;
  /**
   * Server tarafında önceden render edilmiş "Firma Bilgileri" sekmesi.
   * PartnerInfoTab -> PartnerMap zincirinde server-only bir geocode
   * fetch'i var; bu Client Component o modülü doğrudan import edemez
   * (server-only ihlali) — bu yüzden page.tsx onu server'da render edip
   * hazır JSX olarak buraya geçiriyor.
   */
  infoTab: ReactNode;
  /** Çalışanlar (ekleme formu dahil) ve PV İç Notları yalnızca admin'e gösterilir. */
  canManagePartners: boolean;
}) {
  const visibleTabs = canManagePartners
    ? PARTNER_TABS
    : PARTNER_TABS.filter((t) => t.key !== "employees" && t.key !== "internal-notes");
  const [activeTab, setActiveTab] = useState<PartnerTabKey>(
    visibleTabs.some((t) => t.key === initialTab) ? initialTab : "info"
  );

  function selectTab(key: PartnerTabKey) {
    setActiveTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="flex gap-1 overflow-x-auto border-b border-card-border">
        {visibleTabs.map((t) => (
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
        {activeTab === "referrals" && (
          openReferrals.length === 0 ? (
            <p className="text-sm text-muted">Bu partnere şu an açık bir yönlendirme yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-card-border text-muted">
                  <tr>
                    <th className="py-2 font-medium">Lead No</th>
                    <th className="py-2 font-medium">Müşteri</th>
                    <th className="py-2 font-medium">Şehir</th>
                    <th className="py-2 font-medium">Durum</th>
                    <th className="py-2 font-medium">Yanıt Süresi</th>
                  </tr>
                </thead>
                <tbody>
                  {openReferrals.map((r) => (
                    <tr key={r.id} className="border-b border-card-border last:border-0">
                      <td className="py-2 font-medium">
                        <Link href={`/leads/${r.leadId}`} className="text-brand hover:underline">
                          {r.leadNo}
                        </Link>
                      </td>
                      <td className="py-2 text-foreground">{r.customerName}</td>
                      <td className="py-2 text-muted">{r.city}</td>
                      <td className="py-2">
                        <ReferralStatusBadge status={r.status} />
                      </td>
                      <td className={r.isOverdue ? "py-2 font-medium text-red-700" : "py-2 text-muted"}>
                        {new Date(r.responseDueAt).toLocaleString("tr-TR")}
                        {r.isOverdue && " (gecikti)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === "offers" && (
          offers.length === 0 ? (
            <p className="text-sm text-muted">Bu partner üzerinden henüz oluşturulmuş bir teklif yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-card-border text-muted">
                  <tr>
                    <th className="py-2 font-medium">Teklif No</th>
                    <th className="py-2 font-medium">Müşteri</th>
                    <th className="py-2 font-medium">Tutar</th>
                    <th className="py-2 font-medium">Durum</th>
                    <th className="py-2 font-medium">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id} className="border-b border-card-border last:border-0">
                      <td className="py-2 font-medium">
                        <Link href={`/offers/${o.id}`} className="text-brand hover:underline">
                          {o.offerNo}
                        </Link>
                      </td>
                      <td className="py-2 text-foreground">{o.customerName}</td>
                      <td className="py-2 text-muted">
                        {o.latestAmount != null
                          ? `${o.latestAmount.toLocaleString("tr-TR")} ${o.latestCurrency}`
                          : "—"}
                      </td>
                      <td className="py-2">
                        <OfferStatusBadge status={o.status} />
                      </td>
                      <td className="py-2 text-muted">{new Date(o.createdAt).toLocaleDateString("tr-TR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === "performance" && (
          performance === null ? (
            <p className="text-sm text-muted">Bu partner için henüz performans verisi yok.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <PerformanceStat label="Yönlendirme" value={String(performance.referralCount)} />
              <PerformanceStat label="Kabul Oranı" value={`%${performance.acceptanceRate}`} />
              <PerformanceStat
                label="Ort. Cevap Süresi"
                value={performance.avgResponseHours != null ? `${performance.avgResponseHours} sa` : "—"}
              />
              <PerformanceStat label="Teklif" value={String(performance.offerCount)} />
              <PerformanceStat label="Satış" value={String(performance.salesCount)} />
              <PerformanceStat
                label="Manuel Puan"
                value={performance.rating != null ? performance.rating.toFixed(1) : "—"}
              />
            </div>
          )
        )}
      </div>
    </>
  );
}

function PerformanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-card-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
