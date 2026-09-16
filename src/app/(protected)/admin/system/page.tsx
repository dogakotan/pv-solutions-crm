import { Suspense } from "react";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import { getCronJobStatuses } from "@/lib/data/cron-jobs";

const JOB_LABELS: Record<string, string> = {
  "notify-overdue-referrals": "Gecikmiş Partner Yanıtı Bildirimi",
  "expire-stale-offer-versions": "Süresi Dolan Teklifleri Kapat",
  "expire-stale-partner-referrals": "Süresi Dolan Yönlendirmeleri Kapat",
  "cleanup-stale-idempotency-keys": "Eski Idempotency Anahtarlarını Temizle",
};

export default async function SystemStatusPage() {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Sistem Durumu</h1>
      </SetHeaderContent>

      <p className="text-sm text-muted">
        Arka planda periyodik çalışan işlerin (pg_cron) son çalıştırma durumu.
      </p>

      <Suspense fallback={<TableSkeleton rows={4} />}>
        <CronJobsTable />
      </Suspense>
    </div>
  );
}

async function CronJobsTable() {
  const supabase = await createClient();
  const jobs = await getCronJobStatuses(supabase);

  if (jobs.length === 0) {
    return (
      <p className="rounded-2xl border border-card-border bg-card p-6 text-sm text-muted shadow-sm">
        Kayıtlı bir pg_cron işi bulunamadı.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">İş</th>
            <th className="px-4 py-3">Program</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3">Son Çalışma</th>
            <th className="px-4 py-3">Süre</th>
            <th className="px-4 py-3">Mesaj</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobName} className="border-b border-card-border align-top last:border-0">
              <td className="px-4 py-3 font-medium text-foreground">
                {JOB_LABELS[job.jobName] ?? job.jobName}
                {!job.active && (
                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    Pasif
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{job.schedule}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={job.lastStatus} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString("tr-TR") : "Hiç çalışmadı"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {job.lastDurationSeconds !== null ? `${job.lastDurationSeconds}s` : "—"}
              </td>
              <td className="max-w-sm px-4 py-3 text-xs text-muted">
                <p className="truncate" title={job.lastReturnMessage ?? undefined}>
                  {job.lastReturnMessage ?? "—"}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Başarılı
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Başarısız
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted">
      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {status ?? "Bilinmiyor"}
    </span>
  );
}
