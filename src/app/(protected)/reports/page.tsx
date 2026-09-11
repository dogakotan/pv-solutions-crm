import { Suspense } from "react";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  getLeadFunnel,
  getSourceConversion,
  getSalespersonPerformance,
  getPartnerPerformance,
  getLostReasons,
  getMonthlyWonAmount,
  getOverdueFollowUpCount,
} from "@/lib/data/reports";
import { LeadStageBadge } from "@/components/lead-badges";
import { CardGridSkeleton, CardSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";

const inputClass = "rounded-lg border border-card-border px-3 py-2 text-sm";

type ReportRange = { from: string | null; to: string | null };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole(["admin"]);
  const { from, to } = await searchParams;
  const range: ReportRange = { from: from || null, to: to || null };

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Raporlar</h1>
      </SetHeaderContent>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="report-from" className="text-xs font-medium text-muted">Başlangıç</label>
          <input id="report-from" type="date" name="from" defaultValue={from ?? ""} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="report-to" className="text-xs font-medium text-muted">Bitiş</label>
          <input id="report-to" type="date" name="to" defaultValue={to ?? ""} className={inputClass} />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Filtrele
        </button>
        {(from || to) && (
          <a href="/reports" className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background">
            Temizle
          </a>
        )}
      </form>

      <Suspense fallback={<CardSkeleton lines={6} />}>
        <FunnelCard range={range} />
      </Suspense>

      <Suspense fallback={<CardGridSkeleton cards={4} />}>
        <BreakdownGrid range={range} />
      </Suspense>

      <Suspense fallback={<CardSkeleton lines={4} />}>
        <MonthlyWonCard range={range} />
      </Suspense>
    </div>
  );
}

async function FunnelCard({ range }: { range: ReportRange }) {
  const supabase = await createClient();
  const [funnel, overdueCount] = await Promise.all([
    getLeadFunnel(supabase, range),
    getOverdueFollowUpCount(supabase),
  ]);
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Aşama Hunisi</h2>
        <span className="text-xs text-muted">Geciken takip: {overdueCount}</span>
      </div>
      <div className="flex flex-col gap-2">
        {funnel.map((f) => (
          <div key={f.stage} className="flex items-center gap-3">
            <div className="w-44 shrink-0">
              <LeadStageBadge stage={f.stage} />
            </div>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${(f.count / funnelMax) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-sm text-foreground">{f.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function BreakdownGrid({ range }: { range: ReportRange }) {
  const supabase = await createClient();
  const [sourceConversion, salespersonPerformance, partnerPerformance, lostReasons] = await Promise.all([
    getSourceConversion(supabase, range),
    getSalespersonPerformance(supabase, range),
    getPartnerPerformance(supabase, range),
    getLostReasons(supabase, range),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Lead Kaynağına Göre Dönüşüm</h2>
        {sourceConversion.length === 0 ? (
          <p className="text-sm text-muted">Veri yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border text-muted">
                <tr>
                  <th className="py-2 font-medium">Kaynak</th>
                  <th className="py-2 font-medium">Toplam</th>
                  <th className="py-2 font-medium">Kazanılan</th>
                  <th className="py-2 font-medium">Kaybedilen</th>
                  <th className="py-2 font-medium">Dönüşüm</th>
                </tr>
              </thead>
              <tbody>
                {sourceConversion.map((s) => (
                  <tr key={s.source} className="border-b border-card-border last:border-0">
                    <td className="py-2 text-foreground">{s.source}</td>
                    <td className="py-2 text-muted">{s.total}</td>
                    <td className="py-2 text-green-700">{s.won}</td>
                    <td className="py-2 text-red-700">{s.lost}</td>
                    <td className="py-2 text-foreground">%{s.conversionRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Satışçı Performansı</h2>
        {salespersonPerformance.length === 0 ? (
          <p className="text-sm text-muted">Veri yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border text-muted">
                <tr>
                  <th className="py-2 font-medium">Satışçı</th>
                  <th className="py-2 font-medium">Yeni</th>
                  <th className="py-2 font-medium">Açık</th>
                  <th className="py-2 font-medium">Teklif</th>
                  <th className="py-2 font-medium">Kazanılan</th>
                  <th className="py-2 font-medium">Kaybedilen</th>
                  <th className="py-2 font-medium">Dönüşüm</th>
                  <th className="py-2 font-medium">Kazanılan Tutar</th>
                </tr>
              </thead>
              <tbody>
                {salespersonPerformance.map((o) => (
                  <tr key={o.salesUserId} className="border-b border-card-border last:border-0">
                    <td className="py-2 text-foreground">{o.salesUserName}</td>
                    <td className="py-2 text-muted">{o.newCount}</td>
                    <td className="py-2 text-muted">{o.openCount}</td>
                    <td className="py-2 text-muted">{o.offersSent}</td>
                    <td className="py-2 text-green-700">{o.won}</td>
                    <td className="py-2 text-red-700">{o.lost}</td>
                    <td className="py-2 text-foreground">%{o.conversionRate}</td>
                    <td className="py-2 text-foreground">
                      {o.wonAmounts.length > 0
                        ? o.wonAmounts
                            .map((w) => `${w.amount.toLocaleString("tr-TR")} ${w.currency}`)
                            .join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Partner Bazlı Performans</h2>
        {partnerPerformance.length === 0 ? (
          <p className="text-sm text-muted">Veri yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border text-muted">
                <tr>
                  <th className="py-2 font-medium">Partner</th>
                  <th className="py-2 font-medium">Manuel Puan</th>
                  <th className="py-2 font-medium">Yönlendirme</th>
                  <th className="py-2 font-medium">Kabul Oranı</th>
                  <th className="py-2 font-medium">Ort. Cevap</th>
                  <th className="py-2 font-medium">Teklif</th>
                  <th className="py-2 font-medium">Satış</th>
                </tr>
              </thead>
              <tbody>
                {partnerPerformance.map((p) => (
                  <tr key={p.partnerId} className="border-b border-card-border last:border-0">
                    <td className="py-2 text-foreground">{p.partnerName}</td>
                    <td className="py-2 text-muted">{p.rating != null ? p.rating.toFixed(1) : "—"}</td>
                    <td className="py-2 text-muted">{p.referralCount}</td>
                    <td className="py-2 text-muted">%{p.acceptanceRate}</td>
                    <td className="py-2 text-muted">
                      {p.avgResponseHours != null ? `${p.avgResponseHours} sa` : "—"}
                    </td>
                    <td className="py-2 text-muted">{p.offerCount}</td>
                    <td className="py-2 text-green-700">{p.salesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Kayıp Nedenleri Dağılımı</h2>
        {lostReasons.length === 0 ? (
          <p className="text-sm text-muted">Kayıp kaydı yok.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lostReasons.map((r) => (
              <div key={r.reason} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.reason}</span>
                <span className="text-muted">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function MonthlyWonCard({ range }: { range: ReportRange }) {
  const supabase = await createClient();
  const monthlyWon = await getMonthlyWonAmount(supabase, range);

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-medium text-foreground">Aylık Kazanılan Satış Tutarı</h2>
      {monthlyWon.length === 0 ? (
        <p className="text-sm text-muted">Henüz kazanılan bir satış yok.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-card-border text-muted">
            <tr>
              <th className="py-2 font-medium">Ay</th>
              <th className="py-2 font-medium">Para Birimi</th>
              <th className="py-2 font-medium">Toplam Tutar</th>
            </tr>
          </thead>
          <tbody>
            {monthlyWon.map((m) => (
              <tr key={`${m.month}-${m.currency}`} className="border-b border-card-border last:border-0">
                <td className="py-2 text-foreground">{m.month}</td>
                <td className="py-2 text-muted">{m.currency}</td>
                <td className="py-2 text-foreground">{m.totalAmount.toLocaleString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
