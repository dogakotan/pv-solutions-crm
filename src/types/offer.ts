/**
 * public.offers.status / public.offer_versions.status ile hizalı
 * literal tipler (bk. migration 20260805104509_offers_and_versions_core.sql).
 */
export type OfferStatus = "open" | "accepted" | "rejected" | "closed";

export type OfferVersionStatus =
  | "draft"
  | "sent"
  | "superseded"
  | "accepted"
  | "rejected"
  | "expired";
