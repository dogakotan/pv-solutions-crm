-- Altıncı tur inceleme, KRİTİK bulgu: private.referral_visible_to_partner
-- ve private.lead_visible_via_partner_referral, ilişkili lead'in
-- deleted_at'ine hiç bakmıyordu. leads tablosunun kendi partner-görünürlük
-- politikası (leads_select_partner) deleted_at is null'ı doğru kontrol
-- ediyordu, ama bu iki yardımcı fonksiyonu kullanan TÜM diğer politikalar
-- (activities_select/insert, offers_select/insert, sales_outcomes_select,
-- ve bunlara transitif bağlı offer_versions_select/offer_version_items_select,
-- lead_stage_history_select) bu kontrolden yoksundu — bir admin bir lead'i
-- silse bile partner, o lead'e bağlı referral/teklif/aktivite/satış
-- sonucu/aşama geçmişini görmeye devam ediyordu. Gerçek DB üzerinde
-- (rollback'li transaction'la) doğrulandı: partner_admin, soft-silinmiş
-- bir lead'in referral'ına YENİ bir teklif/aktivite bile ekleyebiliyordu
-- (offers_insert/activities_insert aynı boşluğu taşıyordu).
--
-- Ayrıca partner_referrals_select/update ve offers_update (partner_admin
-- dalı) bu iki helper'ı hiç KULLANMIYOR — leads'e doğrudan bakmadan
-- partner_id/assigned_employee_id kontrolü yapıyorlardı, aynı boşluğu
-- bağımsız olarak taşıyorlardı. Bunlar için raw bir leads subquery yerine
-- (2026-08-06'daki RLS sonsuz döngü hatasını tekrar tetikleme riskini
-- almamak için) yeni bir SECURITY DEFINER yardımcı fonksiyon kullanılıyor.

create or replace function private.lead_not_deleted(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.leads l where l.id = p_lead_id and l.deleted_at is null
  );
$$;

revoke execute on function private.lead_not_deleted(uuid) from public;
revoke execute on function private.lead_not_deleted(uuid) from anon;
grant execute on function private.lead_not_deleted(uuid) to authenticated;

-- referral_visible_to_partner: leads'e join eklenip deleted_at is null şartı kondu.
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
    join public.leads l on l.id = pr.lead_id
    where pr.id = p_referral_id
      and l.deleted_at is null
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

-- lead_visible_via_partner_referral: aynı düzeltme.
create or replace function private.lead_visible_via_partner_referral(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partner_referrals pr
    join public.leads l on l.id = pr.lead_id
    where pr.lead_id = p_lead_id
      and l.deleted_at is null
      and (
        (private.current_role() = 'partner_admin' and pr.partner_id = private.current_partner_id())
        or (
          private.current_role() = 'partner_employee'
          and pr.partner_id = private.current_partner_id()
          and pr.assigned_employee_id = auth.uid()
        )
      )
  );
$$;

-- partner_referrals_select/update: helper kullanmıyordu, ayrıca düzeltildi.
drop policy partner_referrals_select on public.partner_referrals;
create policy partner_referrals_select on public.partner_referrals
for select
using (
  (select private.current_role()) = 'pv_admin'
  or private.referral_lead_owned_by_me(lead_id)
  or (
    private.lead_not_deleted(lead_id)
    and (
      ((select private.current_role()) = 'partner_admin' and partner_id = (select private.current_partner_id()))
      or (
        (select private.current_role()) = 'partner_employee'
        and partner_id = (select private.current_partner_id())
        and assigned_employee_id = (select auth.uid())
      )
    )
  )
);

drop policy partner_referrals_update on public.partner_referrals;
create policy partner_referrals_update on public.partner_referrals
for update
using (
  (select private.current_role()) = 'pv_admin'
  or private.referral_lead_owned_by_me(lead_id)
  or (
    private.lead_not_deleted(lead_id)
    and (select private.current_role()) = 'partner_admin'
    and partner_id = (select private.current_partner_id())
  )
)
with check (
  (select private.current_role()) = 'pv_admin'
  or private.referral_lead_owned_by_me(lead_id)
  or (
    private.lead_not_deleted(lead_id)
    and (select private.current_role()) = 'partner_admin'
    and partner_id = (select private.current_partner_id())
  )
);

-- offers_update (partner_admin dalı): aynı boşluk, aynı düzeltme.
drop policy offers_update on public.offers;
create policy offers_update on public.offers
for update
using (
  (select private.current_role()) = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = offers.lead_id and l.owner_id = (select auth.uid()))
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
  or exists (select 1 from public.leads l where l.id = offers.lead_id and l.owner_id = (select auth.uid()))
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
