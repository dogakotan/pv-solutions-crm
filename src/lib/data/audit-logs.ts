import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type AuditLogItem = {
  id: number;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  reason: string | null;
  createdAt: string;
};

type ActorEmbed = { full_name: string } | { full_name: string }[] | null;

function extractActorName(embed: ActorEmbed): string | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.full_name ?? null;
}

/** RLS zaten audit_logs_select politikasıyla yalnızca pv_admin'e açık — burada ayrıca rol kontrolü gerekmez. */
export async function getAuditLogs(
  supabase: TypedSupabaseClient,
  options: { limit?: number; entityType?: string } = {}
): Promise<AuditLogItem[]> {
  const { limit = 100, entityType } = options;

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_values, new_values, reason, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    actorName: extractActorName(row.profiles as ActorEmbed),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValues: row.old_values,
    newValues: row.new_values,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export const AUDIT_ENTITY_TYPES = [
  "leads",
  "offers",
  "offer_versions",
  "partners",
  "partner_referrals",
  "profiles",
  "user_role_assignments",
] as const;

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  leads: "Lead",
  offers: "Teklif",
  offer_versions: "Teklif Revizyonu",
  partners: "Partner",
  partner_referrals: "Yönlendirme",
  profiles: "Kullanıcı",
  user_role_assignments: "Kullanıcı Rolü",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  assign_sales: "Satışa Atandı",
  assign_partner: "Partnere Yönlendirildi",
  soft_delete: "Silindi (Arşivlendi)",
  set_role: "Rol Değiştirildi",
  set_active: "Aktiflik Değiştirildi",
  referral_accept: "Yönlendirme Kabul Edildi",
  referral_reject: "Yönlendirme Reddedildi",
  record_sales_outcome: "Satış Sonucu Kaydedildi",
  create_offer: "Teklif Oluşturuldu",
  revise_offer: "Teklif Revize Edildi",
  create_partner: "Partner Oluşturuldu",
  set_partner_rating: "Partner Puanı Değiştirildi",
};
