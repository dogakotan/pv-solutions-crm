import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { logout } from "./actions";

/**
 * Bu layout ARTIK auth/rol sorgusunu (getCurrentUserRole) bekleyip sonra
 * JSX döndürmüyor — sidebar iskeleti ve logo her navigasyonda anında
 * boyanır, yalnızca role bağlı menü/kullanıcı bilgisi Suspense arkasında
 * stream olur. Önceki halde (async layout, üstte await) tüm sayfa —solda
 * dahil— auth zinciri bitene kadar boş kalıyordu; bu, "sayfa geçişi
 * yavaş" şikayetinin asıl nedeniydi.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-card-border bg-card px-4 py-6">
        <div className="px-2">
          <Logo />
        </div>
        <Suspense fallback={<SidebarNavSkeleton />}>
          <SidebarNavSection />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-card-border bg-card px-6 py-4">
          <Suspense fallback={<NotificationBellSkeleton />}>
            <NotificationBell />
          </Suspense>
          <Suspense fallback={<HeaderUserSkeleton />}>
            <HeaderUser />
          </Suspense>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

async function SidebarNavSection() {
  const { appRole } = await getCurrentUserRole();
  return <SidebarNav role={appRole} />;
}

function SidebarNavSkeleton() {
  return (
    <nav className="mt-8 flex flex-1 flex-col gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-lg bg-background" />
      ))}
    </nav>
  );
}

async function HeaderUser() {
  const { profile } = await getCurrentUserRole();
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="font-medium text-foreground">
        {profile.full_name || profile.email}
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-lg border border-card-border px-3 py-1.5 hover:bg-background"
        >
          Çıkış yap
        </button>
      </form>
    </div>
  );
}

function HeaderUserSkeleton() {
  return <div className="h-8 w-40 animate-pulse rounded-lg bg-background" />;
}

async function NotificationBell() {
  const supabase = await createClient();
  const unreadCount = await getUnreadNotificationCount(supabase);

  return (
    <Link
      href="/notifications"
      aria-label="Bildirimler"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background"
    >
      <Bell className="h-5 w-5 text-muted" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

function NotificationBellSkeleton() {
  return <div className="h-9 w-9 animate-pulse rounded-lg bg-background" />;
}
