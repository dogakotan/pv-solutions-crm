import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TableSkeleton } from "@/components/skeletons";
import { getVisibleLeads } from "@/lib/data/leads";
import { LeadsTable } from "@/components/leads-table";
import { SetHeaderContent } from "@/components/page-header-slot";

export default function SalesMyLeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Leadlerim</h1>
      </SetHeaderContent>

      <Suspense fallback={<TableSkeleton rows={8} />}>
        <MyLeadsContent />
      </Suspense>
    </div>
  );
}

async function MyLeadsContent() {
  const supabase = await createClient();
  const leads = await getVisibleLeads(supabase, 200);

  return <LeadsTable leads={leads} emptyMessage="Şu an takip edilen bir lead yok." />;
}
