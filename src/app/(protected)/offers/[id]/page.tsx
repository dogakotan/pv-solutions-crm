import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { CardSkeleton } from "@/components/skeletons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { OfferStatusBadge } from "@/components/offer-badges";
import { OfferVersionRow } from "@/components/offer-version-row";
import { getOfferById, getOfferVersions } from "@/lib/data/offers";
import { deleteOfferVersion, respondToOffer } from "@/app/(protected)/leads/[id]/actions";

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const offer = await getOfferById(supabase, id);

  if (!offer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink fallbackHref="/offers" label="Teklifler" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{offer.offerNo}</h1>
          <p className="text-sm text-muted">
            {offer.customerName} — {offer.leadNo}
          </p>
        </div>
        <OfferStatusBadge status={offer.status} />
      </div>

      <Suspense fallback={<CardSkeleton lines={3} />}>
        <RevisionsCard offerId={id} />
      </Suspense>
    </div>
  );
}

async function RevisionsCard({ offerId }: { offerId: string }) {
  const supabase = await createClient();
  const [versions, { dbRole, user }] = await Promise.all([
    getOfferVersions(supabase, offerId),
    getCurrentUserRole(),
  ]);

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-medium text-foreground">Revizyonlar</h2>

      {versions.length === 0 ? (
        <p className="text-sm text-muted">Bu teklif için henüz revizyon girilmemiş.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {versions.map((version) => (
            <OfferVersionRow
              key={version.id}
              version={version}
              excelHref={`/offers/${offerId}/versions/${version.id}/excel`}
              // delete_offer_version RPC'si yalnızca pv_admin VEYA revizyonu
              // OLUŞTURAN sales'e izin veriyor (altıncı tur inceleme).
              canDelete={dbRole === "pv_admin" || (dbRole === "pv_sales" && version.createdBy === user.id)}
              deleteAction={deleteOfferVersion}
              canRespond={dbRole === "partner_admin"}
              respondAction={respondToOffer}
              hiddenFields={{ offerId, offerVersionId: version.id }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
