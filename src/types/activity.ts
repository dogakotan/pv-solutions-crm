export type ActivityType =
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "survey_scheduled"
  | "survey_completed"
  | "note"
  | "task"
  | "proposal_followup";

export type ActivityVisibility = "pv_internal" | "shared_with_partner";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Telefon Görüşmesi",
  whatsapp: "WhatsApp",
  email: "E-posta",
  meeting: "Toplantı",
  survey_scheduled: "Keşif Planlandı",
  survey_completed: "Keşif Tamamlandı",
  note: "Not",
  task: "Görev",
  proposal_followup: "Teklif Takibi",
};
