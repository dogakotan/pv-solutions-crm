import { createClient } from "@/lib/supabase/server";
import { getVisibleOffers } from "@/lib/data/offers";
import { OffersTable } from "./offers-table";

export default async function OffersPage() {
  const supabase = await createClient();
  const offers = await getVisibleOffers(supabase, 200);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Teklifler</h1>

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Görüntülenecek teklif bulunamadı.
        </div>
      ) : (
        <OffersTable offers={offers} />
      )}
    </div>
  );
}
