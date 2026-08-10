"use client";

import { useState } from "react";
import {
  UserPlus, PhoneCall, MessageCircle, HelpCircle, Send,
  Users, CalendarClock, Flame, Sun, Cloud, Snowflake, FileText, Handshake, Trophy, XCircle,
  Clock, AlertTriangle, ClipboardList, TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { LeadsTable } from "@/components/leads-table";
import { LeadStageBadge, ReferralStatusBadge } from "@/components/lead-badges";
import type { LeadListItem, PartnerReferralListItem } from "@/lib/data/leads";
import type { getFirstCallLeadKpis, getSalesLeadKpis, getPartnerReferralKpis } from "@/lib/data/leads";

const TABS = [
  { key: "pool", label: "Lead Havuzu" },
  { key: "mine", label: "Leadlerim" },
  { key: "referrals", label: "Bana Yönlendirilenler" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Admin için Lead Havuzu / Leadlerim / Bana Yönlendirilenler artık ayrı
 * sayfalar (ayrı navigasyon = ayrı auth+veri round trip'i) değil, tek
 * sayfada client-side sekme. Tüm veri sayfa yüklendiğinde bir kez,
 * paralel çekiliyor; sekme geçişi sıfır ağ isteği.
 *
 * "Bana Yönlendirilenler" sekmesi admin için salt-okunur: kabul/ret
 * RPC'si (respond_to_referral) yalnızca partner_admin/partner_employee
 * rolünü kabul ediyor, admin çağırırsa yetki hatası alır — o yüzden
 * buradaki tabloda accept/reject formları yok, yalnızca durum görünümü.
 */
export function LeadsOverviewTabs({
  firstCallKpis,
  salesKpis,
  referralKpis,
  leads,
  referrals,
}: {
  firstCallKpis: Awaited<ReturnType<typeof getFirstCallLeadKpis>>;
  salesKpis: Awaited<ReturnType<typeof getSalesLeadKpis>>;
  referralKpis: Awaited<ReturnType<typeof getPartnerReferralKpis>>;
  leads: LeadListItem[];
  referrals: PartnerReferralListItem[];
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard icon={UserPlus} label="Yeni Atanan" value={String(firstCallKpis.newAssigned)} />
            <StatCard icon={PhoneCall} label="Bugün Aranacak" value={String(firstCallKpis.dueToday)} />
            <StatCard icon={MessageCircle} label="Görüşme Tamamlanan" value={String(firstCallKpis.contacted)} />
            <StatCard icon={HelpCircle} label="Puanlama Bekleyen" value={String(firstCallKpis.unscored)} />
            <StatCard icon={Send} label="Satışa Aktarılacak" value={String(firstCallKpis.readyForSales)} />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-foreground">Havuzdaki Yeni Leadler</h2>
            <LeadsTable leads={poolLeads} emptyMessage="Havuzda henüz aranmamış yeni lead yok." />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-foreground">Takip Ettiklerim</h2>
            <LeadsTable leads={followUpLeads} emptyMessage="Şu an takip edilen bir lead yok." />
          </div>
        </div>
      )}

      {activeTab === "mine" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard icon={Users} label="Toplam" value={String(salesKpis.total)} />
            <StatCard icon={CalendarClock} label="Bugünkü Takip" value={String(salesKpis.dueToday)} />
            <StatCard icon={Flame} label="Sıcak" value={String(salesKpis.hot)} iconClassName="bg-red-50 text-red-700" />
            <StatCard icon={Sun} label="Ilık" value={String(salesKpis.warm)} iconClassName="bg-orange-50 text-orange-700" />
            <StatCard icon={Cloud} label="Orta" value={String(salesKpis.mid)} iconClassName="bg-amber-50 text-amber-700" />
            <StatCard icon={Snowflake} label="Soğuk" value={String(salesKpis.cold)} iconClassName="bg-blue-50 text-blue-700" />
            <StatCard icon={FileText} label="Teklif Bekleyen" value={String(salesKpis.proposalPreparing)} />
            <StatCard icon={Handshake} label="Pazarlıkta" value={String(salesKpis.negotiation)} />
            <StatCard icon={Trophy} label="Kazanılan" value={String(salesKpis.won)} iconClassName="bg-green-50 text-green-700" />
            <StatCard icon={XCircle} label="Kaybedilen" value={String(salesKpis.lost)} iconClassName="bg-red-50 text-red-700" />
          </div>

          <LeadsTable leads={leads} />
        </div>
      )}

      {activeTab === "referrals" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatCard icon={Users} label="Toplam" value={String(referralKpis.total)} />
            <StatCard icon={Clock} label="Yanıt Bekleyen" value={String(referralKpis.pending)} />
            <StatCard icon={AlertTriangle} label="Süresi Geçen" value={String(referralKpis.overdue)} iconClassName="bg-red-50 text-red-700" />
            <StatCard icon={ClipboardList} label="Keşif Planlanan" value={String(referralKpis.surveyPlanned)} />
            <StatCard icon={FileText} label="Teklif Hazırlanacak" value={String(referralKpis.proposalPreparing)} />
            <StatCard icon={Handshake} label="Pazarlıkta" value={String(referralKpis.negotiation)} />
            <StatCard icon={Trophy} label="Başarılı" value={String(referralKpis.completed)} iconClassName="bg-green-50 text-green-700" />
            <StatCard icon={XCircle} label="Başarısız" value={String(referralKpis.unsuccessful)} iconClassName="bg-red-50 text-red-700" />
            <StatCard icon={TrendingUp} label="Dönüşüm Oranı" value={`%${referralKpis.conversionRate}`} iconClassName="bg-brand-light text-brand" />
          </div>

          {referrals.length === 0 ? (
            <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
              Henüz bir partnere yönlendirilmiş lead bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Lead No</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Şehir</th>
                    <th className="px-4 py-3">Süreç Aşaması</th>
                    <th className="px-4 py-3">Yönlendirme Durumu</th>
                    <th className="px-4 py-3">Yanıt Süresi</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr key={referral.id} className="border-b border-card-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{referral.leadNo}</td>
                      <td className="px-4 py-3 text-foreground">{referral.customerName}</td>
                      <td className="px-4 py-3 text-muted">{referral.city}</td>
                      <td className="px-4 py-3">
                        <LeadStageBadge stage={referral.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <ReferralStatusBadge status={referral.status} />
                      </td>
                      <td className={referral.isOverdue ? "px-4 py-3 font-medium text-red-600" : "px-4 py-3 text-muted"}>
                        {new Date(referral.responseDueAt).toLocaleDateString("tr-TR")}
                        {referral.isOverdue && " (gecikti)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
