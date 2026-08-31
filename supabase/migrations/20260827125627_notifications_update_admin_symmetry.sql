-- notifications_update, notifications_select ile asimetrikti: pv_admin
-- herkesin bildirimini görebiliyor ama yalnızca kendi bildirimini
-- okundu işaretleyebiliyordu. Bu, kodbazındaki diğer tüm admin-oversight
-- politikalarıyla (offers_update, activities_update, leads_update_pv,
-- sales_outcomes_update) tutarsızdı — hepsinde pv_admin UPDATE'te de
-- aynı OR koluna sahip. Header bildirim kutusu geliştirilirken fark
-- edildi: admin hesabında "tümünü okundu işaretle" başkalarına ait
-- satırlarda sessizce 0 satır etkiliyordu (RLS filtreli WHERE eşleşmiyordu).

drop policy notifications_update on public.notifications;

create policy notifications_update on public.notifications
for update
using (
  recipient_user_id = (select auth.uid())
  or (select private.current_role()) = 'pv_admin'
)
with check (
  recipient_user_id = (select auth.uid())
  or (select private.current_role()) = 'pv_admin'
);
