/**
 * public.sales_outcomes ile hizalı literal tip (bk. migration
 * 20260805104532_sales_outcomes_core.sql). partner_performance_impact
 * hâlâ bilinçli olarak UI'a bağlanmadı — yol haritası 3.6 (partner puanının
 * hesaplanan performanstan kopuk olması) bu alana dokunmayan, salt-görüntüleme
 * bir "hesaplanan puan" çözümüyle (bk. src/lib/partner-rating.ts) ayrıca
 * kapatıldı; ikisi birleştirilmedi. material_purchase_status/erp_order_number
 * ise update_sales_outcome_fulfillment RPC'siyle (yol haritası 3.3) bağlandı.
 */
export type SalesOutcomeType = "won" | "lost";

export type MaterialPurchaseStatus = "pending" | "ordered" | "delivered";

export const MATERIAL_PURCHASE_STATUS_LABELS: Record<MaterialPurchaseStatus, string> = {
  pending: "Beklemede",
  ordered: "Sipariş Verildi",
  delivered: "Teslim Edildi",
};
