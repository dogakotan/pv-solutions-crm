import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getLeadsNeedingSalesAssignment,
  getLeadsNeedingPartnerAssignment,
  getActiveSalesUsers,
  getActivePartners,
} from "@/lib/data/assignments";
import { LeadStageBadge } from "@/components/lead-badges";
import { SalesAssignmentQueue } from "@/components/sales-assignment-queue";
import { TableSkeleton } from "@/components/skeletons";
import { assignToSales, assignToPartner } from "./actions";

export default function AdminAssignmentsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Atamalar</h1>
        <p className="mt-1 text-sm text-muted">
          Atama işlemleri assign_lead_to_sales / assign_lead_to_partner güvenli RPC&apos;leri
          üzerinden yapılır; her işlem audit_logs&apos;a kaydedilir.
        </p>
      </div>

      <Suspense fallback={<TableSkeleton rows={4} />}>
        <SalesAssignmentQueueSection />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={4} />}>
        <PartnerAssignmentQueue />
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

  return <SalesAssignmentQueue leads={salesQueue} salesUsers={salesUsers} assignAction={assignToSales} />;
}

async function PartnerAssignmentQueue() {
  const supabase = await createClient();
  const [partnerQueue, partners] = await Promise.all([
    getLeadsNeedingPartnerAssignment(supabase),
    getActivePartners(supabase),
  ]);

  return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">
          Partnere Atama Bekleyen Leadler ({partnerQueue.length})
        </h2>

        {partnerQueue.length === 0 ? (
          <div className="rounded-2xl border border-card-border bg-card p-8 text-center text-sm text-muted shadow-sm">
            Partnere atama bekleyen lead yok.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Lead No</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Şehir</th>
                  <th className="px-4 py-3">Aşama</th>
                  <th className="px-4 py-3">Ata</th>
                </tr>
              </thead>
              <tbody>
                {partnerQueue.map((lead) => (
                  <tr key={lead.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{lead.leadNo}</td>
                    <td className="px-4 py-3 text-foreground">{lead.customerName}</td>
                    <td className="px-4 py-3 text-muted">{lead.city}</td>
                    <td className="px-4 py-3">
                      <LeadStageBadge stage={lead.stage} />
                    </td>
                    <td className="px-4 py-3">
                      <form action={assignToPartner} className="flex items-center gap-2">
                        <input type="hidden" name="leadId" value={lead.id} />
                        <select
                          name="partnerId"
                          defaultValue=""
                          required
                          className="rounded-lg border border-card-border px-2 py-1 text-sm"
                        >
                          <option value="" disabled>
                            Partner seç
                          </option>
                          {partners.map((partner) => (
                            <option key={partner.id} value={partner.id}>
                              {partner.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background"
                        >
                          Ata
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
  );
}
