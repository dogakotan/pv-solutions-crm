-- Onbirinci tur inceleme, yüksek bulgu (sistemik boşluk): 20260917121116,
-- soft-silinmiş bir lead'e bağlı offers/activities/sales_outcomes/
-- partner_referrals verisine erişimi yalnızca PARTNER dalında kapattı
-- (private.lead_not_deleted / referral_visible_to_partner). Bu tablolardaki
-- OWNER (pv_sales) dalı hiç dokunulmadan kaldı — leads_select/
-- leads_update_pv'nin kendi owner dalının zaten `deleted_at is null` ile
-- sarmalandığı (bkz. 20260805104721) established pattern'ın aksine, bir
-- lead'in sahibi soft-silindikten SONRA bile o lead'in aktivitelerini,
-- tekliflerini, satış sonucunu ve yönlendirmelerini doğrudan okuyup
-- yazabiliyordu.
--
-- private.referral_lead_owned_by_me tek bir yerde düzeltilerek
-- partner_referrals_insert/select/update'in üçünü birden kapatıyor.
-- offers/activities/sales_outcomes bu helper'ı kullanmıyor (ham inline
-- exists), üçü ayrı ayrı düzeltiliyor.
create or replace function private.referral_lead_owned_by_me(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id
      and l.deleted_at is null
      and private.current_role() = 'pv_sales'
      and (l.owner_id = auth.uid() or l.sales_user_id = auth.uid())
  );
$$;

-- offers_select / offers_insert / offers_update: owner (pv_sales) dalına deleted_at is null eklendi.
drop policy offers_select on public.offers;
create policy offers_select on public.offers
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = offers.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
  or (referral_id is not null and private.referral_visible_to_partner(referral_id))
);

drop policy offers_insert on public.offers;
create policy offers_insert on public.offers
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or (
    (select private.current_role()) = 'pv_sales'
    and exists (
      select 1 from public.leads l
      where l.id = offers.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
    )
  )
  or (
    (select private.current_role()) = any (array['partner_admin'::app_role, 'partner_employee'::app_role])
    and referral_id is not null
    and private.referral_visible_to_partner(referral_id)
  )
);

drop policy offers_update on public.offers;
create policy offers_update on public.offers
for update
using (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = offers.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
  or (
    referral_id is not null
    and (select private.current_role()) = 'partner_admin'
    and private.lead_not_deleted(offers.lead_id)
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = offers.referral_id and pr.partner_id = (select private.current_partner_id())
    )
  )
)
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = offers.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
  or (
    referral_id is not null
    and (select private.current_role()) = 'partner_admin'
    and private.lead_not_deleted(offers.lead_id)
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = offers.referral_id and pr.partner_id = (select private.current_partner_id())
    )
  )
);

-- activities_select / activities_insert: owner (pv_sales) dalına deleted_at is null eklendi.
drop policy activities_select on public.activities;
create policy activities_select on public.activities
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = activities.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
  or (visibility = 'shared_with_partner' and referral_id is not null and private.referral_visible_to_partner(referral_id))
);

drop policy activities_insert on public.activities;
create policy activities_insert on public.activities
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = activities.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
  or (
    (select private.current_role()) = any (array['partner_admin'::app_role, 'partner_employee'::app_role])
    and visibility = 'shared_with_partner'
    and referral_id is not null
    and private.referral_visible_to_partner(referral_id)
  )
);

-- sales_outcomes_select / sales_outcomes_insert / sales_outcomes_update: owner dalına deleted_at is null eklendi.
drop policy sales_outcomes_select on public.sales_outcomes;
create policy sales_outcomes_select on public.sales_outcomes
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = sales_outcomes.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
  or (referral_id is not null and private.referral_visible_to_partner(referral_id))
);

drop policy sales_outcomes_insert on public.sales_outcomes;
create policy sales_outcomes_insert on public.sales_outcomes
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or (
    (select private.current_role()) = 'pv_sales'
    and exists (
      select 1 from public.leads l
      where l.id = sales_outcomes.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
    )
  )
);

drop policy sales_outcomes_update on public.sales_outcomes;
create policy sales_outcomes_update on public.sales_outcomes
for update
using (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = sales_outcomes.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
)
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = sales_outcomes.lead_id and l.deleted_at is null and l.owner_id = (select auth.uid())
  )
);
