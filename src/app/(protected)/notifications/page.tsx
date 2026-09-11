import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import type { AppRole } from "@/lib/auth/roles";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
} from "@/lib/data/notifications";
import { getNotificationHref } from "@/lib/notification-links";
import { EmptyState } from "@/components/empty-state";
import { SetHeaderContent } from "@/components/page-header-slot";
import { markNotificationRead, markAllNotificationsRead } from "./actions";
import { MarkReadButton } from "./mark-read-button";

const PAGE_SIZE = 50;

type NotificationsSearchParams = { type?: string; unreadOnly?: string; offset?: string };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<NotificationsSearchParams>;
}) {
  const { appRole } = await getCurrentUserRole();
  const supabase = await createClient();
  const [params, unreadCount] = await Promise.all([searchParams, getUnreadNotificationCount(supabase)]);
  const { type, unreadOnly } = params;
  const hasFilters = Boolean(type || unreadOnly);

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Bildirimler</h1>
      </SetHeaderContent>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="notification-type" className="text-xs font-medium text-muted">Tür</label>
            <select
              id="notification-type"
              name="type"
              defaultValue={type ?? ""}
              className="rounded-lg border border-card-border px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {NOTIFICATION_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
            <input type="checkbox" name="unreadOnly" value="1" defaultChecked={unreadOnly === "1"} />
            Sadece okunmamışlar
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Filtrele
          </button>
          {hasFilters && (
            <a href="/notifications" className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background">
              Temizle
            </a>
          )}
        </form>

        {unreadCount > 0 && (
          <MarkReadButton
            action={markAllNotificationsRead}
            label="Tümünü okundu işaretle"
            pendingLabel="İşaretleniyor..."
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-foreground hover:bg-background disabled:opacity-50"
          />
        )}
      </div>

      <NotificationsList appRole={appRole} type={type} unreadOnly={unreadOnly} offset={params.offset} />
    </div>
  );
}

async function NotificationsList({
  appRole,
  type,
  unreadOnly,
  offset,
}: {
  appRole: AppRole;
  type?: string;
  unreadOnly?: string;
  offset?: string;
}) {
  const supabase = await createClient();
  const currentOffset = Number(offset ?? 0) || 0;
  const { notifications, hasMore } = await getMyNotifications(supabase, {
    limit: PAGE_SIZE,
    offset: currentOffset,
    type,
    unreadOnly: unreadOnly === "1",
  });

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Henüz bildirim yok"
        description="Bir lead atandığında, bir partner yanıt verdiğinde veya bir yanıt geciktiğinde burada görünecek."
      />
    );
  }

  function buildParams(nextOffset: number) {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (unreadOnly === "1") p.set("unreadOnly", "1");
    if (nextOffset > 0) p.set("offset", String(nextOffset));
    return p.toString();
  }

  const prevOffset = Math.max(0, currentOffset - PAGE_SIZE);
  const nextParams = buildParams(currentOffset + PAGE_SIZE);
  const prevParams = buildParams(prevOffset);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" data-testid="notifications-list">
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

      {(currentOffset > 0 || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          {currentOffset > 0 && (
            <a
              href={`/notifications?${prevParams}`}
              className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background"
            >
              ← Önceki Sayfa
            </a>
          )}
          {hasMore && (
            <a
              href={`/notifications?${nextParams}`}
              className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background"
            >
              Sonraki Sayfa →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
