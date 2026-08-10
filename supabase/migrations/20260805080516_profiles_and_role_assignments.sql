-- Faz 1a: profiles + user_role_assignments
--
-- Kapsam: kullanıcı profili, rol ataması, auth.users -> profiles otomatik
-- senkronizasyonu, ayrıcalıklı kolonların (partner_id, is_active, role)
-- kullanıcı tarafından değiştirilememesi, RLS + GRANT.
--
-- partners tablosu henüz yok (Faz 3). Bu yüzden profiles.partner_id burada
-- FK'siz uuid olarak tanımlanıyor; Faz 3'te ayrı bir migration ile
-- `alter table public.profiles add constraint profiles_partner_id_fkey ...`
-- eklenecek.

-- ---------------------------------------------------------------------
-- Şema: RLS yardımcı fonksiyonları için, Data API'ye açık olmayan şema.
-- ---------------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Enum: uygulama rolleri
-- ---------------------------------------------------------------------
create type public.app_role as enum (
  'pv_admin',
  'pv_sales',
  'partner_admin',
  'partner_employee'
);

-- ---------------------------------------------------------------------
-- Tablo: profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  partner_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.partner_id is
  'Faz 3''e kadar FK yok: public.partners tablosu henüz oluşturulmadı.';

create index profiles_partner_id_idx on public.profiles (partner_id);

-- ---------------------------------------------------------------------
-- Tablo: user_role_assignments
-- ---------------------------------------------------------------------
create table public.user_role_assignments (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at otomatik güncelleme
-- ---------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- auth.users -> profiles senkronizasyonu
-- (yeni kullanıcı davet edildiğinde profil satırı otomatik açılır;
-- e-posta değişirse profiles.email senkron kalır)
-- ---------------------------------------------------------------------
create or replace function private.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, full_name, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''),
      new.email
    );
  elsif tg_op = 'UPDATE' then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function private.sync_profile_from_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.sync_profile_from_auth_user();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function private.sync_profile_from_auth_user();

-- ---------------------------------------------------------------------
-- Geçerli kullanıcının rolünü döndüren yardımcı fonksiyon.
-- RLS politikaları user_role_assignments'a doğrudan subquery ile
-- bakarsa politika kendi kendine referans verip karmaşıklaşır; bu yüzden
-- security definer bir fonksiyon üzerinden okunuyor (rol tablosunun kendi
-- RLS'sini politika değerlendirmesi sırasında by-pass eder).
-- ---------------------------------------------------------------------
create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_role_assignments
  where user_id = auth.uid();
$$;

revoke execute on function private.current_role() from public;
grant execute on function private.current_role() to authenticated;

-- ---------------------------------------------------------------------
-- Ayrıcalıklı kolonların kullanıcı tarafından değiştirilememesi:
-- partner_id ve is_active yalnızca pv_admin tarafından değiştirilebilir.
-- ---------------------------------------------------------------------
create or replace function private.protect_profile_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if private.current_role() = 'pv_admin' then
    return new;
  end if;

  if new.partner_id is distinct from old.partner_id then
    raise exception 'partner_id alanı yalnızca PV yönetici tarafından değiştirilebilir';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'is_active alanı yalnızca PV yönetici tarafından değiştirilebilir';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_profile_privileged_columns() from public;

create trigger protect_profiles_privileged_columns
  before update on public.profiles
  for each row
  execute function private.protect_profile_privileged_columns();

-- ---------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or private.current_role() = 'pv_admin'
  );

create policy profiles_update_own_or_admin
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or private.current_role() = 'pv_admin'
  )
  with check (
    id = auth.uid()
    or private.current_role() = 'pv_admin'
  );

-- insert/delete politikası yok: satırlar yalnızca auth.users trigger'ı
-- ile (definer hakkıyla) açılır; normal kullanıcı insert/delete edemez.

-- ---------------------------------------------------------------------
-- RLS: user_role_assignments
-- ---------------------------------------------------------------------
alter table public.user_role_assignments enable row level security;

create policy role_assignments_select_own_or_admin
  on public.user_role_assignments for select
  to authenticated
  using (
    user_id = auth.uid()
    or private.current_role() = 'pv_admin'
  );

create policy role_assignments_admin_insert
  on public.user_role_assignments for insert
  to authenticated
  with check (private.current_role() = 'pv_admin');

create policy role_assignments_admin_update
  on public.user_role_assignments for update
  to authenticated
  using (private.current_role() = 'pv_admin')
  with check (private.current_role() = 'pv_admin');

-- delete politikası yok: rol değişikliği update ile yapılır (unique user_id).

-- ---------------------------------------------------------------------
-- GRANT: anon hiçbir CRM tablosuna erişemez; authenticated en az yetkiyle.
-- Postgres'te varsayılan davranış zaten deny-all'dır; aşağıdaki revoke
-- satırları niyeti açık ve denetlenebilir kılmak için eklenmiştir.
-- ---------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke all on public.user_role_assignments from anon;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_role_assignments to authenticated;
