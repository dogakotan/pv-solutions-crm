import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getPartnerById, getPartnerEmployees, getPartnerInternalNote } from "@/lib/data/partners";
import { getSalesOutcomesForPartner } from "@/lib/data/sales-outcomes";
import { PartnerStatusBadge } from "../partner-status-badge";
import { PartnerDetailTabs } from "./partner-detail-tabs";
import { PARTNER_TABS, type PartnerTabKey } from "./partner-tabs";
import { PartnerInfoTab } from "./partner-info-tab";

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { id } = await params;
  const [partner, employees, salesOutcomes, internalNote] = await Promise.all([
    getPartnerById(supabase, id),
    getPartnerEmployees(supabase, id),
    getSalesOutcomesForPartner(supabase, id),
    getPartnerInternalNote(supabase, id),
  ]);

  if (!partner) {
    notFound();
  }

  const { tab } = await searchParams;
  const initialTab: PartnerTabKey = PARTNER_TABS.some((t) => t.key === tab)
    ? (tab as PartnerTabKey)
    : "info";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/partners" className="text-sm text-muted hover:text-brand">
        ← Partnerler
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{partner.name}</h1>
          <p className="text-sm text-muted">{partner.partnerCode}</p>
        </div>
        <PartnerStatusBadge status={partner.status} />
      </div>

      <PartnerDetailTabs
        partner={partner}
        employees={employees}
        salesOutcomes={salesOutcomes}
        internalNote={internalNote}
        initialTab={initialTab}
        infoTab={<PartnerInfoTab partner={partner} />}
      />
    </div>
  );
}
