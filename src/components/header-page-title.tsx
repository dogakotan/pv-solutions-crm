"use client";

import { usePathname } from "next/navigation";

/**
 * Ortak header her sayfada aynı bileşen — büyük bir yeniden tasarım
 * olmadan tek bir sayfanın başlığını göstermek için pathname'e göre
 * eşleşen sabit bir tablo. Yeni bir sayfa header'da başlık istediğinde
 * buraya eklenir.
 */
const PAGE_TITLES: Record<string, string> = {
  "/sales/my-leads": "Leadlerim",
};

export function HeaderPageTitle() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname];

  if (!title) return null;

  return <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>;
}
