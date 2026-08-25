"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HEADER_SLOT_ID = "protected-header-page-slot";

/**
 * Ortak header, layout'ta page'in ebeveyni değil KARDEŞİ olarak render
 * edilir (App Router'da layout ile page ayrı ağaçlardır) — bir page'in
 * kendi (server'da render edilmiş) başlık/rozet içeriğini header'a
 * "göndermesinin" başka yolu yok. Bu boş div, portal'ın hedef aldığı
 * sabit DOM düğümü.
 */
export function HeaderPageSlot() {
  return <div id={HEADER_SLOT_ID} className="min-w-0 flex-1" />;
}

const noopSubscribe = () => () => {};

/**
 * Slot div'i sunucuda yok (document erişimi yok), hydration sonrası DOM'da
 * var — useSyncExternalStore'un server/client snapshot ayrımı bunu
 * setState'i bir effect içinde çağırmadan doğru şekilde ele alıyor (bkz.
 * react-hooks/set-state-in-effect).
 */
function useHeaderSlotContainer(): HTMLElement | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(HEADER_SLOT_ID),
    () => null
  );
}

/**
 * Bir page, header'da göstermek istediği içeriği buraya children olarak
 * verir. Portal hedefi mount SONRASI DOM'dan bulunduğu için ilk boyamada
 * (SSR ve hydration'dan hemen önce) içerik henüz görünmez — JS'siz de
 * zaten çalışmayan bu iç CRM'de kabul edilebilir bir tradeoff.
 */
export function SetHeaderContent({ children }: { children: ReactNode }) {
  const container = useHeaderSlotContainer();

  if (!container) return null;
  return createPortal(children, container);
}
