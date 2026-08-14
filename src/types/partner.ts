/**
 * Doküman 14.4 (`partners` tablosu) ile hizalı frontend tipi.
 * `stats` gerçek verilerden hesaplanır: totalLeads/activeLeads
 * partner_referrals'tan, sales/conversionRate sales_outcomes'tan.
 * `rating` (0.0-5.0) `partners.rating` kolonundan gelir — admin
 * tarafından elle girilen bir performans/memnuniyet puanı, anket
 * sisteminden değil.
 */
export type PartnerStatus = "candidate" | "active" | "suspended" | "inactive";

/**
 * "Uygulama alanı" ayrı bir tablo/kolon olarak eklenmedi — mevcut
 * partner_capabilities (capability_code) tablosu yeniden kullanılıyor.
 * Bu sabit listedeki değerler "Uygulama Alanı" olarak, geri kalan
 * capability_code'lar "Yetkinlikler" olarak gösterilir.
 */
export const APPLICATION_AREAS = ["Tarımsal Sulama", "Off Grid", "Hibrit", "Depolamalı"] as const;

export type PartnerStats = {
  totalLeads: number;
  activeLeads: number;
  sales: number;
  conversionRate: number;
};

export type Partner = {
  id: string;
  partnerCode: string;
  name: string;
  taxNumber: string | null;
  taxOffice: string | null;
  phone: string;
  email: string;
  city: string;
  address: string | null;
  status: PartnerStatus;
  rating: number | null;
  serviceRegions: string[];
  capabilities: string[];
  applicationAreas: string[];
  pvOwnerName: string;
  createdAt: string;
  stats: PartnerStats;
};

export type PartnerEmployee = {
  id: string;
  fullName: string;
  role: "partner_admin" | "partner_employee";
  isActive: boolean;
  phone: string;
};
