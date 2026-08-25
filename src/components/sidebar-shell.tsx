"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/logo";

type SidebarContextValue = {
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const noopSubscribe = () => () => {};

/**
 * `collapsed` başlangıçta her zaman false, ama onu okuyan bileşenler
 * (title/className/children farklılaşıyor) ilk client render'ında
 * sunucudakiyle bire bir aynı çıktıyı üretmeli — aksi halde React
 * hydration mismatch'e düşer. useSyncExternalStore'un server/client
 * snapshot ayrımı bunu yapısal olarak garanti eder: sunucuda ve ilk
 * client boyamasında hep false, mount SONRASI true olur (setState'i
 * bir effect içinde çağırmadan — bkz. react-hooks/set-state-in-effect).
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * Sidebar'ın açık/kapalı (mobil drawer) ve daraltılmış/geniş (masaüstü
 * ikon-rayı) durumu burada, layout'un header'ı ile aside'ı arasında
 * paylaşılan tek bir context'te tutulur — ikisi de ayrı server bileşeni
 * ağaçları içinde render edildiği için state'i props ile aşağı taşımak
 * yerine context kullanmak gerekiyor.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const hydrated = useIsHydrated();

  return (
    <SidebarContext.Provider
      value={{
        mobileOpen,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
        collapsed: hydrated ? collapsed : false,
        toggleCollapsed: () => setCollapsed((c) => !c),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar, SidebarProvider içinde kullanılmalı");
  return ctx;
}

export function MobileMenuButton() {
  const { openMobile } = useSidebar();
  return (
    <button
      type="button"
      onClick={openMobile}
      aria-label="Menüyü aç"
      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-background lg:hidden"
    >
      <Menu className="h-5 w-5 text-muted" aria-hidden="true" />
    </button>
  );
}

export function SidebarFrame({ children }: { children: ReactNode }) {
  const { mobileOpen, closeMobile, collapsed, toggleCollapsed } = useSidebar();

  return (
    <>
      {mobileOpen && (
        <div
          onClick={closeMobile}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-card-border bg-card px-4 py-6 transition-transform duration-200 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full") +
          " lg:static lg:translate-x-0 " +
          (collapsed ? "lg:w-16" : "lg:w-64")
        }
      >
        <div className={collapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between px-2"}>
          <Logo iconOnly={collapsed} />

          <button
            type="button"
            onClick={closeMobile}
            aria-label="Menüyü kapat"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background lg:hidden"
          >
            <X className="h-5 w-5 text-muted" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground lg:flex"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        {children}
      </aside>
    </>
  );
}
