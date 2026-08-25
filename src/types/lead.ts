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

/**
 * "İlerlet" butonunun izin verdiği TEK sıradaki geçiş — DB hiçbir
 * aşama geçişini doğrulamıyor (bkz. leads_core.sql, yalnızca enum
 * whitelist'i var), bu yüzden geçerli sıralamayı UI burada garanti
 * eder. new/contacted first_call'ın qualify_lead RPC'siyle, referred
 * partnere atamayla, won/lost satış sonucu formuyla zaten ilerliyor —
 * burada yalnızca aradan geçilecek başka bir yolu olmayan aşamalar var.
 */
export const NEXT_STAGE: Partial<Record<LeadStage, LeadStage>> = {
  contacted: "survey_scheduled",
  referred: "survey_scheduled",
  survey_scheduled: "survey_completed",
  survey_completed: "proposal_preparing",
  proposal_preparing: "proposal_sent",
  proposal_sent: "negotiation",
};

export type LeadScore = "hot" | "warm" | "mid" | "cold";

export type PartnerReferralStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed"
  | "expired";
