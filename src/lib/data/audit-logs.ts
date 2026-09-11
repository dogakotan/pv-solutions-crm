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

/**
 * RLS zaten audit_logs_select politikasıyla yalnızca pv_admin'e açık —
 * burada ayrıca rol kontrolü gerekmez. hasMore'u ayrı bir count sorgusu
 * yapmadan anlamak için limit+1 satır çekilip fazlası kesiliyor.
 */
export async function getAuditLogs(
  supabase: TypedSupabaseClient,
  options: {
    limit?: number;
    offset?: number;
    entityType?: string;
    action?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
  } = {}
): Promise<{ logs: AuditLogItem[]; hasMore: boolean }> {
  const { limit = 50, offset = 0, entityType, action, actorId, dateFrom, dateTo, q } = options;

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_values, new_values, reason, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (entityType) query = query.eq("entity_type", entityType);
  if (action) query = query.eq("action", action);
  if (actorId) query = query.eq("actor_user_id", actorId);
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
  if (q) query = query.ilike("reason", `%${q}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    logs: page.map((row) => ({
      id: row.id,
      actorName: extractActorName(row.profiles as ActorEmbed),
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldValues: row.old_values,
      newValues: row.new_values,
      reason: row.reason,
      createdAt: row.created_at,
    })),
    hasMore,
  };
}

export type AuditLogActor = { id: string; fullName: string };

export async function getAuditLogActors(supabase: TypedSupabaseClient): Promise<AuditLogActor[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("actor_user_id, profiles(full_name)")
    .not("actor_user_id", "is", null);

  if (error) throw error;

  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    const name = extractActorName(row.profiles as ActorEmbed);
    if (row.actor_user_id && name && !seen.has(row.actor_user_id)) {
      seen.set(row.actor_user_id, name);
    }
  }

  return [...seen.entries()]
    .map(([id, fullName]) => ({ id, fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
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

export const AUDIT_ACTIONS = [
  "advance_lead_stage",
  "assign_partner",
  "assign_sales",
  "claim_lead",
  "create_lead",
  "create_lead_from_webhook",
  "create_offer",
  "create_partner",
  "qualify_lead",
  "reactivate_lead",
  "record_sales_outcome",
  "referral_accept",
  "referral_reject",
  "revise_offer",
  "set_active",
  "set_partner_rating",
  "set_partner_status",
  "set_role",
  "soft_delete",
] as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  advance_lead_stage: "Aşama İlerletildi",
  assign_sales: "Satışa Atandı",
  assign_partner: "Partnere Yönlendirildi",
  claim_lead: "Lead Sahiplenildi",
  create_lead: "Lead Oluşturuldu",
  create_lead_from_webhook: "Lead Webhook'tan Oluşturuldu",
  qualify_lead: "Lead Nitelendirildi",
  reactivate_lead: "Lead Yeniden Açıldı",
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
  set_partner_status: "Partner Durumu Değiştirildi",
};
