import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type NotificationItem = {
  id: string;
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
  limit = 50
): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, entity_type, entity_id, priority, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const notifications = (data ?? []).map(mapNotification);

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

  return notifications;
}

export async function getUnreadNotificationCount(supabase: TypedSupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}
