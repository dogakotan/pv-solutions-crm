-- Supabase performans advisor'ının "multiple permissive policies" uyarısı:
-- aynı rol/işlem için 2 ayrı permissive policy varsa Postgres her ikisini de
-- çalıştırıp OR'luyor — gereksiz çift değerlendirme. Değişiklik öncesi
-- execute_sql ile 4 farklı kullanıcı kimliği × tüm satırlar üzerinde eski/yeni
-- mantığın bit-bit aynı sonucu verdiği doğrulandı (0 uyuşmazlık).
--
-- leads + lead_stage_history: iki SELECT policy'si saf OR ile tek policy'de
-- birleştirildi (davranış değişmedi, yalnızca değerlendirme sayısı azaldı).
--
-- partner_capabilities + partner_service_regions: "write" policy'si FOR ALL
-- idi (SELECT'i de kapsıyordu ve ayrı "select" policy'siyle çakışıyordu).
-- FOR ALL tek bir CREATE POLICY'de INSERT/UPDATE/DELETE'e daraltılamıyor
-- (Postgres yalnızca ALL veya tekil komut destekliyor), bu yüzden üç ayrı
-- admin-only policy'ye bölündü — SELECT artık yalnızca _select policy'sinden
-- geçiyor, çakışma ortadan kalktı.

drop policy leads_select_pv on public.leads;
drop policy leads_select_partner on public.leads;

create policy leads_select on public.leads
for select
using (
  ((select private.current_role()) = 'pv_admin')
  or (
    deleted_at is null
    and (
      (((select private.current_role()) = 'pv_sales') and (owner_id = (select auth.uid()) or sales_user_id = (select auth.uid())))
      or (((select private.current_role()) = 'first_call') and (created_by = (select auth.uid()) or first_call_user_id = (select auth.uid())))
      or private.lead_visible_via_partner_referral(id)
    )
  )
);

drop policy lead_stage_history_select on public.lead_stage_history;
drop policy lead_stage_history_select_partner on public.lead_stage_history;

create policy lead_stage_history_select on public.lead_stage_history
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_stage_history.lead_id
      and (
        ((select private.current_role()) = 'pv_admin')
        or (
          l.deleted_at is null
          and (
            (((select private.current_role()) = 'pv_sales') and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
            or (((select private.current_role()) = 'first_call') and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
          )
        )
      )
  )
  or private.lead_visible_via_partner_referral(lead_id)
);

drop policy partner_capabilities_write on public.partner_capabilities;

create policy partner_capabilities_insert on public.partner_capabilities
for insert
with check ((select private.current_role()) = 'pv_admin');

create policy partner_capabilities_update on public.partner_capabilities
for update
using ((select private.current_role()) = 'pv_admin')
with check ((select private.current_role()) = 'pv_admin');

create policy partner_capabilities_delete on public.partner_capabilities
for delete
using ((select private.current_role()) = 'pv_admin');

drop policy partner_service_regions_write on public.partner_service_regions;

create policy partner_service_regions_insert on public.partner_service_regions
for insert
with check ((select private.current_role()) = 'pv_admin');

create policy partner_service_regions_update on public.partner_service_regions
for update
using ((select private.current_role()) = 'pv_admin')
with check ((select private.current_role()) = 'pv_admin');

create policy partner_service_regions_delete on public.partner_service_regions
for delete
using ((select private.current_role()) = 'pv_admin');
