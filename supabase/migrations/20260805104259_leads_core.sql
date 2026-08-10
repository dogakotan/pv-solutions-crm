-- =========================================================
-- Faz 4 / Migration 3: leads çekirdeği
-- NOT: lead_no otomatik üretim trigger'ı burada YOK (iş mantığı,
-- sonraki trigger/RPC geçişinde eklenecek). lead_no_sequences
-- yardımcı tablosu yalnızca yapı olarak burada oluşturuluyor.
-- =========================================================

create table public.lead_no_sequences (
  year int primary key,
  last_value int not null default 0
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_no text unique not null,
  customer_type text not null check (customer_type in ('individual','company')),
  customer_name text not null,
  phone text not null,
  alternate_phone text,
  email text,
  city text not null,
  district text,
  address text,
  building_type text,
  roof_area_m2 numeric check (roof_area_m2 is null or roof_area_m2 > 0),
  estimated_capacity_kwp numeric check (estimated_capacity_kwp is null or estimated_capacity_kwp > 0),
  pool_interest text check (pool_interest in ('yes','no','considering')),
  heat_pump_interest text check (heat_pump_interest in ('yes','no','considering')),
  ev_interest text check (ev_interest in ('yes','no','considering')),
  battery_interest text check (battery_interest in ('yes','no','considering')),
  competitor_offer_status text check (competitor_offer_status in ('none','exists','unknown')),
  competitor_offer_note text,
  source text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  stage text not null default 'new' check (stage in (
    'new','contacted','referred','survey_scheduled','survey_completed',
    'proposal_preparing','proposal_sent','negotiation','won','lost','sale_registered'
  )),
  owner_id uuid not null references public.profiles(id),
  next_follow_up_at timestamptz,
  general_notes text,
  internal_notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on table public.leads is 'lead_no şu an manuel/geçici olarak unique text; otomatik üretim (lead_no_sequences + trigger) sonraki iş-mantığı geçişinde eklenecek. internal_notes/general_notes kolon-seviyesi partner maskelemesi partner_referrals migration''ında ele alınacak.';

create trigger leads_set_updated_at
before update on public.leads
for each row execute function private.set_updated_at();

-- Doküman 18.1'de istenen indeksler
create index leads_owner_id_idx on public.leads(owner_id);
create index leads_stage_idx on public.leads(stage);
create index leads_city_idx on public.leads(city);
create index leads_next_follow_up_at_idx on public.leads(next_follow_up_at);
create index leads_created_at_idx on public.leads(created_at);
create index leads_phone_idx on public.leads(phone);

-- ---------------------------------------------------------
-- RLS: leads
-- NOT: partner_admin/partner_employee görünürlüğü burada YOK.
-- partner_referrals tablosu henüz yok; o migration'da bu tabloya
-- ek SELECT policy'si eklenecek (leads_select_partner gibi).
-- ---------------------------------------------------------
alter table public.leads enable row level security;

revoke all on public.leads from anon;
grant select, insert, update on public.leads to authenticated;

create policy leads_select_pv on public.leads
for select
using (
  private.current_role() = 'pv_admin'
  or (private.current_role() = 'pv_sales' and owner_id = auth.uid())
);

create policy leads_insert_pv on public.leads
for insert
with check (
  private.current_role() = 'pv_admin'
  or (private.current_role() = 'pv_sales' and owner_id = auth.uid())
);

create policy leads_update_pv on public.leads
for update
using (
  private.current_role() = 'pv_admin'
  or (private.current_role() = 'pv_sales' and owner_id = auth.uid())
)
with check (
  private.current_role() = 'pv_admin'
  or (private.current_role() = 'pv_sales' and owner_id = auth.uid())
);

-- lead_no_sequences: yalnız sistem/admin erişir, uygulama katmanından
-- doğrudan okunmasına gerek yok (trigger geçişinde RPC üzerinden
-- kullanılacak).
alter table public.lead_no_sequences enable row level security;
revoke all on public.lead_no_sequences from anon;
revoke all on public.lead_no_sequences from authenticated;
