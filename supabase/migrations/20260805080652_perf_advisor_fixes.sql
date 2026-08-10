-- Faz 1a düzeltmesi: performance advisor bulguları.
-- 1) user_role_assignments.assigned_by için eksik index.
-- 2) RLS politikalarında auth.uid() her satır için yeniden değerlendiriliyordu;
--    (select auth.uid()) ile initplan olarak bir kez hesaplanacak şekilde
--    değiştirildi. Politika mantığı değişmedi, yalnızca performans.

create index user_role_assignments_assigned_by_idx
  on public.user_role_assignments (assigned_by);

drop policy profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.current_role() = 'pv_admin'
  );

drop policy profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
  on public.profiles for update
  to authenticated
  using (
    id = (select auth.uid())
    or private.current_role() = 'pv_admin'
  )
  with check (
    id = (select auth.uid())
    or private.current_role() = 'pv_admin'
  );

drop policy role_assignments_select_own_or_admin on public.user_role_assignments;
create policy role_assignments_select_own_or_admin
  on public.user_role_assignments for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.current_role() = 'pv_admin'
  );
