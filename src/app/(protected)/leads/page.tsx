import { redirect } from "next/navigation";
import { requireRole, getCurrentUserRole } from "@/lib/auth/require-role";
import { getDefaultRouteForRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import {
  getFirstCallLeadKpis,
  getSalesLeadKpis,
  getPartnerReferralKpis,
  getVisibleLeads,
  getVisiblePartnerReferrals,
} from "@/lib/data/leads";
import { LeadsOverviewTabs } from "./leads-overview-tabs";

/**
 * Yalnızca admin buraya gelir (bkz. requireRole altında). Diğer roller
 * (first_call/sales/partner) kendi tek-amaçlı sayfasına yönlenmeye
 * devam eder — bu sayfa onların yerini almıyor, admin'in üç ayrı sayfa
 * arasında gezinmek yerine tek yerden görebilmesi için var.
 */
export default async function LeadsPage() {
  const { appRole } = await getCurrentUserRole();

  if (appRole !== "admin") {
    redirect(getDefaultRouteForRole(appRole));
  }

  await requireRole(["admin"]);
  const supabase = await createClient();

  const [firstCallKpis, salesKpis, referralKpis, leads, referrals] = await Promise.all([
    getFirstCallLeadKpis(supabase),
    getSalesLeadKpis(supabase),
    getPartnerReferralKpis(supabase),
    getVisibleLeads(supabase, 200),
    getVisiblePartnerReferrals(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Leadler</h1>

      <LeadsOverviewTabs
        firstCallKpis={firstCallKpis}
        salesKpis={salesKpis}
        referralKpis={referralKpis}
        leads={leads}
        referrals={referrals}
      />
    </div>
  );
}
