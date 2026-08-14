import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { requireRole } from "@/lib/auth/require-role";
import { getActivePvOwnerOptions } from "@/lib/data/assignments";
import { NewPartnerForm } from "./new-partner-form";

export default async function NewPartnerPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const pvOwners = await getActivePvOwnerOptions(supabase);

  return (
    <div className="flex flex-col gap-6">
      <BackLink fallbackHref="/partners" label="Partnerler" />

      <h1 className="text-2xl font-semibold text-foreground">Yeni Partner</h1>

      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <NewPartnerForm pvOwners={pvOwners} />
      </div>
    </div>
  );
}
