import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OfferStatusBadge, OfferVersionStatusBadge } from "@/components/offer-badges";
import { getOfferById, getOfferVersions } from "@/lib/data/offers";

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [offer, versions] = await Promise.all([
    getOfferById(supabase, id),
    getOfferVersions(supabase, id),
  ]);

  if (!offer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/offers" className="text-sm text-muted hover:text-brand">
        ← Teklifler
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{offer.offerNo}</h1>
          <p className="text-sm text-muted">
            {offer.customerName} — {offer.leadNo}
          </p>
        </div>
        <OfferStatusBadge status={offer.status} />
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-foreground">Revizyonlar</h2>

        {versions.length === 0 ? (
          <p className="text-sm text-muted">Bu teklif için henüz revizyon girilmemiş.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex flex-col gap-3 rounded-xl border border-card-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Revizyon #{version.revisionNo} — {version.capacityKwp} kWp
                  </p>
                  <p className="text-sm text-muted">
                    {version.amount.toLocaleString("tr-TR")} {version.currency}
                    {version.vatIncluded ? " (KDV dahil)" : " (KDV hariç)"}
                  </p>
                  {version.scopeSummary && (
                    <p className="mt-1 text-xs text-muted">{version.scopeSummary}</p>
                  )}
                  {version.validUntil && (
                    <p className="mt-1 text-xs text-muted">
                      Geçerlilik: {new Date(version.validUntil).toLocaleDateString("tr-TR")}
                    </p>
                  )}
                </div>
                <OfferVersionStatusBadge status={version.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
