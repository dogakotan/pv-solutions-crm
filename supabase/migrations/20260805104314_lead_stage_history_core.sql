-- =========================================================
-- Faz 4 / Migration 4: lead_stage_history (yapı)
-- NOT: no-op korumalı otomatik trigger burada YOK, sonraki
-- iş-mantığı geçişinde eklenecek.
-- =========================================================

create table public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  change_source text not null check (change_source in ('manual','referral','survey','offer','outcome','system')),
  reason text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create index lead_stage_history_lead_id_idx on public.lead_stage_history(lead_id);

-- ---------------------------------------------------------
-- RLS: lead_stage_history
-- NOT: partner görünürlüğü partner_referrals migration'ında eklenecek.
-- ---------------------------------------------------------
alter table public.lead_stage_history enable row level security;

revoke all on public.lead_stage_history from anon;
grant select, insert on public.lead_stage_history to authenticated;

create policy lead_stage_history_select on public.lead_stage_history
for select
using (
  private.current_role() = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = lead_id and l.owner_id = auth.uid()
  )
);

create policy lead_stage_history_insert on public.lead_stage_history
for insert
with check (
  private.current_role() = 'pv_admin'
  or exists (
    select 1 from public.leads l
    where l.id = lead_id and l.owner_id = auth.uid()
  )
);
