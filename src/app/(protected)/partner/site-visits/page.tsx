import { createClient } from "@/lib/supabase/server";
import { getPartnerSiteVisits } from "@/lib/data/leads";
import { SetHeaderContent } from "@/components/page-header-slot";
import { SiteVisitsList } from "./site-visits-list";

export default async function PartnerSiteVisitsPage() {
  const supabase = await createClient();
  const visits = await getPartnerSiteVisits(supabase);

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Keşif Ziyaretleri</h1>
      </SetHeaderContent>

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Planlanmış bir keşif ziyareti bulunmuyor.
        </div>
      ) : (
        <SiteVisitsList visits={visits} />
      )}
    </div>
  );
}
