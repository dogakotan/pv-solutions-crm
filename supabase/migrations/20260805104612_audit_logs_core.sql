-- =========================================================
-- Migration 10: audit_logs (yapı)
-- NOT: Bu tabloya yazan trigger/RPC'ler (stage geri alma,
-- MVP istisna kayıtları vb.) sonraki iş-mantığı geçişinde
-- eklenecek. Şimdilik authenticated'e hiç yazma yetkisi
-- verilmiyor; yazma yalnızca ileride SECURITY DEFINER
-- fonksiyonlar üzerinden (postgres bağlamında, RLS bypass)
-- yapılacak.
-- =========================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Şifre, token veya secret asla yazılmamalı. Normal kullanıcı update/delete edemez (yalnız SELECT authenticated''a açık, RLS ile pv_admin''e daraltılmış).';

create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon;
grant select on public.audit_logs to authenticated;

create policy audit_logs_select on public.audit_logs
for select
using (private.current_role() = 'pv_admin');
