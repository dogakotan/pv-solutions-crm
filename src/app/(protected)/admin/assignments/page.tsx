import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getLeadsNeedingSalesAssignment,
  getLeadsNeedingPartnerAssignment,
  getActiveSalesUsers,
  getActivePartners,
} from "@/lib/data/assignments";
import { LeadAssignmentQueue } from "@/components/lead-assignment-queue";
import { TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { assignToSales, assignManyToSales, assignToPartner, assignManyToPartner } from "./actions";

export default function AdminAssignmentsPage() {
  return (
    <div className="flex flex-col gap-8">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Atamalar</h1>
      </SetHeaderContent>

      <p className="text-sm text-muted">
        Atama işlemleri assign_lead_to_sales / assign_lead_to_partner güvenli RPC&apos;leri
        üzerinden yapılır; her işlem audit_logs&apos;a kaydedilir.
      </p>

      <Suspense fallback={<TableSkeleton rows={4} />}>
        <SalesAssignmentQueueSection />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={4} />}>
        <PartnerAssignmentQueueSection />
      </Suspense>
    </div>
  );
}

async function SalesAssignmentQueueSection() {
  const supabase = await createClient();
  const [salesQueue, salesUsers] = await Promise.all([
    getLeadsNeedingSalesAssignment(supabase),
    getActiveSalesUsers(supabase),
  ]);

  return (
    <LeadAssignmentQueue
      leads={salesQueue}
      assignees={salesUsers.map((user) => ({
        id: user.id,
        label: `${user.fullName} (${user.openLeadCount} açık lead)`,
        openLeadCount: user.openLeadCount,
      }))}
      assignAction={assignToSales}
      bulkAssignAction={assignManyToSales}
      selectName="salesUserId"
      selectPlaceholder="Satış çalışanı seç"
      title="Satış Çalışanına Atama Bekleyen Leadler"
      emptyMessage="Satışa atama bekleyen lead yok."
    />
  );
}

async function PartnerAssignmentQueueSection() {
  const supabase = await createClient();
  const [partnerQueue, partners] = await Promise.all([
    getLeadsNeedingPartnerAssignment(supabase),
    getActivePartners(supabase),
  ]);

  return (
    <LeadAssignmentQueue
      leads={partnerQueue}
      assignees={partners.map((partner) => ({ id: partner.id, label: partner.name }))}
      assignAction={assignToPartner}
      bulkAssignAction={assignManyToPartner}
      selectName="partnerId"
      selectPlaceholder="Partner seç"
      title="Partnere Atama Bekleyen Leadler"
      emptyMessage="Partnere atama bekleyen lead yok."
    />
  );
}
