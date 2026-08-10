-- =========================================================
-- Faz 3 / Migration 2: partners + service regions + capabilities
-- + profiles.partner_id FK'ının tamamlanması
-- =========================================================

-- ---------------------------------------------------------
-- 1) partners
-- ---------------------------------------------------------
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  partner_code text unique,
  name text not null,
  tax_number text unique,
  phone text,
  email text,
  city text,
  address text,
  status text not null default 'candidate'
    check (status in ('candidate','active','suspended','inactive')),
  pv_owner_id uuid references public.profiles(id),
  internal_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partners is 'internal_notes yalnızca PV içindir. Kolon-seviyesi maskeleme henüz uygulanmadı: partner kullanıcıları için RLS satır bazlıdır, sütun gizleme dashboard/RLS iyileştirme geçişinde ele alınacak (bk. doküman 15.3).';

create index partners_status_idx on public.partners(status);
create index partners_pv_owner_id_idx on public.partners(pv_owner_id);

create trigger partners_set_updated_at
before update on public.partners
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------
-- 2) partner_service_regions / partner_capabilities (junction)
-- ---------------------------------------------------------
create table public.partner_service_regions (
  partner_id uuid not null references public.partners(id) on delete cascade,
  region_code text not null,
  primary key (partner_id, region_code)
);

create table public.partner_capabilities (
  partner_id uuid not null references public.partners(id) on delete cascade,
  capability_code text not null,
  primary key (partner_id, capability_code)
);

-- ---------------------------------------------------------
-- 3) profiles.partner_id FK'ını şimdi tamamla
--    (Migration 1'de partners tablosu olmadığı için FK yoktu)
-- ---------------------------------------------------------
alter table public.profiles
  add constraint profiles_partner_id_fkey
  foreign key (partner_id) references public.partners(id);

-- protect_profile_privileged_columns fonksiyonu zaten partner_id'yi
-- koruyor (private şemada, Migration 1'de tanımlandı) — burada
-- tekrar tanımlamaya gerek yok.

-- ---------------------------------------------------------
-- 4) RLS yardımcı fonksiyonu: current_partner_id
-- ---------------------------------------------------------
create or replace function private.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------
-- 5) RLS: partners
-- ---------------------------------------------------------
alter table public.partners enable row level security;

revoke all on public.partners from anon;
grant select, insert, update on public.partners to authenticated;

create policy partners_select on public.partners
for select
using (
  private.current_role() = 'pv_admin'
  or (private.current_role() = 'pv_sales' and status = 'active')
  or (
    private.current_role() in ('partner_admin','partner_employee')
    and id = private.current_partner_id()
  )
);

create policy partners_insert on public.partners
for insert
with check (private.current_role() = 'pv_admin');

create policy partners_update on public.partners
for update
using (private.current_role() = 'pv_admin')
with check (private.current_role() = 'pv_admin');

-- ---------------------------------------------------------
-- 6) RLS: partner_service_regions / partner_capabilities
--    (görünürlük parent partners satırına bağlı)
-- ---------------------------------------------------------
alter table public.partner_service_regions enable row level security;
alter table public.partner_capabilities enable row level security;

revoke all on public.partner_service_regions from anon;
revoke all on public.partner_capabilities from anon;
grant select, insert, update, delete on public.partner_service_regions to authenticated;
grant select, insert, update, delete on public.partner_capabilities to authenticated;

create policy partner_service_regions_select on public.partner_service_regions
for select
using (exists (select 1 from public.partners p where p.id = partner_id));

create policy partner_service_regions_write on public.partner_service_regions
for all
using (private.current_role() = 'pv_admin')
with check (private.current_role() = 'pv_admin');

create policy partner_capabilities_select on public.partner_capabilities
for select
using (exists (select 1 from public.partners p where p.id = partner_id));

create policy partner_capabilities_write on public.partner_capabilities
for all
using (private.current_role() = 'pv_admin')
with check (private.current_role() = 'pv_admin');
