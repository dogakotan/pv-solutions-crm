-- Partner çalışanı/admin'i profiles.partner_id ataması + rol ataması
-- artık tek SECURITY DEFINER RPC ile atomik yapılıyor. Auth kullanıcısı
-- (admin.auth.admin.createUser) Postgres transaction'ının dışında kalan
-- bir Admin API çağrısı olduğu için orada değil — ama önceki durumda
-- profiles.update + set_user_role de birbirinden ayrı iki çağrıydı ve
-- aralarında elle rollback mantığı vardı. Artık bu ikisi tek RPC'de
-- atomik; başarısız olursa app tarafı yalnızca auth kullanıcısını
-- (deleteUser) geri almak zorunda, DB tarafı zaten transaction ile
-- kendini geri alır.

create or replace function public.provision_partner_employee(
  p_user_id uuid,
  p_partner_id uuid,
  p_phone text,
  p_role public.app_role
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

  if p_role not in ('partner_admin', 'partner_employee') then
    raise exception 'Geçersiz rol';
  end if;

  if not exists (select 1 from public.partners where id = p_partner_id) then
    raise exception 'Partner bulunamadı';
  end if;

  update public.profiles
  set partner_id = p_partner_id, phone = p_phone
  where id = p_user_id
  returning * into v_result;

  if v_result is null then
    raise exception 'Kullanıcı profili bulunamadı';
  end if;

  perform public.set_user_role(p_user_id, p_role);

  return v_result;
end;
$$;

revoke execute on function public.provision_partner_employee(uuid, uuid, text, public.app_role) from public;
grant execute on function public.provision_partner_employee(uuid, uuid, text, public.app_role) to authenticated;
