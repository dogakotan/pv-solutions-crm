-- =========================================================
-- Advisor düzeltmesi:
-- 1) protect_lead_privileged_columns: search_path sabitlenmemişti.
-- 2) Yeni 5 RPC: "revoke ... from public" PUBLIC pseudo-role'ünü
--    temizler ama Supabase'in public şema için varsayılan
--    ALTER DEFAULT PRIVILEGES ... GRANT TO anon, authenticated
--    ayarı anon'a AYRI bir grant veriyor — bu yüzden anon'dan
--    ayrıca ve açıkça revoke etmek gerekiyor (tablolardaki
--    "revoke all ... from anon" deseniyle tutarlı).
-- =========================================================

create or replace function private.protect_lead_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.current_role() = 'pv_admin' then
    return new;
  end if;

  if coalesce(current_setting('app.bypass_lead_protection', true), '') = 'on' then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.first_call_user_id is distinct from old.first_call_user_id
     or new.sales_user_id is distinct from old.sales_user_id
     or new.created_by is distinct from old.created_by
     or new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by
  then
    raise exception 'Bu alanlar yalnızca yetkili sunucu işlemleri (assign/soft-delete RPC) veya pv_admin tarafından değiştirilebilir';
  end if;

  return new;
end;
$$;

revoke execute on function public.assign_lead_to_sales(uuid, uuid) from anon;
revoke execute on function public.assign_lead_to_partner(uuid, uuid, uuid, timestamptz, text) from anon;
revoke execute on function public.soft_delete_lead(uuid, text) from anon;
revoke execute on function public.set_user_role(uuid, public.app_role) from anon;
revoke execute on function public.set_user_active(uuid, boolean) from anon;
