-- Altıncı tur inceleme, açık madde: provision_partner_employee/
-- provision_staff_user'ın kendi asıl etkisi (profiles.partner_id/phone
-- bağlantısı) hiç doğrudan audit_logs'a yazmıyordu — yalnızca içeriden
-- çağırdıkları set_user_role kendi 'set_role' kaydını bırakıyordu.
-- create_partner gibi kardeş "hesap/varlık oluşturma" RPC'leri kendi
-- eylemini doğrudan logluyor, bu ikisi tutarsız bir istisnaydı.
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

  perform private.write_audit_log(
    'provision_partner_employee', 'profiles', p_user_id,
    null,
    jsonb_build_object('partner_id', p_partner_id, 'role', p_role),
    null
  );

  perform public.set_user_role(p_user_id, p_role);

  return v_result;
end;
$$;

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

  perform private.write_audit_log(
    'provision_staff_user', 'profiles', p_user_id,
    null,
    jsonb_build_object('role', p_role),
    null
  );

  perform public.set_user_role(p_user_id, p_role);

  return v_result;
end;
$$;
