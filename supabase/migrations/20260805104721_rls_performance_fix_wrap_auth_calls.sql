-- =========================================================
-- Performans düzeltmesi: RLS politikalarında auth.uid() /
-- private.current_role() / private.current_partner_id()
-- çağrılarını (select ...) ile sarmalayarak satır başına değil
-- sorgu başına bir kez değerlendirilmelerini sağlıyoruz.
-- (Supabase advisor: auth_rls_initplan)
-- =========================================================

-- partners
drop policy partners_select on public.partners;
drop policy partners_insert on public.partners;
drop policy partners_update on public.partners;

create policy partners_select on public.partners
for select
using (
  (select private.current_role()) = 'pv_admin'
  or ((select private.current_role()) = 'pv_sales' and status = 'active')
  or (
    (select private.current_role()) in ('partner_admin','partner_employee')
    and id = (select private.current_partner_id())
  )
);

create policy partners_insert on public.partners
for insert
with check ((select private.current_role()) = 'pv_admin');

create policy partners_update on public.partners
for update
using ((select private.current_role()) = 'pv_admin')
with check ((select private.current_role()) = 'pv_admin');

-- partner_service_regions
drop policy partner_service_regions_select on public.partner_service_regions;
drop policy partner_service_regions_write on public.partner_service_regions;

create policy partner_service_regions_select on public.partner_service_regions
for select
using (exists (select 1 from public.partners p where p.id = partner_id));

create policy partner_service_regions_write on public.partner_service_regions
for all
using ((select private.current_role()) = 'pv_admin')
with check ((select private.current_role()) = 'pv_admin');

-- partner_capabilities
drop policy partner_capabilities_select on public.partner_capabilities;
drop policy partner_capabilities_write on public.partner_capabilities;

create policy partner_capabilities_select on public.partner_capabilities
for select
using (exists (select 1 from public.partners p where p.id = partner_id));

create policy partner_capabilities_write on public.partner_capabilities
for all
using ((select private.current_role()) = 'pv_admin')
with check ((select private.current_role()) = 'pv_admin');

-- leads
drop policy leads_select_pv on public.leads;
drop policy leads_insert_pv on public.leads;
drop policy leads_update_pv on public.leads;
drop policy leads_select_partner on public.leads;

create policy leads_select_pv on public.leads
for select
using (
  (select private.current_role()) = 'pv_admin'
  or ((select private.current_role()) = 'pv_sales' and owner_id = (select auth.uid()))
);

create policy leads_select_partner on public.leads
for select
using (
  exists (
    select 1 from public.partner_referrals pr
    where pr.lead_id = leads.id
      and (
        ((select private.current_role()) = 'partner_admin' and pr.partner_id = (select private.current_partner_id()))
        or (
          (select private.current_role()) = 'partner_employee'
          and pr.partner_id = (select private.current_partner_id())
          and pr.assigned_employee_id = (select auth.uid())
        )
      )
  )
);

create policy leads_insert_pv on public.leads
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or ((select private.current_role()) = 'pv_sales' and owner_id = (select auth.uid()))
);

create policy leads_update_pv on public.leads
for update
using (
  (select private.current_role()) = 'pv_admin'
  or ((select private.current_role()) = 'pv_sales' and owner_id = (select auth.uid()))
)
with check (
  (select private.current_role()) = 'pv_admin'
  or ((select private.current_role()) = 'pv_sales' and owner_id = (select auth.uid()))
);

-- lead_stage_history
drop policy lead_stage_history_select on public.lead_stage_history;
drop policy lead_stage_history_insert on public.lead_stage_history;
drop policy lead_stage_history_select_partner on public.lead_stage_history;

create policy lead_stage_history_select on public.lead_stage_history
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
);

create policy lead_stage_history_select_partner on public.lead_stage_history
for select
using (
  exists (
    select 1 from public.partner_referrals pr
    where pr.lead_id = lead_stage_history.lead_id
      and (
        ((select private.current_role()) = 'partner_admin' and pr.partner_id = (select private.current_partner_id()))
        or (
          (select private.current_role()) = 'partner_employee'
          and pr.partner_id = (select private.current_partner_id())
          and pr.assigned_employee_id = (select auth.uid())
        )
      )
  )
);

create policy lead_stage_history_insert on public.lead_stage_history
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
);

-- partner_referrals
drop policy partner_referrals_select on public.partner_referrals;
drop policy partner_referrals_insert on public.partner_referrals;
drop policy partner_referrals_update on public.partner_referrals;

create policy partner_referrals_select on public.partner_referrals
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or ((select private.current_role()) = 'partner_admin' and partner_id = (select private.current_partner_id()))
  or (
    (select private.current_role()) = 'partner_employee'
    and partner_id = (select private.current_partner_id())
    and assigned_employee_id = (select auth.uid())
  )
);

create policy partner_referrals_insert on public.partner_referrals
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
);

create policy partner_referrals_update on public.partner_referrals
for update
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or ((select private.current_role()) = 'partner_admin' and partner_id = (select private.current_partner_id()))
)
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or ((select private.current_role()) = 'partner_admin' and partner_id = (select private.current_partner_id()))
);

-- activities
drop policy activities_select on public.activities;
drop policy activities_insert on public.activities;
drop policy activities_update on public.activities;

create policy activities_select on public.activities
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    visibility = 'shared_with_partner'
    and referral_id is not null
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = referral_id
        and (
          ((select private.current_role()) = 'partner_admin' and pr.partner_id = (select private.current_partner_id()))
          or (
            (select private.current_role()) = 'partner_employee'
            and pr.partner_id = (select private.current_partner_id())
            and pr.assigned_employee_id = (select auth.uid())
          )
        )
    )
  )
);

create policy activities_insert on public.activities
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or (
    (select private.current_role()) = 'pv_sales'
    and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  )
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

create policy activities_update on public.activities
for update
using ((select private.current_role()) = 'pv_admin' or created_by = (select auth.uid()))
with check ((select private.current_role()) = 'pv_admin' or created_by = (select auth.uid()));

-- offers
drop policy offers_select on public.offers;
drop policy offers_insert on public.offers;
drop policy offers_update on public.offers;

create policy offers_select on public.offers
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    referral_id is not null
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = referral_id
        and (
          ((select private.current_role()) = 'partner_admin' and pr.partner_id = (select private.current_partner_id()))
          or (
            (select private.current_role()) = 'partner_employee'
            and pr.partner_id = (select private.current_partner_id())
            and pr.assigned_employee_id = (select auth.uid())
          )
        )
    )
  )
);

create policy offers_insert on public.offers
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or (
    (select private.current_role()) = 'pv_sales'
    and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  )
  or (
    (select private.current_role()) in ('partner_admin','partner_employee')
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

create policy offers_update on public.offers
for update
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    referral_id is not null
    and (select private.current_role()) = 'partner_admin'
    and exists (select 1 from public.partner_referrals pr where pr.id = referral_id and pr.partner_id = (select private.current_partner_id()))
  )
)
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    referral_id is not null
    and (select private.current_role()) = 'partner_admin'
    and exists (select 1 from public.partner_referrals pr where pr.id = referral_id and pr.partner_id = (select private.current_partner_id()))
  )
);

-- offer_versions
drop policy offer_versions_update on public.offer_versions;

create policy offer_versions_update on public.offer_versions
for update
using ((select private.current_role()) = 'pv_admin' or created_by = (select auth.uid()))
with check ((select private.current_role()) = 'pv_admin' or created_by = (select auth.uid()));

-- sales_outcomes
drop policy sales_outcomes_select on public.sales_outcomes;
drop policy sales_outcomes_insert on public.sales_outcomes;
drop policy sales_outcomes_update on public.sales_outcomes;

create policy sales_outcomes_select on public.sales_outcomes
for select
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  or (
    referral_id is not null
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = referral_id
        and (
          ((select private.current_role()) = 'partner_admin' and pr.partner_id = (select private.current_partner_id()))
          or (
            (select private.current_role()) = 'partner_employee'
            and pr.partner_id = (select private.current_partner_id())
            and pr.assigned_employee_id = (select auth.uid())
          )
        )
    )
  )
);

create policy sales_outcomes_insert on public.sales_outcomes
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or (
    (select private.current_role()) = 'pv_sales'
    and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
  )
);

create policy sales_outcomes_update on public.sales_outcomes
for update
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
)
with check (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = (select auth.uid()))
);

-- notifications
drop policy notifications_select on public.notifications;
drop policy notifications_update on public.notifications;

create policy notifications_select on public.notifications
for select
using (
  recipient_user_id = (select auth.uid())
  or (select private.current_role()) = 'pv_admin'
);

create policy notifications_update on public.notifications
for update
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));
