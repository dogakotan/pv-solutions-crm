import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getLeadsNeedingPartnerAssignment, getActivePartners } from "@/lib/data/assignments";
import { LeadAssignmentQueue } from "@/components/lead-assignment-queue";
import { TableSkeleton } from "@/components/skeletons";
import { assignToPartner } from "./actions";

export default function SalesAssignmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Partnere Yönlendir</h1>
        <p className="mt-1 text-sm text-muted">
          Kurulum/uygulama için bir partnerin devreye girmesi gereken leadlerinizi buradan
          yönlendirin.
        </p>
      </div>

      <Suspense fallback={<TableSkeleton rows={4} />}>
        <AssignmentQueue />
      </Suspense>
    </div>
  );
}

async function AssignmentQueue() {
  const supabase = await createClient();
  const [leads, partners] = await Promise.all([
    getLeadsNeedingPartnerAssignment(supabase),
    getActivePartners(supabase),
  ]);

  return (
    <LeadAssignmentQueue
      leads={leads}
      assignees={partners.map((partner) => ({ id: partner.id, label: partner.name }))}
      assignAction={assignToPartner}
      selectName="partnerId"
      selectPlaceholder="Partner seç"
      title="Partnere Yönlendirme Bekleyen Leadlerim"
      emptyMessage="Partnere yönlendirme bekleyen leadiniz yok."
    />
  );
}
