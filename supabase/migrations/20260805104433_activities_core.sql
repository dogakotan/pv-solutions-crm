-- =========================================================
-- Faz 6 / Migration 6: activities
-- =========================================================

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  referral_id uuid references public.partner_referrals(id),
  activity_type text not null check (activity_type in (
    'call','whatsapp','email','meeting','survey_scheduled',
    'survey_completed','note','task','proposal_followup'
  )),
  visibility text not null check (visibility in ('pv_internal','shared_with_partner')),
  title text not null,
  description text,
  scheduled_at timestamptz,
  occurred_at timestamptz,
  completed_at timestamptz,
  next_action text,
  next_follow_up_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.activities is 'Partnerin eklediği aktivite mutlaka kendi partnerine ait referral_id ile bağlantılı olmalı ve visibility=shared_with_partner olmalıdır; bu kural RLS INSERT policy''sinde uygulanır.';

create index activities_lead_id_idx on public.activities(lead_id);
create index activities_referral_id_idx on public.activities(referral_id);
create index activities_created_at_idx on public.activities(created_at);

create trigger activities_set_updated_at
before update on public.activities
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------
-- RLS: activities
-- ---------------------------------------------------------
alter table public.activities enable row level security;

revoke all on public.activities from anon;
grant select, insert, update on public.activities to authenticated;

create policy activities_select on public.activities
for select
using (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  or (
    visibility = 'shared_with_partner'
    and referral_id is not null
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

create policy activities_insert on public.activities
for insert
with check (
  private.current_role() = 'pv_admin'
  or (
    private.current_role() = 'pv_sales'
    and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  )
  or (
    private.current_role() in ('partner_admin','partner_employee')
    and visibility = 'shared_with_partner'
    and referral_id is not null
    and exists (
      select 1 from public.partner_referrals pr
      where pr.id = referral_id
        and pr.partner_id = private.current_partner_id()
        and (
          private.current_role() = 'partner_admin'
          or pr.assigned_employee_id = auth.uid()
        )
    )
  )
);

create policy activities_update on public.activities
for update
using (private.current_role() = 'pv_admin' or created_by = auth.uid())
with check (private.current_role() = 'pv_admin' or created_by = auth.uid());
