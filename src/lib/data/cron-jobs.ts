import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type CronJobStatus = {
  jobName: string;
  schedule: string;
  active: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastReturnMessage: string | null;
  lastDurationSeconds: number | null;
};

export async function getCronJobStatuses(supabase: TypedSupabaseClient): Promise<CronJobStatus[]> {
  const { data, error } = await supabase.rpc("get_cron_job_status");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    jobName: row.job_name,
    schedule: row.schedule,
    active: row.active,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastReturnMessage: row.last_return_message,
    lastDurationSeconds: row.last_duration_seconds,
  }));
}
