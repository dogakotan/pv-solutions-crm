import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getDefaultRouteForRole } from "@/lib/auth/roles";
import { getLeadById, getLeadInternalNote, getLeadStageHistory } from "@/lib/data/leads";
import { getActivitiesForLead, getAcceptedReferralForLead } from "@/lib/data/activities";
import { getSalesOutcomeForLead } from "@/lib/data/sales-outcomes";
import { getOfferVersionsForLead } from "@/lib/data/offers";
import { LeadStageBadge, LeadScoreBadge } from "@/components/lead-badges";
import { ActivityTypeBadge, ActivityVisibilityBadge } from "@/components/activity-badges";
import { ActivityForm } from "./activity-form";
import { SalesOutcomeForm } from "./sales-outcome-form";

const INTEREST_LABELS: Record<string, string> = {
  yes: "Evet",
  no: "Hayır",
  considering: "Değerlendiriyor",
};

function interestLabel(value: string | null): string {
  if (!value) return "—";
  return INTEREST_LABELS[value] ?? value;
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Bu sayfa yalnızca pv-taraf rolleri içindir (admin/first_call/sales).
  // Partner tarafı kendi maskelenmiş görünümlerini (assigned-leads,
  // site-visits) kullanır — leads tablosunun tüm kolonlarını (internal_notes,
  // phone, address) partnere doğrudan açmamak için burada engellenir.
  const { appRole } = await requireRole(["admin", "first_call", "sales"]);

  const supabase = await createClient();
  const [lead, activities, acceptedReferral, salesOutcome, offerVersions, stageHistory, internalNote] = await Promise.all([
    getLeadById(supabase, id),
    getActivitiesForLead(supabase, id),
    getAcceptedReferralForLead(supabase, id),
    getSalesOutcomeForLead(supabase, id),
    getOfferVersionsForLead(supabase, id),
    getLeadStageHistory(supabase, id),
    getLeadInternalNote(supabase, id),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href={getDefaultRouteForRole(appRole)} className="text-sm text-muted hover:text-brand">
        ← Geri
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{lead.leadNo}</h1>
          <p className="text-sm text-muted">
            {lead.customerName} — {lead.city}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LeadStageBadge stage={lead.stage} />
          <LeadScoreBadge score={lead.leadScore} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">İletişim Bilgileri</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Telefon</dt>
              <dd className="text-foreground">{lead.phone}</dd>
            </div>
            {lead.alternatePhone && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Alternatif Telefon</dt>
                <dd className="text-foreground">{lead.alternatePhone}</dd>
              </div>
            )}
            {lead.email && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">E-posta</dt>
                <dd className="text-foreground">{lead.email}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Şehir / İlçe</dt>
              <dd className="text-foreground">
                {lead.city}
                {lead.district ? ` / ${lead.district}` : ""}
              </dd>
            </div>
            {lead.address && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Adres</dt>
                <dd className="text-right text-foreground">{lead.address}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Sahiplik</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Oluşturan / Sahip</dt>
              <dd className="text-foreground">{lead.ownerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">First Call</dt>
              <dd className="text-foreground">{lead.firstCallUserName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Satış</dt>
              <dd className="text-foreground">{lead.salesUserName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Kaynak</dt>
              <dd className="text-foreground">{lead.source}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Öncelik</dt>
              <dd className="text-foreground">{lead.priority}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Sonraki Takip</dt>
              <dd className="text-foreground">
                {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString("tr-TR") : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Teknik Detaylar</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Bina Tipi</dt>
              <dd className="text-foreground">{lead.buildingType ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Çatı Alanı</dt>
              <dd className="text-foreground">{lead.roofAreaM2 ? `${lead.roofAreaM2} m²` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Tahmini Kapasite</dt>
              <dd className="text-foreground">
                {lead.estimatedCapacityKwp ? `${lead.estimatedCapacityKwp} kWp` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Havuz İlgisi</dt>
              <dd className="text-foreground">{interestLabel(lead.poolInterest)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Isı Pompası İlgisi</dt>
              <dd className="text-foreground">{interestLabel(lead.heatPumpInterest)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Elektrikli Araç İlgisi</dt>
              <dd className="text-foreground">{interestLabel(lead.evInterest)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Batarya İlgisi</dt>
              <dd className="text-foreground">{interestLabel(lead.batteryInterest)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Rakip Teklifi</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Durum</dt>
              <dd className="text-foreground">
                {lead.competitorOfferStatus === "exists"
                  ? "Rakip teklifi var"
                  : lead.competitorOfferStatus === "none"
                    ? "Rakip teklifi yok"
                    : "Bilinmiyor"}
              </dd>
            </div>
            {lead.competitorOfferNote && (
              <div className="flex flex-col gap-1">
                <dt className="text-muted">Not</dt>
                <dd className="text-foreground">{lead.competitorOfferNote}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {(lead.generalNotes || internalNote) && (
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Notlar</h2>
          <div className="flex flex-col gap-4 text-sm">
            {lead.generalNotes && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Genel Not</p>
                <p className="text-foreground">{lead.generalNotes}</p>
              </div>
            )}
            {internalNote && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">İç Not</p>
                <p className="text-foreground">{internalNote}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Aktiviteler</h2>

        <div className="mb-6 flex flex-col gap-3">
          {activities.length === 0 ? (
            <p className="text-sm text-muted">Bu lead için henüz bir aktivite kaydedilmemiş.</p>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col gap-2 rounded-xl border border-card-border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <ActivityTypeBadge type={activity.activityType} />
                    <ActivityVisibilityBadge visibility={activity.visibility} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  {activity.description && (
                    <p className="mt-1 text-sm text-muted">{activity.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {activity.createdByName}
                    {activity.occurredAt && ` — ${new Date(activity.occurredAt).toLocaleString("tr-TR")}`}
                  </p>
                </div>
                {activity.nextFollowUpAt && (
                  <p className="whitespace-nowrap text-xs text-muted">
                    Sonraki takip: {new Date(activity.nextFollowUpAt).toLocaleString("tr-TR")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <ActivityForm leadId={lead.id} acceptedReferralId={acceptedReferral?.id ?? null} />
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Satış Sonucu</h2>

        {salesOutcome ? (
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Sonuç</dt>
              <dd className={salesOutcome.outcome === "won" ? "font-medium text-green-700" : "font-medium text-red-700"}>
                {salesOutcome.outcome === "won" ? "Kazanıldı" : "Kaybedildi"}
              </dd>
            </div>
            {salesOutcome.outcome === "won" ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Kabul Edilen Teklif</dt>
                  <dd className="text-foreground">
                    {salesOutcome.offerNo} — Rev.{salesOutcome.revisionNo}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Nihai Tutar</dt>
                  <dd className="text-foreground">
                    {salesOutcome.finalAmount?.toLocaleString("tr-TR")} {salesOutcome.currency}
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Gerekçe</dt>
                <dd className="text-foreground">{salesOutcome.lostReason}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Tarih</dt>
              <dd className="text-foreground">
                {new Date(salesOutcome.resultDate).toLocaleDateString("tr-TR")}
              </dd>
            </div>
            {salesOutcome.notes && (
              <div className="flex flex-col gap-1">
                <dt className="text-muted">Not</dt>
                <dd className="text-foreground">{salesOutcome.notes}</dd>
              </div>
            )}
          </dl>
        ) : appRole === "first_call" ? (
          <p className="text-sm text-muted">Bu lead için henüz bir satış sonucu kaydedilmemiş.</p>
        ) : (
          <SalesOutcomeForm leadId={lead.id} offerVersions={offerVersions} />
        )}
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Süreç Geçmişi</h2>

        {stageHistory.length === 0 ? (
          <p className="text-sm text-muted">Bu lead için henüz bir aşama değişikliği kaydedilmemiş.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stageHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-xl border border-card-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm">
                  {entry.fromStage ? <LeadStageBadge stage={entry.fromStage} /> : <span className="text-xs text-muted">—</span>}
                  <span className="text-muted">→</span>
                  <LeadStageBadge stage={entry.toStage} />
                </div>
                <p className="text-xs text-muted">
                  {entry.changedByName ?? "Sistem"} — {new Date(entry.changedAt).toLocaleString("tr-TR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
