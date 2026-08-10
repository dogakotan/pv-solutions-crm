-- Performans advisor'ı (auth_rls_initplan) yakaladı: bu projedeki diğer
-- tüm RLS politikaları auth.uid()/current_role() çağrılarını (select ...)
-- ile sarıp planlayıcının bunu satır başına değil sorgu başına bir kez
-- değerlendirmesini sağlıyor (bk. 20260805104721_rls_performance_fix_wrap_auth_calls.sql).
-- Bu oturumda eklenen lead_stage_history_select/insert bu kalıbı
-- kullanmamıştı — aynı normalize edilmiş biçime getirildi (davranış aynı,
-- yalnızca ölçekte sorgu planı daha iyi).
drop policy if exists lead_stage_history_select on public.lead_stage_history;
create policy lead_stage_history_select on public.lead_stage_history
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_id
      and (
        (select private.current_role()) = 'pv_admin'
        or (
          l.deleted_at is null
          and (
            ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
            or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
          )
        )
      )
  )
);

drop policy if exists lead_stage_history_insert on public.lead_stage_history;
create policy lead_stage_history_insert on public.lead_stage_history
for insert
with check (
  exists (
    select 1 from public.leads l
    where l.id = lead_id
      and (
        (select private.current_role()) = 'pv_admin'
        or (
          l.deleted_at is null
          and (
            ((select private.current_role()) = 'pv_sales' and (l.owner_id = (select auth.uid()) or l.sales_user_id = (select auth.uid())))
            or ((select private.current_role()) = 'first_call' and (l.created_by = (select auth.uid()) or l.first_call_user_id = (select auth.uid())))
          )
        )
      )
  )
);
