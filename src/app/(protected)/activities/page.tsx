import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { getVisibleActivities } from "@/lib/data/activities";
import { EmptyState } from "@/components/empty-state";
import { ListChecks } from "lucide-react";
import { ActivitiesList } from "./activities-list";

export default async function ActivitiesPage() {
  const { appRole } = await getCurrentUserRole();
  const supabase = await createClient();
  const activities = await getVisibleActivities(supabase, 200);
  // Lead detay sayfası (/leads/[id]) yalnızca admin/first_call/sales'e açık
  // (internal_notes/phone gibi partnere hiç gösterilmemesi gereken alanlar
  // içeriyor) — partner burada lead'e tıklayamaz, düz metin görür.
  const canOpenLead = appRole !== "partner";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Aktiviteler</h1>

      {activities.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Henüz aktivite yok"
          description="Bir lead üzerinde görüşme, not veya görev kaydettiğinizde burada görünecek."
        />
      ) : (
        <ActivitiesList activities={activities} canOpenLead={canOpenLead} />
      )}
    </div>
  );
}
