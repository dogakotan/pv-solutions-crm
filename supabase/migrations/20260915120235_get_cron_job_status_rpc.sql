-- Yol haritası 5.4: 4 pg_cron job'unun (notify-overdue-referrals,
-- expire-stale-offer-versions, expire-stale-partner-referrals,
-- cleanup-stale-idempotency-keys) uygulama seviyesinde hiçbir görünürlüğü
-- yoktu — biri sessizce başarısız olsa (örn. bir exception fırlatsa) kimse
-- fark etmezdi. pg_cron zaten her çalıştırmayı cron.job_run_details'e
-- yazıyor; bu SECURITY DEFINER RPC sadece pv_admin'e o tabloyu (cron
-- şeması normal authenticated grant'lerinin dışında olduğu için) özetleyip
-- açıyor — job başına en son çalıştırmayı LATERAL join ile alıyor.
create or replace function public.get_cron_job_status()
returns table (
  job_name text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_status text,
  last_return_message text,
  last_duration_seconds numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Cron job durumunu görme yetkisi yalnızca pv_admin''e aittir';
  end if;

  return query
  select
    j.jobname,
    j.schedule,
    j.active,
    r.start_time,
    r.status,
    r.return_message,
    case when r.end_time is not null and r.start_time is not null
      then round(extract(epoch from (r.end_time - r.start_time))::numeric, 2)
      else null
    end
  from cron.job j
  left join lateral (
    select start_time, end_time, status, return_message
    from cron.job_run_details
    where jobid = j.jobid
    order by start_time desc
    limit 1
  ) r on true
  order by j.jobname;
end;
$$;

revoke all on function public.get_cron_job_status() from public;
revoke all on function public.get_cron_job_status() from anon;
grant execute on function public.get_cron_job_status() to authenticated;
