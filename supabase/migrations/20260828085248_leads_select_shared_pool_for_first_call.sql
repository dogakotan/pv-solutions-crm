-- Webhook'tan (create_lead_from_webhook) otomatik gelen leadlerin
-- first_call_user_id'si NULL kalıyor (henüz kimse sahiplenmedi) — bu
-- satır first_call kolonuna "first_call_user_id is null" ekleyerek
-- TÜM first_call kullanıcılarına görünür kılıyor (paylaşımlı havuz).
-- Mevcut davranışa etkisi yok: create_lead RPC'si bugüne kadar
-- first_call_user_id'yi HER ZAMAN doldurdu, bu yüzden hiçbir mevcut
-- leadde bu alan null değil.
drop policy leads_select on public.leads;

create policy leads_select on public.leads
for select
using (
  ((select private.current_role()) = 'pv_admin')
  or (
    deleted_at is null
    and (
      (((select private.current_role()) = 'pv_sales') and (owner_id = (select auth.uid()) or sales_user_id = (select auth.uid())))
      or (((select private.current_role()) = 'first_call') and (created_by = (select auth.uid()) or first_call_user_id = (select auth.uid()) or first_call_user_id is null))
      or private.lead_visible_via_partner_referral(id)
    )
  )
);
