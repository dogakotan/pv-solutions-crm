-- =========================================================
-- Faz 8 / Migration 8: sales_outcomes
-- NOT: offers.status'ü otomatik 'accepted'/'closed' yapan
-- senkron trigger burada YOK, sonraki iş-mantığı geçişinde eklenecek.
-- =========================================================

create table public.sales_outcomes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  referral_id uuid references public.partner_referrals(id),
  outcome text not null check (outcome in ('won','lost')),
  accepted_offer_version_id uuid references public.offer_versions(id),
  final_amount numeric(14,2),
  currency char(3),
  lost_reason text,
  lost_reason_detail text,
  partner_performance_impact boolean,
  performance_impact_reason text,
  result_date date not null,
  material_purchase_status text,
  erp_order_number text,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (outcome = 'lost' and lost_reason is not null)
    or (
      outcome = 'won'
      and final_amount is not null and final_amount >= 0
      and currency is not null
      and accepted_offer_version_id is not null
    )
  )
);

comment on table public.sales_outcomes is 'accepted_offer_version_id kabul edilen revizyonun TEK doğruluk kaynağıdır (bk. offers 14.9). offers.status senkron trigger''ı sonraki iş-mantığı geçişinde eklenecek.';

create index sales_outcomes_referral_id_idx on public.sales_outcomes(referral_id);

create trigger sales_outcomes_set_updated_at
before update on public.sales_outcomes
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------
-- RLS: sales_outcomes
-- Yazma yalnızca PV tarafında (satış sonucu kapatma PV kararıdır);
-- partner rolleri yalnızca kendi/ atandığı sonucu okur.
-- ---------------------------------------------------------
alter table public.sales_outcomes enable row level security;

revoke all on public.sales_outcomes from anon;
grant select, insert, update on public.sales_outcomes to authenticated;

create policy sales_outcomes_select on public.sales_outcomes
for select
using (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  or (
    referral_id is not null
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = referral_id
        and (
          (private.current_role() = 'partner_admin' and pr.partner_id = private.current_partner_id())
          or (
            private.current_role() = 'partner_employee'
            and pr.partner_id = private.current_partner_id()
            and pr.assigned_employee_id = auth.uid()
          )
        )
    )
  )
);

create policy sales_outcomes_insert on public.sales_outcomes
for insert
with check (
  private.current_role() = 'pv_admin'
  or (
    private.current_role() = 'pv_sales'
    and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  )
);

create policy sales_outcomes_update on public.sales_outcomes
for update
using (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
)
with check (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
);
