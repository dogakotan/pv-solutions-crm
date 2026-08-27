import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyNotifications } from "@/lib/data/notifications";
import { EmptyState } from "@/components/empty-state";
import { SetHeaderContent } from "@/components/page-header-slot";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

export default async function NotificationsPage() {
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
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-foreground hover:bg-background"
            >
              Tümünü okundu işaretle
            </button>
          </form>
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
                {n.entityType === "lead" && n.entityId ? (
                  <Link href={`/leads/${n.entityId}`} className="flex-1 hover:underline">
                    {body}
                  </Link>
                ) : (
                  body
                )}
                {!n.readAt && (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="notificationId" value={n.id} />
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-lg border border-card-border px-2 py-1 text-xs text-foreground hover:bg-background"
                    >
                      Okundu işaretle
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
