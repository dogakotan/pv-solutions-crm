import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { CardSkeleton } from "@/components/skeletons";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getPartnerById, getPartnerEmployees, getPartnerInternalNote, getOpenReferralsForPartner } from "@/lib/data/partners";
import { getSalesOutcomesForPartner } from "@/lib/data/sales-outcomes";
import { getOffersForPartner } from "@/lib/data/offers";
import { getPartnerPerformance } from "@/lib/data/reports";
import type { Partner } from "@/types/partner";
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
  const { appRole } = await requireRole(["admin", "sales"]);
  const canManagePartners = appRole === "admin";
  const supabase = await createClient();

  const { id } = await params;
  const partner = await getPartnerById(supabase, id);

  if (!partner) {
    notFound();
  }

  const { tab } = await searchParams;
  const initialTab: PartnerTabKey = PARTNER_TABS.some((t) => t.key === tab)
    ? (tab as PartnerTabKey)
    : "info";

  return (
    <div className="flex flex-col gap-6">
      <BackLink fallbackHref="/partners" label="Partnerler" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{partner.name}</h1>
          <p className="text-sm text-muted">{partner.partnerCode}</p>
        </div>
        <PartnerStatusBadge status={partner.status} />
      </div>

      <Suspense fallback={<CardSkeleton lines={6} />}>
        <PartnerDetailTabsSection
          partner={partner}
          partnerId={id}
          initialTab={initialTab}
          canManagePartners={canManagePartners}
        />
      </Suspense>
    </div>
  );
}

async function PartnerDetailTabsSection({
  partner,
  partnerId,
  initialTab,
  canManagePartners,
}: {
  partner: Partner;
  partnerId: string;
  initialTab: PartnerTabKey;
  canManagePartners: boolean;
}) {
  const supabase = await createClient();
  const [employees, salesOutcomes, internalNote, openReferrals, offers, performanceList] = await Promise.all([
    canManagePartners ? getPartnerEmployees(supabase, partnerId) : Promise.resolve([]),
    getSalesOutcomesForPartner(supabase, partnerId),
    canManagePartners ? getPartnerInternalNote(supabase, partnerId) : Promise.resolve(null),
    getOpenReferralsForPartner(supabase, partnerId),
    getOffersForPartner(supabase, partnerId),
    getPartnerPerformance(supabase, { from: null, to: null }),
  ]);
  const performance = performanceList.find((p) => p.partnerId === partnerId) ?? null;

  return (
    <PartnerDetailTabs
      partner={partner}
      employees={employees}
      salesOutcomes={salesOutcomes}
      internalNote={internalNote}
      openReferrals={openReferrals}
      offers={offers}
      performance={performance}
      initialTab={initialTab}
      infoTab={<PartnerInfoTab partner={partner} canManagePartners={canManagePartners} />}
      canManagePartners={canManagePartners}
    />
  );
}
