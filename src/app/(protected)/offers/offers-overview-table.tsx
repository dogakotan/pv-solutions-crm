import Link from "next/link";
import type { OfferOverviewItem } from "@/lib/data/offers";
import { OfferStatusBadge } from "@/components/offer-badges";

export function OffersOverviewTable({
  offers,
  emptyMessage = "Görüntülenecek teklif bulunamadı.",
}: {
  offers: OfferOverviewItem[];
  emptyMessage?: string;
}) {
  if (offers.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Teklif No</th>
            <th className="px-4 py-3">Müşteri</th>
            <th className="px-4 py-3">Tutar</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3">Sonraki Aksiyon</th>
            <th className="px-4 py-3">Oluşturulma</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.id} className="border-b border-card-border last:border-0">
              <td className="px-4 py-3">
                <Link href={`/offers/${offer.id}`} className="font-medium text-brand hover:underline">
                  {offer.offerNo}
                </Link>
              </td>
              <td className="px-4 py-3 text-foreground">{offer.customerName}</td>
              <td className="px-4 py-3 text-muted">
                {offer.amount !== null ? `${offer.amount.toLocaleString("tr-TR")} ${offer.currency}` : "—"}
              </td>
              <td className="px-4 py-3">
                <OfferStatusBadge status={offer.status} />
              </td>
              <td className="px-4 py-3 text-muted">
                {offer.nextActionAt ? new Date(offer.nextActionAt).toLocaleDateString("tr-TR") : "—"}
              </td>
              <td className="px-4 py-3 text-muted">{new Date(offer.createdAt).toLocaleDateString("tr-TR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
