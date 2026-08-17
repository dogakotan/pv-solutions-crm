-- pv_admin/pv_sales/first_call icin provision_partner_employee'nin
-- muadili: partner_id atamadan (bu roller partnere bagli degil) yalnizca
-- rol + telefon atar. Auth kullanicisi (auth.admin.createUser) Postgres
-- transaction'i disinda kaldigi icin app tarafinda createStaffUser
-- action'i once auth kullanicisini olusturur, sonra bu RPC'yi cagirir;
-- basarisiz olursa auth kullanicisini geri alir (provision_partner_employee
-- ile ayni desen).
create or replace function public.provision_staff_user(
  p_user_id uuid,
  p_role public.app_role,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.profiles;
begin
  if private.current_role() is distinct from 'pv_admin' then
    raise exception 'Bu işlem yalnızca pv_admin tarafından yapılabilir';
  end if;

  if p_role not in ('pv_admin', 'pv_sales', 'first_call') then
    raise exception 'Geçersiz rol';
  end if;

  update public.profiles
  set phone = p_phone
  where id = p_user_id
  returning * into v_result;

  if v_result is null then
    raise exception 'Kullanıcı profili bulunamadı';
  end if;

  perform public.set_user_role(p_user_id, p_role);

  return v_result;
end;
$$;

revoke execute on function public.provision_staff_user(uuid, public.app_role, text) from public;
revoke execute on function public.provision_staff_user(uuid, public.app_role, text) from anon;
grant execute on function public.provision_staff_user(uuid, public.app_role, text) to authenticated;
