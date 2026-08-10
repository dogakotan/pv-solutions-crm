-- =========================================================
-- leads: first_call/sales rol bazlı sahiplik kolonları + soft delete
-- Mevcut owner_id, stage, *_interest kolonlarına DOKUNULMUYOR
-- (geriye uyumluluk). assigned_partner_id EKLENMİYOR — partner
-- ataması zaten partner_referrals tablosu üzerinden yönetiliyor.
-- =========================================================

alter table public.leads
  add column first_call_user_id uuid references public.profiles(id),
  add column sales_user_id uuid references public.profiles(id),
  add column lead_score text check (lead_score in ('hot','warm','mid','cold')),
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id);

comment on column public.leads.first_call_user_id is 'first_call rolündeki kullanıcının bu lead üzerindeki sahipliği. owner_id ile birlikte var olur, onun yerine geçmez.';
comment on column public.leads.sales_user_id is 'sales rolündeki kullanıcının bu lead üzerindeki sahipliği. owner_id ile birlikte var olur, onun yerine geçmez.';
comment on column public.leads.deleted_at is 'Soft delete: doluysa normal sorgularda (pv_admin hariç) görünmez. Fiziksel silme yok.';

create index leads_first_call_user_id_idx on public.leads(first_call_user_id);
create index leads_sales_user_id_idx on public.leads(sales_user_id);
create index leads_lead_score_idx on public.leads(lead_score);
create index leads_deleted_at_idx on public.leads(deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------
-- RLS: leads_select_pv / leads_insert_pv / leads_update_pv
-- first_call + sales_user_id görünürlüğü eklenir, soft-delete
-- filtresi eklenir (pv_admin hariç). Mevcut owner_id yolu kırılmaz.
-- ---------------------------------------------------------
drop policy leads_select_pv on public.leads;
drop policy leads_insert_pv on public.leads;
drop policy leads_update_pv on public.leads;

create policy leads_select_pv on public.leads
for select
using (
  (select private.current_role()) = 'pv_admin'
  or (
    deleted_at is null
    and (
      ((select private.current_role()) = 'pv_sales' and (owner_id = (select auth.uid()) or sales_user_id = (select auth.uid())))
      or ((select private.current_role()) = 'first_call' and (created_by = (select auth.uid()) or first_call_user_id = (select auth.uid())))
    )
  )
);

create policy leads_insert_pv on public.leads
for insert
with check (
  (select private.current_role()) = 'pv_admin'
  or ((select private.current_role()) = 'pv_sales' and owner_id = (select auth.uid()))
  or ((select private.current_role()) = 'first_call' and created_by = (select auth.uid()))
);

create policy leads_update_pv on public.leads
for update
using (
  (select private.current_role()) = 'pv_admin'
  or (
    deleted_at is null
    and (
      ((select private.current_role()) = 'pv_sales' and (owner_id = (select auth.uid()) or sales_user_id = (select auth.uid())))
      or ((select private.current_role()) = 'first_call' and (created_by = (select auth.uid()) or first_call_user_id = (select auth.uid())))
    )
  )
)
with check (
  (select private.current_role()) = 'pv_admin'
  or (
    deleted_at is null
    and (
      ((select private.current_role()) = 'pv_sales' and (owner_id = (select auth.uid()) or sales_user_id = (select auth.uid())))
      or ((select private.current_role()) = 'first_call' and (created_by = (select auth.uid()) or first_call_user_id = (select auth.uid())))
    )
  )
);

-- ---------------------------------------------------------
-- leads_select_partner: deleted_at is null şartı eklenir
-- (silinmiş lead partnere de görünmemeli)
-- ---------------------------------------------------------
drop policy leads_select_partner on public.leads;

create policy leads_select_partner on public.leads
for select
using (
  deleted_at is null
  and exists (
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
