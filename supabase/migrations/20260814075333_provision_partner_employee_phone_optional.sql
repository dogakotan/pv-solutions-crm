-- Postgres, default değerli bir parametreden sonraki tüm parametrelerin
-- de default'a sahip olmasını istiyor — p_phone (default null) p_role'den
-- (default yok) önce geldiği için ilk haliyle hata verdi. Parametre
-- sırası değişince imza değiştiğinden önce eski imzalı fonksiyon drop
-- ediliyor, sonra p_role önce/p_phone sonda (default null) yeniden
-- oluşturuluyor — telefon formda opsiyonel bir alan.
drop function if exists public.provision_partner_employee(uuid, uuid, text, public.app_role);

create or replace function public.provision_partner_employee(
  p_user_id uuid,
  p_partner_id uuid,
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

revoke execute on function public.provision_partner_employee(uuid, uuid, public.app_role, text) from public;
revoke execute on function public.provision_partner_employee(uuid, uuid, public.app_role, text) from anon;
grant execute on function public.provision_partner_employee(uuid, uuid, public.app_role, text) to authenticated;
