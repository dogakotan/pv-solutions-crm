-- first_call, satışa atama ekranında satış çalışanını sadece isimden
-- seçiyordu — kimde kaç açık lead olduğunu bilmeden. RPC'ye
-- open_lead_count eklendi (won/lost/sale_registered olmayan, silinmemiş
-- lead sayısı) ki first_call dengeli dağıtım yapabilsin.
-- Dönüş tipi değiştiği için CREATE OR REPLACE yetmiyor, DROP gerekiyor.

drop function public.list_active_sales_users();

create or replace function public.list_active_sales_users()
returns table(id uuid, full_name text, open_lead_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.app_role := private.current_role();
begin
  if v_caller_role not in ('pv_admin', 'first_call') then
    raise exception 'Bu listeyi görüntüleme yetkiniz yok';
  end if;

  return query
  select
    p.id,
    p.full_name,
    (
      select count(*)
      from public.leads l
      where l.sales_user_id = p.id
        and l.deleted_at is null
        and l.stage not in ('won', 'lost', 'sale_registered')
    ) as open_lead_count
  from public.profiles p
  join public.user_role_assignments ura on ura.user_id = p.id
  where p.is_active = true and ura.role = 'pv_sales'
  order by p.full_name;
end;
$$;

revoke execute on function public.list_active_sales_users() from public;
revoke execute on function public.list_active_sales_users() from anon;
grant execute on function public.list_active_sales_users() to authenticated;
