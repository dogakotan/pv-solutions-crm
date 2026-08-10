-- =========================================================
-- Faz 9 / Migration 9: notifications (yapı)
-- NOT: pg_cron gecikme bildirimi job'ı (doküman 12.4) burada YOK,
-- sonraki iş-mantığı geçişinde eklenecek. Bildirim satırları bu
-- aşamada yalnızca ileride eklenecek SECURITY DEFINER
-- fonksiyonlar/trigger'lar tarafından oluşturulacağı için
-- authenticated'e INSERT yetkisi verilmiyor.
-- =========================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id),
  type text not null,
  title text not null,
  message text,
  entity_type text check (entity_type in ('lead','referral','offer','activity','user')),
  entity_id uuid,
  priority text not null default 'normal' check (priority in ('normal','high')),
  dedup_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_user_id_idx on public.notifications(recipient_user_id);
create index notifications_read_at_idx on public.notifications(read_at);

-- Yalnızca read_at değişebilir; diğer alanlar oluşturulduktan
-- sonra değiştirilemez (immutability guard).
create or replace function private.protect_notification_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.recipient_user_id is distinct from old.recipient_user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.entity_type is distinct from old.entity_type
    or new.entity_id is distinct from old.entity_id
    or new.priority is distinct from old.priority
    or new.dedup_key is distinct from old.dedup_key
  then
    raise exception 'notifications: yalnızca read_at güncellenebilir';
  end if;
  return new;
end;
$$;

create trigger notifications_protect_immutable_fields
before update on public.notifications
for each row execute function private.protect_notification_immutable_fields();

-- ---------------------------------------------------------
-- RLS: notifications
-- ---------------------------------------------------------
alter table public.notifications enable row level security;

revoke all on public.notifications from anon;
grant select, update on public.notifications to authenticated;

create policy notifications_select on public.notifications
for select
using (
  recipient_user_id = auth.uid()
  or private.current_role() = 'pv_admin'
);

create policy notifications_update on public.notifications
for update
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());
