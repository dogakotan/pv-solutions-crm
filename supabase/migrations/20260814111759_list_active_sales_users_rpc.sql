-- first_call rolü profiles/user_role_assignments RLS'i altında kendi
-- satırı dışındakileri göremiyor (profiles_select_own_or_admin,
-- role_assignments_select_own_or_admin: sadece pv_admin ya da kendi
-- id'si). assign_lead_to_sales RPC'si first_call'a lead'i kendi
-- satış çalışanına atamasına izin veriyor ama arayüzdeki "satış
-- çalışanı seç" listesini doldurmak için aktif pv_sales kullanıcılarını
-- görmesi gerekiyor. Bu RPC sadece id+full_name döndürerek (tam profil
-- değil) bu ihtiyacı minimal yetkiyle karşılıyor.
create or replace function public.list_active_sales_users()
returns table(id uuid, full_name text)
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
  select p.id, p.full_name
  from public.profiles p
  join public.user_role_assignments ura on ura.user_id = p.id
  where p.is_active = true and ura.role = 'pv_sales'
  order by p.full_name;
end;
$$;

revoke execute on function public.list_active_sales_users() from public;
revoke execute on function public.list_active_sales_users() from anon;
grant execute on function public.list_active_sales_users() to authenticated;
