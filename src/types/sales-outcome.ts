/**
 * public.sales_outcomes ile hizalı literal tip (bk. migration
 * 20260805104532_sales_outcomes_core.sql). partner_performance_impact,
 * material_purchase_status, erp_order_number bilinçli olarak UI'a
 * bağlanmadı — Faz 8'in ilk sürümü kazanç/kayıp kaydına odaklanıyor.
 */
export type SalesOutcomeType = "won" | "lost";
