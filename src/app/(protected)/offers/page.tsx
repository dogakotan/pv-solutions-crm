import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getVisibleOffers } from "@/lib/data/offers";
import { TableSkeleton } from "@/components/skeletons";
import { OffersTable } from "./offers-table";

export default function OffersPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Teklifler</h1>

      <Suspense fallback={<TableSkeleton rows={8} />}>
        <OffersContent />
      </Suspense>
    </div>
  );
}

async function OffersContent() {
  const supabase = await createClient();
  const offers = await getVisibleOffers(supabase, 200);

  if (offers.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        Görüntülenecek teklif bulunamadı.
      </div>
    );
  }

  return <OffersTable offers={offers} />;
}
