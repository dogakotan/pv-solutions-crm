-- =========================================================
-- Güvenlik açığı düzeltmesi: private.current_role() şu ana kadar
-- yalnızca user_role_assignments'a bakıyordu, profiles.is_active'i
-- HİÇ kontrol etmiyordu. Bu, pasif bir kullanıcının (uygulama
-- katmanında /account-disabled'a yönlendirilse bile) geçerli bir
-- Supabase Auth session'ıyla doğrudan REST API'ye istek atması
-- durumunda RLS'in onu normal aktif kullanıcı gibi rolüyle içeri
-- alması anlamına geliyordu — spec'in "pasif kullanıcı hiçbir CRM
-- verisine ulaşamamalı" gereksinimini DB katmanında karşılamıyordu.
--
-- Düzeltme: current_role() artık is_active = false olan kullanıcılar
-- için NULL döner; bu da current_role() = 'pv_admin' / 'pv_sales' vb.
-- karşılaştıran TÜM RLS politikalarını otomatik olarak false yapar.
-- =========================================================

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select ura.role
  from public.user_role_assignments ura
  join public.profiles p on p.id = ura.user_id
  where ura.user_id = auth.uid()
    and p.is_active = true;
$$;
