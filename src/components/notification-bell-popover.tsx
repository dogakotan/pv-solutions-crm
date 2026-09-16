"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle } from "lucide-react";
import type { NotificationItem } from "@/lib/data/notifications";
import type { AppRole } from "@/lib/auth/roles";
import { getNotificationHref } from "@/lib/notification-links";
import { markNotificationRead, markAllNotificationsRead } from "@/app/(protected)/notifications/actions";

type Summary = { unreadCount: number; notifications: NotificationItem[]; appRole: AppRole | null };

/**
 * Server component'ten prop ile beslenmiyor — bu sayfanın bulunduğu paylaşılan
 * layout Cache Components altında oturum başına client'ta önbelleklenen bir
 * App Shell'in parçası; mark-as-read sonrası router.refresh() bu önbelleği
 * güvenilir şekilde bozamıyordu (bkz. /api/notifications/summary route.ts'teki
 * not). Bunun yerine kendi verisini doğrudan fetch(no-store) ile çekiyor.
 */
export function NotificationBellPopover() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary>({ unreadCount: 0, notifications: [], appRole: null });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markAllPending, setMarkAllPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications/summary", { cache: "no-store" });
    if (!res.ok) return;
    setSummary(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/summary", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) setSummary(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleMarkRead(id: string) {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      try {
        const result = await markNotificationRead(id);
        if (result.error) {
          setError(result.error);
        } else {
          await load();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "İşlem başarısız oldu.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleMarkAllRead() {
    setMarkAllPending(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await markAllNotificationsRead();
        if (result.error) {
          setError(result.error);
        } else {
          await load();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "İşlem başarısız oldu.");
      } finally {
        setMarkAllPending(false);
      }
    });
  }

  const { unreadCount, notifications, appRole } = summary;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Bildirimler"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background"
      >
        <Bell className="h-5 w-5 text-muted" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-card-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
            <span className="text-sm font-medium text-foreground">Bildirimler</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markAllPending}
                className="text-xs text-brand hover:underline disabled:opacity-50"
              >
                {markAllPending ? "İşaretleniyor..." : "Tümünü okundu işaretle"}
              </button>
            )}
          </div>

          {error && <p className="border-b border-card-border px-4 py-2 text-xs text-red-600">{error}</p>}

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Henüz bildirim yok</p>
            ) : (
              notifications.map((n) => {
                const href = appRole ? getNotificationHref(n, appRole) : null;
                const body = (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                    {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.message}</p>}
                    <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString("tr-TR")}</p>
                  </div>
                );

                return (
                  <div
                    key={n.id}
                    className={
                      "flex items-start gap-2 border-b border-card-border px-4 py-3 last:border-0 " +
                      (n.readAt ? "" : "bg-brand-light")
                    }
                  >
                    {n.priority === "high" && (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
                    )}
                    {href ? (
                      <Link href={href} onClick={() => setOpen(false)} className="min-w-0 flex-1 hover:underline">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        disabled={pendingId === n.id}
                        className="shrink-0 whitespace-nowrap rounded-lg border border-card-border px-2 py-1 text-[11px] text-foreground hover:bg-background disabled:opacity-50"
                      >
                        {pendingId === n.id ? "..." : "Okundu"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-card-border px-4 py-2.5 text-center text-sm text-brand hover:bg-background"
          >
            Tümünü gör
          </Link>
        </div>
      )}
    </div>
  );
}
