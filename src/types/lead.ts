/**
 * public.leads.stage / public.leads.lead_score ile hizalı literal tipler.
 * Bu tablo Faz 4 çekirdeğinde (mevcut isimlerle) oluşturuldu; rol bazlı
 * erişim geçişinde yeniden adlandırılmadı (bk. migration
 * 20260805104259_leads_core.sql).
 */
export type LeadStage =
  | "new"
  | "contacted"
  | "referred"
  | "survey_scheduled"
  | "survey_completed"
  | "proposal_preparing"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost"
  | "sale_registered";

export type LeadScore = "hot" | "warm" | "mid" | "cold";

export type PartnerReferralStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed"
  | "expired";
