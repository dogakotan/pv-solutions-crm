import Link from "next/link";
import { NewLeadForm } from "./new-lead-form";

export default function NewLeadPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/first-call/lead-pool" className="text-sm text-muted hover:text-brand">
        ← Lead Havuzu
      </Link>

      <h1 className="text-2xl font-semibold text-foreground">Yeni Lead</h1>

      <div className="max-w-2xl rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <NewLeadForm />
      </div>
    </div>
  );
}
