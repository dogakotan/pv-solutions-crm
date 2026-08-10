-- =========================================================
-- Rol genişletmesi: first_call
-- Mevcut app_role değerleri (pv_admin, pv_sales, partner_admin,
-- partner_employee) korunuyor; yeni bir rol olarak first_call
-- ekleniyor. Enum değeri eklendikten sonra aynı transaction
-- içinde kullanılamaz, bu yüzden ayrı bir migration.
-- =========================================================

alter type public.app_role add value 'first_call';

comment on type public.app_role is
  'pv_admin, pv_sales, partner_admin, partner_employee (mevcut) + first_call (yeni). Uygulama tarafında AppRole = admin|first_call|sales|partner olarak dışa sunulur; pv_admin->admin, pv_sales->sales, partner_admin|partner_employee->partner eşlemesi lib/auth/roles.ts içinde yapılır.';
