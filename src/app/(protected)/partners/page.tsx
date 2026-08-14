import { Suspense } from "react";
import Link from "next/link";
import { Users, CheckCircle2, ShoppingCart, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getPartners } from "@/lib/data/partners";
import { StatCard } from "@/components/stat-card";
import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { PartnersTable } from "./partners-table";

export default async function PartnersPage() {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Partnerler</h1>
          <p className="text-sm text-muted">Bayi ve iş ortağı firmalar</p>
        </div>
        <Link
          href="/partners/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Yeni Partner
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <KpiGridSkeleton count={4} />
            <TableSkeleton rows={8} />
          </div>
        }
      >
        <PartnersContent />
      </Suspense>
    </div>
  );
}

async function PartnersContent() {
  const supabase = await createClient();
  const partners = await getPartners(supabase);

  const totalPartners = partners.length;
  const activePartners = partners.filter((p) => p.status === "active").length;
  const monthlySales = partners.reduce((sum, p) => sum + p.stats.sales, 0);
  const avgConversion =
    partners.length === 0
      ? 0
      : partners.reduce((sum, p) => sum + p.stats.conversionRate, 0) / partners.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Toplam Partner" value={String(totalPartners)} />
        <StatCard
          icon={CheckCircle2}
          iconClassName="bg-green-50 text-green-600"
          label="Aktif Partner"
          value={String(activePartners)}
        />
        <StatCard
          icon={ShoppingCart}
          iconClassName="bg-blue-50 text-blue-600"
          label="Bu Ay Satış"
          value={String(monthlySales)}
        />
        <StatCard
          icon={Filter}
          iconClassName="bg-purple-50 text-purple-600"
          label="Ortalama Dönüşüm"
          value={`%${avgConversion.toFixed(1)}`}
        />
      </div>

      <PartnersTable partners={partners} />
    </div>
  );
}
