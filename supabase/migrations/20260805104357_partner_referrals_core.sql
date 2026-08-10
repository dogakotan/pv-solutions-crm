-- =========================================================
-- Faz 5 / Migration 5: partner_referrals
-- + leads ve lead_stage_history'ye partner görünürlük policy'leri
--   (Migration 3-4'te ertelenmişti, artık partner_referrals var)
-- =========================================================

create table public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  referred_by uuid references public.profiles(id),
  assigned_employee_id uuid references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','cancelled','completed','expired')),
  share_note text,
  sent_at timestamptz not null default now(),
  response_due_at timestamptz not null,
  responded_at timestamptz,
  responded_by uuid references public.profiles(id),
  rejection_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partner_referrals is 'Tek aktif yönlendirme kuralı: partial unique index ile bir lead için closed_at is null olan yalnızca tek kayıt olabilir.';

-- Doküman 14.7: "bir lead için closed_at is null olan tek kayıt"
create unique index partner_referrals_one_active_per_lead_idx
  on public.partner_referrals(lead_id)
  where (closed_at is null);

-- Doküman 18.1 indeksleri
create index partner_referrals_lead_id_idx on public.partner_referrals(lead_id);
create index partner_referrals_partner_id_idx on public.partner_referrals(partner_id);
create index partner_referrals_assigned_employee_id_idx on public.partner_referrals(assigned_employee_id);
create index partner_referrals_status_idx on public.partner_referrals(status);
create index partner_referrals_response_due_at_idx on public.partner_referrals(response_due_at);

create trigger partner_referrals_set_updated_at
before update on public.partner_referrals
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------
-- RLS: partner_referrals
-- ---------------------------------------------------------
alter table public.partner_referrals enable row level security;

revoke all on public.partner_referrals from anon;
grant select, insert, update on public.partner_referrals to authenticated;

create policy partner_referrals_select on public.partner_referrals
for select
using (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  or (private.current_role() = 'partner_admin' and partner_id = private.current_partner_id())
  or (
    private.current_role() = 'partner_employee'
    and partner_id = private.current_partner_id()
    and assigned_employee_id = auth.uid()
  )
);

create policy partner_referrals_insert on public.partner_referrals
for insert
with check (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
);

create policy partner_referrals_update on public.partner_referrals
for update
using (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  or (private.current_role() = 'partner_admin' and partner_id = private.current_partner_id())
)
with check (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  or (private.current_role() = 'partner_admin' and partner_id = private.current_partner_id())
);

-- ---------------------------------------------------------
-- leads: ertelenmiş partner görünürlük policy'si (ek, mevcut
-- pv policy'sini daraltmaz, OR ile genişletir)
-- ---------------------------------------------------------
create policy leads_select_partner on public.leads
for select
using (
  exists (
    select 1 from public.partner_referrals pr
    where pr.lead_id = leads.id
      and (
        (private.current_role() = 'partner_admin' and pr.partner_id = private.current_partner_id())
        or (
          private.current_role() = 'partner_employee'
          and pr.partner_id = private.current_partner_id()
          and pr.assigned_employee_id = auth.uid()
        )
      )
  )
);

-- ---------------------------------------------------------
-- lead_stage_history: ertelenmiş partner görünürlük policy'si
-- NOT: doküman "paylaşılabilir değişimler" diyor — şu an tüm
-- geçmiş satırları ilgili referral için görünür yapıyorum, satır
-- bazlı "partnerle paylaş" ayrımı yok. Bu, partner portalı
-- dashboard geçişinde (gerekirse yeni bir sütun ile) netleştirilmeli.
-- ---------------------------------------------------------
create policy lead_stage_history_select_partner on public.lead_stage_history
for select
using (
  exists (
    select 1 from public.partner_referrals pr
    where pr.lead_id = lead_stage_history.lead_id
      and (
        (private.current_role() = 'partner_admin' and pr.partner_id = private.current_partner_id())
        or (
          private.current_role() = 'partner_employee'
          and pr.partner_id = private.current_partner_id()
          and pr.assigned_employee_id = auth.uid()
        )
      )
  )
);
