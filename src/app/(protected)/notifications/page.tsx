import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { getMyNotifications } from "@/lib/data/notifications";
import { getNotificationHref } from "@/lib/notification-links";
import { EmptyState } from "@/components/empty-state";
import { SetHeaderContent } from "@/components/page-header-slot";
import { markNotificationRead, markAllNotificationsRead } from "./actions";
import { MarkReadButton } from "./mark-read-button";

export default async function NotificationsPage() {
  const { appRole } = await getCurrentUserRole();
  const supabase = await createClient();
  const notifications = await getMyNotifications(supabase);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Bildirimler</h1>
      </SetHeaderContent>

      {unreadCount > 0 && (
        <div className="flex justify-end">
          <MarkReadButton
            action={markAllNotificationsRead}
            label="Tümünü okundu işaretle"
            pendingLabel="İşaretleniyor..."
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-foreground hover:bg-background disabled:opacity-50"
          />
        </div>
      )}

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Henüz bildirim yok"
          description="Bir lead atandığında, bir partner yanıt verdiğinde veya bir yanıt geciktiğinde burada görünecek."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => {
            const href = getNotificationHref(n, appRole);
            const body = (
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.message && <p className="mt-1 text-sm text-muted">{n.message}</p>}
                <p className="mt-1 text-xs text-muted">
                  {new Date(n.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>
            );

            return (
              <div
                key={n.id}
                className={
                  n.readAt
                    ? "flex items-start gap-3 rounded-2xl border border-card-border bg-card p-4 shadow-sm"
                    : "flex items-start gap-3 rounded-2xl border border-brand bg-brand-light p-4 shadow-sm"
                }
              >
                {n.priority === "high" && (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                )}
                {href ? (
                  <Link href={href} className="flex-1 hover:underline">
                    {body}
                  </Link>
                ) : (
                  body
                )}
                {!n.readAt && (
                  <MarkReadButton
                    action={markNotificationRead.bind(null, n.id)}
                    label="Okundu işaretle"
                    pendingLabel="İşaretleniyor..."
                    className="whitespace-nowrap rounded-lg border border-card-border px-2 py-1 text-xs text-foreground hover:bg-background disabled:opacity-50"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
