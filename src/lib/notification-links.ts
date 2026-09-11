import type { AppRole } from "@/lib/auth/roles";
import type { NotificationItem } from "@/lib/data/notifications";

/**
 * Hem server (notifications/page.tsx) hem client (notification-bell-popover.tsx)
 * tarafında kullanılıyor — server-only bağımlılığı olmamalı.
 *
 * entity_type='offer' için hedef her rolde aynı: /offers/[id] hiçbir
 * requireRole taşımıyor, görünürlüğü tamamen RLS belirliyor. entity_type=
 * 'referral' için ise hedef role göre değişiyor — partner tarafının kendi
 * referral'a özel bir detay sayfası yok (listeye yönlendiriliyor), pv
 * tarafı ise referral'ın bağlı olduğu lead'e gidiyor (referralLeadId,
 * bkz. getMyNotifications).
 */
export function getNotificationHref(notification: NotificationItem, appRole: AppRole): string | null {
  if (notification.entityType === "lead" && notification.entityId) {
    return `/leads/${notification.entityId}`;
  }

  if (notification.entityType === "offer" && notification.entityId) {
    return `/offers/${notification.entityId}`;
  }

  if (notification.entityType === "referral") {
    if (appRole === "partner") {
      return "/partner/assigned-leads";
    }
    if (notification.referralLeadId) {
      return `/leads/${notification.referralLeadId}`;
    }
  }

  return null;
}
