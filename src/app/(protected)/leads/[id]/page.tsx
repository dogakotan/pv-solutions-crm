import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getDefaultRouteForRole, type AppRole } from "@/lib/auth/roles";
import { BackLink } from "@/components/back-link";
import { SetHeaderContent } from "@/components/page-header-slot";
import { CardSkeleton } from "@/components/skeletons";
import {
  getLeadById,
  getLeadInternalNote,
  getLeadStageHistory,
  getAssignedPartnerNameForLead,
  getActiveReferralForLead,
  type LeadStageHistoryItem,
} from "@/lib/data/leads";
import { getActivitiesForLead, getAcceptedReferralForLead } from "@/lib/data/activities";
import { getSalesOutcomeForLead } from "@/lib/data/sales-outcomes";
import { getOfferVersionsForLead, getOfferHistoryForLead } from "@/lib/data/offers";
import { getRecommendedPartnersForLead } from "@/lib/data/partners";
import { LeadStageBadge, LeadScoreBadge, ReferralStatusBadge } from "@/components/lead-badges";
import { ActivityTypeBadge, ActivityVisibilityBadge } from "@/components/activity-badges";
import { OfferVersionRow } from "@/components/offer-version-row";
import { ActivityForm } from "./activity-form";
import { SalesOutcomeForm } from "./sales-outcome-form";
import { OfferForm } from "./offer-form";
import { QualificationForm } from "./qualification-form";
import { assignPartner, deleteOfferVersion, softDeleteLead } from "./actions";
import { DeleteLeadButton } from "./delete-lead-button";
import { INTEREST_OPTIONS } from "@/components/lead-qualification-fields";

const INTEREST_LABELS: Record<string, string> = Object.fromEntries(
  INTEREST_OPTIONS.filter((option) => option.value).map((option) => [option.value, option.label])
);

function interestLabel(value: string | null): string {
  if (!value) return "—";
  return INTEREST_LABELS[value] ?? value;
}

const CARD_CLASS = "rounded-2xl border border-card-border bg-card p-6 shadow-sm";

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

  // offers_insert RLS'i yalnızca pv_admin veya lead'i sahiplenen pv_sales'e
  // izin veriyor — first_call için teklif geçmişi salt-okunur.
  const canManageOffers = appRole !== "first_call";

  // assign_lead_to_partner RPC'si yalnızca pv_admin veya lead'in sales
  // sahibi pv_sales'i kabul ediyor — first_call için ne aktif atama
  // sorgulamaya ne de öneri listesine gerek var.
  const canAssignPartner = appRole === "admin" || appRole === "sales";

  // Nitelendirme alanlarını (puan, ilgi, teknik detay) yalnızca lead'i
  // arayan first_call ve pv_admin düzenleyebilir — sales için salt-okunur
  // "Teknik Detaylar" kartı gösterilir.
  const canQualifyLead = appRole === "first_call" || appRole === "admin";

  const supabase = await createClient();

  // Sayfanın gövdesini (başlık, "Bilgiler"/"Teknik Detaylar"/"Notlar")
  // hemen boyayabilmek için yalnızca BUNLARA gereken 3 hızlı sorgu burada
  // eagerly bekleniyor. Diğer kartların (Partner Ataması, Teklif Geçmişi,
  // Aktiviteler, Satış Sonucu, Süreç Geçmişi) her biri kendi verisini
  // aşağıda kendi Suspense sınırı içinde, birbirinden bağımsız olarak
  // çekiyor — sayfa artık en yavaş sorgu bitene kadar tek blok halinde
  // beklemiyor, her kart kendi hazır olduğu anda beliriyor.
  const [lead, assignedPartnerName, internalNote] = await Promise.all([
    getLeadById(supabase, id),
    getAssignedPartnerNameForLead(supabase, id),
    getLeadInternalNote(supabase, id),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink fallbackHref={getDefaultRouteForRole(appRole)} label="Geri" />

      <SetHeaderContent>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">{lead.customerName}</h1>
            <p className="truncate text-xs text-muted">
              {lead.leadNo} — {lead.city}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LeadStageBadge stage={lead.stage} />
            <LeadScoreBadge score={lead.leadScore} />
            {appRole === "admin" && <DeleteLeadButton leadId={lead.id} deleteAction={softDeleteLead} />}
          </div>
        </div>
      </SetHeaderContent>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={CARD_CLASS}>
          <h2 className="mb-4 text-sm font-medium text-foreground">Bilgiler</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Ad Soyad</dt>
              <dd className="text-foreground">{lead.customerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Açık Adres</dt>
              <dd className="text-right text-foreground">
                {[lead.address, lead.district, lead.city].filter(Boolean).join(", ")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Aşama</dt>
              <dd><LeadStageBadge stage={lead.stage} /></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Durum</dt>
              <dd><LeadScoreBadge score={lead.leadScore} /></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">PV Solution&apos;da İlgilenen Kişi</dt>
              <dd className="text-foreground">{lead.ownerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Atanan Partner</dt>
              <dd className="text-foreground">{assignedPartnerName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Sonraki Takip</dt>
              <dd className="text-foreground">
                {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString("tr-TR") : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {canAssignPartner && (
          <Suspense fallback={<CardSkeleton lines={3} />}>
            <PartnerAtamaCard leadId={lead.id} city={lead.city} district={lead.district} />
          </Suspense>
        )}

        {canQualifyLead ? (
          <div className={CARD_CLASS}>
            <h2 className="mb-4 text-sm font-medium text-foreground">Görüşme Sonucu</h2>
            <QualificationForm key={JSON.stringify(lead)} lead={lead} />
          </div>
        ) : (
          <div className={CARD_CLASS}>
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
        )}

        <Suspense fallback={<CardSkeleton lines={3} />}>
          <TeklifGecmisiCard leadId={lead.id} canManageOffers={canManageOffers} />
        </Suspense>
      </div>

      {((lead.generalNotes && !canQualifyLead) || internalNote) && (
        <div className={CARD_CLASS}>
          <h2 className="mb-4 text-sm font-medium text-foreground">Notlar</h2>
          <div className="flex flex-col gap-4 text-sm">
            {lead.generalNotes && !canQualifyLead && (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton lines={4} />}>
          <AktivitelerCard leadId={lead.id} />
        </Suspense>

        <Suspense fallback={<CardSkeleton lines={4} />}>
          <SatisSonucuCard leadId={lead.id} appRole={appRole} />
        </Suspense>
      </div>

      <Suspense fallback={<CardSkeleton lines={3} />}>
        <SurecGecmisiCard leadId={lead.id} />
      </Suspense>
    </div>
  );
}

async function PartnerAtamaCard({
  leadId,
  city,
  district,
}: {
  leadId: string;
  city: string;
  district: string | null;
}) {
  const supabase = await createClient();
  const activeReferral = await getActiveReferralForLead(supabase, leadId);
  const [recommendedPartners, stageHistory] = await Promise.all([
    activeReferral ? Promise.resolve([]) : getRecommendedPartnersForLead(supabase, { city, district }),
    activeReferral ? getLeadStageHistory(supabase, leadId) : Promise.resolve([]),
  ]);

  return (
    <div className={CARD_CLASS}>
      <h2 className="mb-4 text-sm font-medium text-foreground">
        {activeReferral ? "Partner Aktivitesi" : "Partner Ataması"}
      </h2>

      {activeReferral ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-muted">Atanan Partner</p>
              <p className="font-medium text-foreground">{activeReferral.partnerName}</p>
            </div>
            <ReferralStatusBadge status={activeReferral.status} />
          </div>

          <StageHistoryList items={stageHistory} className="max-h-72 overflow-y-auto pr-1" />
        </div>
      ) : recommendedPartners.length === 0 ? (
        <p className="text-sm text-muted">Bu lead için semt/şehre uygun aktif partner bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-card-border text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3">Partner</th>
                <th className="py-2 pr-3">Semt / Şehir</th>
                <th className="py-2 pr-3">Puan</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {recommendedPartners.map((partner) => (
                <tr key={partner.id} className="border-b border-card-border last:border-0">
                  <td className="py-3 pr-3 font-medium text-foreground">{partner.name}</td>
                  <td className="py-3 pr-3 text-muted">
                    {[partner.serviceRegions.join(", "), partner.city].filter(Boolean).join(" — ") || "—"}
                  </td>
                  <td className="py-3 pr-3 text-foreground">{partner.rating.toFixed(1)}/5</td>
                  <td className="py-3 pr-3">
                    <form action={assignPartner}>
                      <input type="hidden" name="leadId" value={leadId} />
                      <input type="hidden" name="partnerId" value={partner.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-card-border px-3 py-1.5 text-xs hover:bg-background"
                      >
                        Ata
                      </button>
                    </form>
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

async function TeklifGecmisiCard({
  leadId,
  canManageOffers,
}: {
  leadId: string;
  canManageOffers: boolean;
}) {
  const supabase = await createClient();
  const offerHistory = await getOfferHistoryForLead(supabase, leadId);

  return (
    <div className={CARD_CLASS}>
      <h2 className="mb-4 text-sm font-medium text-foreground">Teklif Geçmişi</h2>

      {offerHistory ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {offerHistory.versions.map((version) => (
              <OfferVersionRow
                key={version.id}
                version={version}
                excelHref={`/offers/${offerHistory.offerId}/versions/${version.id}/excel`}
                canDelete={canManageOffers}
                deleteAction={deleteOfferVersion}
                hiddenFields={{
                  leadId,
                  offerId: offerHistory.offerId,
                  offerVersionId: version.id,
                }}
              />
            ))}
          </div>

          {canManageOffers && (
            <OfferForm
              leadId={leadId}
              offerId={offerHistory.offerId}
              latestVersion={offerHistory.versions[0] ?? null}
            />
          )}
        </div>
      ) : canManageOffers ? (
        <OfferForm leadId={leadId} offerId={null} latestVersion={null} />
      ) : (
        <p className="text-sm text-muted">Bu lead için henüz teklif gönderilmemiş.</p>
      )}
    </div>
  );
}

async function AktivitelerCard({ leadId }: { leadId: string }) {
  const supabase = await createClient();
  const [activities, acceptedReferral] = await Promise.all([
    getActivitiesForLead(supabase, leadId),
    getAcceptedReferralForLead(supabase, leadId),
  ]);

  return (
    <div className={CARD_CLASS}>
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

      <ActivityForm leadId={leadId} acceptedReferralId={acceptedReferral?.id ?? null} />
    </div>
  );
}

async function SatisSonucuCard({ leadId, appRole }: { leadId: string; appRole: AppRole }) {
  const supabase = await createClient();
  const [salesOutcome, offerVersions] = await Promise.all([
    getSalesOutcomeForLead(supabase, leadId),
    getOfferVersionsForLead(supabase, leadId),
  ]);

  return (
    <div className={CARD_CLASS}>
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
        <SalesOutcomeForm leadId={leadId} offerVersions={offerVersions} />
      )}
    </div>
  );
}

async function SurecGecmisiCard({ leadId }: { leadId: string }) {
  const supabase = await createClient();
  const stageHistory = await getLeadStageHistory(supabase, leadId);

  return (
    <div className={CARD_CLASS}>
      <h2 className="mb-4 text-sm font-medium text-foreground">Süreç Geçmişi</h2>
      <StageHistoryList items={stageHistory} />
    </div>
  );
}

/**
 * Partner Aktivitesi kartı (partner atandıktan sonra) ve Süreç Geçmişi
 * kartı aynı aşama-geçiş zaman çizelgesini gösterir — tek yerde tutulur,
 * yalnızca kaydırma davranışı `className` ile kart bazında farklılaşır.
 */
function StageHistoryList({ items, className }: { items: LeadStageHistoryItem[]; className?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Bu lead için henüz bir aşama değişikliği kaydedilmemiş.</p>;
  }

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      {items.map((entry) => (
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
  );
}
