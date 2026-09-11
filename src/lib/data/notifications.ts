import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  priority: "normal" | "high";
  readAt: string | null;
  createdAt: string;
  referralLeadId: string | null;
};

function mapNotification(row: {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  priority: string;
  read_at: string | null;
  created_at: string;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    priority: row.priority as "normal" | "high",
    readAt: row.read_at,
    createdAt: row.created_at,
    referralLeadId: null,
  };
}

/**
 * entity_type='referral' bildirimlerinde entity_id partner_referrals.id'yi
 * tutuyor, leads.id'yi değil — notifications.entity_id polimorfik bir kolon
 * olduğu için PostgREST bunu otomatik embed edemiyor. pv tarafı (admin/sales)
 * için "hangi lead'e gidileceğini" bulmak amacıyla tek bir toplu sorguyla
 * referral_id -> lead_id eşlemesi çekiliyor.
 */
export async function getMyNotifications(
  supabase: TypedSupabaseClient,
  options: { limit?: number; offset?: number; type?: string; unreadOnly?: boolean } = {}
): Promise<{ notifications: NotificationItem[]; hasMore: boolean }> {
  const { limit = 50, offset = 0, type, unreadOnly } = options;

  let query = supabase
    .from("notifications")
    .select("id, type, title, message, entity_type, entity_id, priority, read_at, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (type) query = query.eq("type", type);
  if (unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const notifications = (hasMore ? rows.slice(0, limit) : rows).map(mapNotification);

  const referralIds = notifications
    .filter((n) => n.entityType === "referral" && n.entityId)
    .map((n) => n.entityId as string);

  if (referralIds.length > 0) {
    const { data: referrals, error: referralError } = await supabase
      .from("partner_referrals")
      .select("id, lead_id")
      .in("id", referralIds);

    if (referralError) throw referralError;

    const leadIdByReferralId = new Map((referrals ?? []).map((r) => [r.id, r.lead_id]));
    for (const n of notifications) {
      if (n.entityType === "referral" && n.entityId) {
        n.referralLeadId = leadIdByReferralId.get(n.entityId) ?? null;
      }
    }
  }

  return { notifications, hasMore };
}

export const NOTIFICATION_TYPES = [
  "lead_assigned",
  "referral_received",
  "referral_overdue",
  "referral_accepted",
  "referral_rejected",
  "offer_created",
  "offer_revised",
  "offer_expired",
  "sale_won",
  "sale_lost",
] as const;

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  lead_assigned: "Lead Atandı",
  referral_received: "Yeni Yönlendirme",
  referral_overdue: "Yönlendirme Yanıtı Gecikti",
  referral_accepted: "Yönlendirme Kabul Edildi",
  referral_rejected: "Yönlendirme Reddedildi",
  offer_created: "Yeni Teklif",
  offer_revised: "Teklif Revize Edildi",
  offer_expired: "Teklifin Süresi Doldu",
  sale_won: "Satış Kazanıldı",
  sale_lost: "Satış Kaybedildi",
};

export async function getUnreadNotificationCount(supabase: TypedSupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}
