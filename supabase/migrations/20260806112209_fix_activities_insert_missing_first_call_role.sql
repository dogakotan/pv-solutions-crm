-- =========================================================
-- activities_insert, first_call rolü hiç var olmadan (2026-08-05)
-- yazılmıştı: yalnızca current_role()='pv_sales' VEYA partner
-- rolleri INSERT yapabiliyordu. leads_role_columns migration'ı
-- (2026-08-06) first_call_user_id/first_call rolünü eklediğinde bu
-- policy güncellenmedi — first_call kullanıcısı kendi sahip olduğu
-- (owner_id=kendisi) bir lead'e bile aktivite ekleyemiyordu.
--
-- activities_select zaten bu şekilde (rol koşulu YOK, yalnızca
-- ownership kontrolü) yazılmış; insert'i de aynı simetriye getiriyoruz.
-- =========================================================

drop policy activities_insert on public.activities;

create policy activities_insert on public.activities
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    (select private.current_role()) in ('partner_admin','partner_employee')
    and visibility = 'shared_with_partner'
    and referral_id is not null
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = referral_id
        and pr.partner_id = (select private.current_partner_id())
        and (
          (select private.current_role()) = 'partner_admin'
          or pr.assigned_employee_id = (select auth.uid())
        )
    )
  )
);
