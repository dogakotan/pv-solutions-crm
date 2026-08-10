-- lead_stage_history_select/insert yalnızca leads.owner_id = auth.uid()
-- kontrol ediyordu; leads_select_pv politikası ise pv_sales için
-- owner_id OR sales_user_id, first_call için created_by OR
-- first_call_user_id'ye izin veriyor. Sonuç: bir lead'i sales_user_id
-- üzerinden görebilen bir satış kullanıcısı (ör. assign_lead_to_sales ile
-- atanmış ama owner_id'si hâlâ ilk oluşturan first_call kullanıcısında
-- kalan bir lead) o lead'in süreç geçmişini görememesi gerekirken
-- göremiyordu — aynı lead'in kendisini görebildiği halde. leads_select_pv
-- ile birebir aynı görünürlük mantığına hizalandı.
drop policy if exists lead_stage_history_select on public.lead_stage_history;
create policy lead_stage_history_select on public.lead_stage_history
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_id
      and (
        private.current_role() = 'pv_admin'
        or (
          l.deleted_at is null
          and (
            (private.current_role() = 'pv_sales' and (l.owner_id = auth.uid() or l.sales_user_id = auth.uid()))
            or (private.current_role() = 'first_call' and (l.created_by = auth.uid() or l.first_call_user_id = auth.uid()))
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
        private.current_role() = 'pv_admin'
        or (
          l.deleted_at is null
          and (
            (private.current_role() = 'pv_sales' and (l.owner_id = auth.uid() or l.sales_user_id = auth.uid()))
            or (private.current_role() = 'first_call' and (l.created_by = auth.uid() or l.first_call_user_id = auth.uid()))
          )
        )
      )
  )
);
