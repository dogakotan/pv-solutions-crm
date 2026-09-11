-- (partner_admin AND partner_id=current_partner_id()) OR (partner_employee
-- AND partner_id=current_partner_id() AND assigned_employee_id=auth.uid())
-- birebir tekrarlanıyordu: activities_select, activities_insert,
-- offers_select, offers_insert, sales_outcomes_select — hepsi bir
-- partner_referrals satırına referral_id üzerinden bakıp bu kontrolü
-- yapıyordu. Codebase'te zaten bu tip tekrarı private.* helper'a
-- çıkarma emsali var (private.referral_lead_owned_by_me,
-- 20260806074908_fix_leads_partner_referrals_rls_recursion.sql) — bu
-- desen buraya hiç uygulanmamıştı. NOT: offers_update ve
-- partner_referrals_update BİLİNÇLİ olarak daha dar (yalnızca
-- partner_admin, partner_employee yok) — bu helper'ı KULLANMIYORLAR,
-- yetki genişletmemek için dokunulmadı.
create or replace function private.referral_visible_to_partner(p_referral_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.partner_referrals pr
    where pr.id = p_referral_id
      and (
        ((select private.current_role()) = 'partner_admin' and pr.partner_id = (select private.current_partner_id()))
        or (
          (select private.current_role()) = 'partner_employee'
          and pr.partner_id = (select private.current_partner_id())
          and pr.assigned_employee_id = (select auth.uid())
        )
      )
  );
$$;

revoke execute on function private.referral_visible_to_partner(uuid) from public;
revoke execute on function private.referral_visible_to_partner(uuid) from anon;
grant execute on function private.referral_visible_to_partner(uuid) to authenticated;

-- activities_select
drop policy activities_select on public.activities;
create policy activities_select on public.activities
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    visibility = 'shared_with_partner'
    and referral_id is not null
    and private.referral_visible_to_partner(referral_id)
  )
);

-- activities_insert
drop policy activities_insert on public.activities;
create policy activities_insert on public.activities
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    (select private.current_role()) in ('partner_admin', 'partner_employee')
    and visibility = 'shared_with_partner'
    and referral_id is not null
    and private.referral_visible_to_partner(referral_id)
  )
);

-- offers_select
drop policy offers_select on public.offers;
create policy offers_select on public.offers
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (referral_id is not null and private.referral_visible_to_partner(referral_id))
);

-- offers_insert
drop policy offers_insert on public.offers;
create policy offers_insert on public.offers
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or (
    (select private.current_role()) = 'pv_sales'
    and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  )
  or (
    (select private.current_role()) in ('partner_admin', 'partner_employee')
    and referral_id is not null
    and private.referral_visible_to_partner(referral_id)
  )
);

-- sales_outcomes_select
drop policy sales_outcomes_select on public.sales_outcomes;
create policy sales_outcomes_select on public.sales_outcomes
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (referral_id is not null and private.referral_visible_to_partner(referral_id))
);
