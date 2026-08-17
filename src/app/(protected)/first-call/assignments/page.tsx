import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getLeadsNeedingSalesAssignment, getActiveSalesUsers } from "@/lib/data/assignments";
import { LeadAssignmentQueue } from "@/components/lead-assignment-queue";
import { TableSkeleton } from "@/components/skeletons";
import { assignToSales } from "./actions";

export default function FirstCallAssignmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Satışa Atama</h1>
        <p className="mt-1 text-sm text-muted">
          Puanladığınız ve satışa hazır leadlerinizi bir satış çalışanına atayın.
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
  const [leads, salesUsers] = await Promise.all([
    getLeadsNeedingSalesAssignment(supabase),
    getActiveSalesUsers(supabase),
  ]);

  return (
    <LeadAssignmentQueue
      leads={leads}
      assignees={salesUsers.map((user) => ({ id: user.id, label: user.fullName }))}
      assignAction={assignToSales}
      selectName="salesUserId"
      selectPlaceholder="Satış çalışanı seç"
      title="Satış Çalışanına Atama Bekleyen Leadler"
      emptyMessage="Satışa atama bekleyen leadiniz yok."
    />
  );
}
