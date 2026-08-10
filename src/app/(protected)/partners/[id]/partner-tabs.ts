/**
 * Sekme tanımları hem server (page.tsx) hem client (partner-detail-tabs.tsx)
 * tarafından kullanılıyor — bu yüzden "use client" işaretli olmayan ayrı
 * bir dosyada tutuluyor. Bir Server Component, "use client" işaretli bir
 * dosyadan düz bir değeri (array/const) import edip üzerinde işlem
 * yapamaz (yalnızca component/type geçişine izin verilir); PARTNER_TABS
 * bunun için ayrı, direktifsiz bir modülde.
 */
export const PARTNER_TABS = [
  { key: "info", label: "Firma Bilgileri" },
  { key: "employees", label: "Çalışanlar" },
  { key: "referrals", label: "Açık Yönlendirmeler" },
  { key: "offers", label: "Teklifler" },
  { key: "outcomes", label: "Satış Sonuçları" },
  { key: "performance", label: "Performans" },
  { key: "internal-notes", label: "PV İç Notları" },
] as const;

export type PartnerTabKey = (typeof PARTNER_TABS)[number]["key"];
