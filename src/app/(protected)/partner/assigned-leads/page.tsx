import { Users, Clock, AlertTriangle, ClipboardList, FileText, Handshake, Trophy, XCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { LeadStageBadge, ReferralStatusBadge } from "@/components/lead-badges";
import { getPartnerReferralKpis, getVisiblePartnerReferrals } from "@/lib/data/leads";
import { acceptReferral, rejectReferral } from "./actions";

export default async function PartnerAssignedLeadsPage() {
  const supabase = await createClient();
  const [kpis, referrals] = await Promise.all([
    getPartnerReferralKpis(supabase),
    getVisiblePartnerReferrals(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Bana Yönlendirilen Müşteriler</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard icon={Users} label="Toplam" value={String(kpis.total)} />
        <StatCard icon={Clock} label="Görüşme Bekleyen" value={String(kpis.pending)} />
        <StatCard icon={AlertTriangle} label="Süresi Geçen" value={String(kpis.overdue)} iconClassName="bg-red-50 text-red-700" />
        <StatCard icon={ClipboardList} label="Keşif Planlanan" value={String(kpis.surveyPlanned)} />
        <StatCard icon={FileText} label="Teklif Hazırlanacak" value={String(kpis.proposalPreparing)} />
        <StatCard icon={Handshake} label="Pazarlıkta" value={String(kpis.negotiation)} />
        <StatCard icon={Trophy} label="Başarılı" value={String(kpis.completed)} iconClassName="bg-green-50 text-green-700" />
        <StatCard icon={XCircle} label="Başarısız" value={String(kpis.unsuccessful)} iconClassName="bg-red-50 text-red-700" />
        <StatCard icon={TrendingUp} label="Dönüşüm Oranı" value={`%${kpis.conversionRate}`} iconClassName="bg-brand-light text-brand" />
      </div>

      {referrals.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Henüz size yönlendirilmiş bir müşteri bulunmuyor.
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
                <th className="px-4 py-3">Yanıt</th>
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
                  <td className="px-4 py-3">
                    {referral.status === "pending" ? (
                      <div className="flex items-center gap-2">
                        <form action={acceptReferral}>
                          <input type="hidden" name="referralId" value={referral.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-card-border px-2 py-1 text-xs text-green-700 hover:bg-background"
                          >
                            Kabul Et
                          </button>
                        </form>
                        <form action={rejectReferral} className="flex items-center gap-1">
                          <input type="hidden" name="referralId" value={referral.id} />
                          <input
                            name="reason"
                            required
                            placeholder="Ret gerekçesi"
                            className="w-32 rounded-lg border border-card-border px-2 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-card-border px-2 py-1 text-xs text-red-700 hover:bg-background"
                          >
                            Reddet
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
