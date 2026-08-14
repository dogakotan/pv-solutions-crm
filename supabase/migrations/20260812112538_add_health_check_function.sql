-- /health sayfası önceden supabase.auth.getSession() çağırıyordu — bu
-- yalnızca cookie'deki JWT'yi yerel olarak decode eder, ağa hiç çıkmaz;
-- Postgres/PostgREST'in gerçekten erişilebilir olduğunu göstermez.
-- Gerçek bir tabloya (örn. leads) anon ile sorgu atmak da grant/RLS
-- nedeniyle "permission denied" ile yanlış-pozitif hata verir. Bu
-- fonksiyon hiçbir kullanıcı verisine dokunmadan sadece PostgREST'in
-- Postgres'e ulaşıp bir sorguyu çalıştırabildiğini doğrular.
create or replace function public.health_check()
returns boolean
language sql
stable
as $$ select true $$;

grant execute on function public.health_check() to anon, authenticated;
