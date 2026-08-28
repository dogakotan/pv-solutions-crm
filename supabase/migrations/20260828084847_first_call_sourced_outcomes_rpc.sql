-- first_call'ın kaynakladığı (first_call_user_id = kendisi) ve satışa
-- devredilmiş leadlerin sonucunu (kazanıldı/kaybedildi/açık) gösteriyor.
-- SECURITY DEFINER olmak ZORUNDA: sales_outcomes_select RLS'i
-- leads.owner_id = auth.uid() üzerinden çalışıyor, ama assign_lead_to_sales
-- owner_id'yi satış temsilcisine devrediyor — first_call invoker olarak
-- çağırsaydı sales_outcomes tarafı RLS tarafından sessizce filtrelenir,
-- her şey "açık" görünürdü (yanlış veri, hata değil). first_call_user_id
-- ise assign_lead_to_sales tarafından hiç değiştirilmiyor, bu yüzden
-- güvenilir, kalıcı bir "kim kaynakladı" anahtarı.

create or replace function public.get_first_call_sourced_outcomes()
returns table(total bigint, won bigint, lost bigint, in_progress bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) as total,
    count(*) filter (where so.outcome = 'won') as won,
    count(*) filter (where so.outcome = 'lost') as lost,
    count(*) filter (where so.outcome is null) as in_progress
  from public.leads l
  left join public.sales_outcomes so on so.lead_id = l.id
  where l.first_call_user_id = auth.uid()
    and l.deleted_at is null
    and l.sales_user_id is not null;
$$;

revoke execute on function public.get_first_call_sourced_outcomes() from public;
revoke execute on function public.get_first_call_sourced_outcomes() from anon;
grant execute on function public.get_first_call_sourced_outcomes() to authenticated;
