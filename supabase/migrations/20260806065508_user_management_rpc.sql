-- =========================================================
-- Kullanıcı rol/aktiflik yönetimi: admin-only, audit'li RPC'ler.
-- Not: profiles.is_active zaten protect_profile_privileged_columns
-- trigger'ı ile pv_admin'e izin veriyordu; bu RPC'ler asıl olarak
-- audit_logs kaydı + hedef doğrulaması ekliyor.
-- =========================================================

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns public.user_role_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role public.app_role;
  v_result public.user_role_assignments;
begin
  if private.current_role() <> 'pv_admin' then
    raise exception 'Rol atama yetkisi yalnızca pv_admin''e aittir';
  end if;

  if p_role in ('partner_admin','partner_employee') then
    if not exists (select 1 from public.profiles where id = p_user_id and partner_id is not null) then
      raise exception 'partner_admin/partner_employee rolü için kullanıcının profiles.partner_id değeri atanmış olmalı';
    end if;
  end if;

  select role into v_old_role from public.user_role_assignments where user_id = p_user_id;

  insert into public.user_role_assignments (user_id, role, assigned_by)
  values (p_user_id, p_role, auth.uid())
  on conflict (user_id) do update
    set role = excluded.role,
        assigned_by = excluded.assigned_by,
        assigned_at = now()
  returning * into v_result;

  perform private.write_audit_log(
    'set_role', 'user_role_assignments', p_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role),
    null
  );

  return v_result;
end;
$$;

revoke execute on function public.set_user_role(uuid, public.app_role) from public;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

create or replace function public.set_user_active(
  p_user_id uuid,
  p_is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old boolean;
  v_result public.profiles;
begin
  if private.current_role() <> 'pv_admin' then
    raise exception 'Aktif/pasif yapma yetkisi yalnızca pv_admin''e aittir';
  end if;

  select is_active into v_old from public.profiles where id = p_user_id;
  if v_old is null then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_user_id
  returning * into v_result;

  perform private.write_audit_log(
    'set_active', 'profiles', p_user_id,
    jsonb_build_object('is_active', v_old),
    jsonb_build_object('is_active', p_is_active),
    null
  );

  return v_result;
end;
$$;

revoke execute on function public.set_user_active(uuid, boolean) from public;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
