-- =========================================================
-- Küçük bulgu düzeltmesi: partner_referrals.assigned_employee_id
-- daha önce herhangi bir profile'a serbestçe atanabiliyordu (RPC
-- dışından, doğrudan UPDATE ile de). Artık INSERT/UPDATE'te her
-- zaman assigned_employee_id'nin partner_id ile eşleşen (aynı
-- partnere ait, partner_admin/partner_employee rolünde) bir
-- kullanıcı olduğu doğrulanıyor.
-- =========================================================

create or replace function private.validate_referral_assigned_employee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_employee_id is not null then
    if not exists (
      select 1
      from public.profiles pr
      join public.user_role_assignments ura on ura.user_id = pr.id
      where pr.id = new.assigned_employee_id
        and pr.partner_id = new.partner_id
        and ura.role in ('partner_admin', 'partner_employee')
    ) then
      raise exception 'Atanan çalışan bu partnere ait değil';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_referral_assigned_employee() from public;

create trigger validate_partner_referrals_assigned_employee
  before insert or update on public.partner_referrals
  for each row
  execute function private.validate_referral_assigned_employee();
