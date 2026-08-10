-- =========================================================
-- Faz 7 / Migration 7: offers + offer_versions
-- NOT: offers.accepted_version_id YOK (v1.1 kararı, bk. 14.9).
-- offer_no otomatik üretim trigger'ı sonraki iş-mantığı
-- geçişinde eklenecek; şimdilik unique text.
-- =========================================================

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  offer_no text unique not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  referral_id uuid references public.partner_referrals(id),
  created_by_organization_type text not null check (created_by_organization_type in ('pv','partner')),
  created_by uuid not null references public.profiles(id),
  status text not null default 'open' check (status in ('open','accepted','rejected','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offers is 'accepted_version_id kasıtlı olarak yok. Kabul edilen revizyon tek doğruluk kaynağı sales_outcomes.accepted_offer_version_id olacak (Migration 8).';

create index offers_lead_id_idx on public.offers(lead_id);
create index offers_referral_id_idx on public.offers(referral_id);

create trigger offers_set_updated_at
before update on public.offers
for each row execute function private.set_updated_at();

create table public.offer_versions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  revision_no integer not null check (revision_no >= 0),
  capacity_kwp numeric not null check (capacity_kwp > 0),
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null,
  vat_included boolean not null default false,
  valid_until date,
  scope_summary text,
  status text not null default 'draft' check (status in (
    'draft','sent','superseded','accepted','rejected','expired','withdrawn'
  )),
  sent_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (offer_id, revision_no)
);

comment on table public.offer_versions is 'created_at immutable kabul edilir; gönderilmiş revizyonların ticari alanları değiştirilmez, yeni revizyon açılır.';

create index offer_versions_offer_id_idx on public.offer_versions(offer_id);

-- ---------------------------------------------------------
-- RLS: offers
-- ---------------------------------------------------------
alter table public.offers enable row level security;

revoke all on public.offers from anon;
grant select, insert, update on public.offers to authenticated;

create policy offers_select on public.offers
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

create policy offers_insert on public.offers
for insert
with check (
  private.current_role() = 'pv_admin'
  or (
    private.current_role() = 'pv_sales'
    and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  )
  or (
    private.current_role() in ('partner_admin','partner_employee')
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

create policy offers_update on public.offers
for update
using (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  or (
    referral_id is not null
    and private.current_role() = 'partner_admin'
    and exists (select 1 from public.partner_referrals pr where pr.id = referral_id and pr.partner_id = private.current_partner_id())
  )
)
with check (
  private.current_role() = 'pv_admin'
  or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())
  or (
    referral_id is not null
    and private.current_role() = 'partner_admin'
    and exists (select 1 from public.partner_referrals pr where pr.id = referral_id and pr.partner_id = private.current_partner_id())
  )
);

-- ---------------------------------------------------------
-- RLS: offer_versions (görünürlük parent offers'a bağlı)
-- ---------------------------------------------------------
alter table public.offer_versions enable row level security;

revoke all on public.offer_versions from anon;
grant select, insert, update on public.offer_versions to authenticated;

create policy offer_versions_select on public.offer_versions
for select
using (exists (select 1 from public.offers o where o.id = offer_id));

create policy offer_versions_insert on public.offer_versions
for insert
with check (exists (select 1 from public.offers o where o.id = offer_id));

create policy offer_versions_update on public.offer_versions
for update
using (private.current_role() = 'pv_admin' or created_by = auth.uid())
with check (private.current_role() = 'pv_admin' or created_by = auth.uid());
