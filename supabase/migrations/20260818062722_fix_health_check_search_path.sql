-- Supabase güvenlik advisor'ının "function search_path mutable" uyarısı.
-- health_check() zaten sadece `select true` döndürüyor, gerçek bir risk
-- yaratmıyor ama advisor'ın standart kalıbına uyum için search_path sabitlendi.
create or replace function public.health_check()
returns boolean
language sql
stable
set search_path = public
as $$ select true $$;
