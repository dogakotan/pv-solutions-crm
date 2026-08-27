-- first_call kullanıcısının haftalık nitelendirme (new -> contacted) trendi.
-- lead_stage_history_select RLS policy'si zaten changed_by/lead ownership'i
-- first_call için created_by/first_call_user_id ile doğru şekilde kapsıyor,
-- bu yüzden SECURITY DEFINER değil, INVOKER (get_first_call_lead_kpis ile
-- aynı desen) — RLS'in verdiği satırlar dışına çıkmıyor.

create or replace function public.get_first_call_qualified_trend(p_weeks integer default 6)
returns table(week_start date, qualified_count bigint)
language sql
stable
set search_path = public
as $$
  select date_trunc('week', changed_at)::date as week_start, count(*) as qualified_count
  from public.lead_stage_history
  where from_stage = 'new'
    and to_stage = 'contacted'
    and changed_by = auth.uid()
    and changed_at >= now() - (p_weeks || ' weeks')::interval
  group by 1
  order by 1;
$$;

revoke execute on function public.get_first_call_qualified_trend(integer) from public;
grant execute on function public.get_first_call_qualified_trend(integer) to authenticated;
