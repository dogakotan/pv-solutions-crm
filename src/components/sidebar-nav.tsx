"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { menuItems } from "@/components/menu-items";
import { useSidebar } from "@/components/sidebar-shell";
import type { AppRole } from "@/lib/auth/roles";

/**
 * Yalnızca kullanıcının rolüyle eşleşen menü öğeleri render edilir.
 * Bu SADECE UX içindir — asıl erişim kontrolü requireRole() (server,
 * her layout'ta) ve RLS'te yapılır. Kullanıcı URL'yi elle yazarsa bu
 * filtre onu durdurmaz, requireRole() durdurur.
 */
export function SidebarNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const visibleItems = menuItems.filter((item) => item.roles.includes(role));

  return (
    <nav className="mt-8 flex flex-1 flex-col gap-1">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium";
        const state = isActive
          ? "bg-brand text-white"
          : "text-muted hover:bg-background hover:text-foreground";

        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={`${base} ${state} ${collapsed ? "justify-center" : ""}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}
