import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { ActivityType, ActivityVisibility } from "@/types/activity";

type TypedSupabaseClient = SupabaseClient<Database>;

export type ActivityItem = {
  id: string;
  activityType: ActivityType;
  visibility: ActivityVisibility;
  title: string;
  description: string | null;
  occurredAt: string | null;
  nextFollowUpAt: string | null;
  createdByName: string;
  createdAt: string;
};

type NameEmbed = { full_name: string } | { full_name: string }[] | null;

function extractName(embed: NameEmbed): string {
  if (!embed) return "—";
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.full_name ?? "—";
}

const ACTIVITY_SELECT =
  "id, activity_type, visibility, title, description, occurred_at, next_follow_up_at, created_at, created_by:profiles!activities_created_by_fkey(full_name)";

export async function getActivitiesForLead(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    activityType: row.activity_type as ActivityType,
    visibility: row.visibility as ActivityVisibility,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
    nextFollowUpAt: row.next_follow_up_at,
    createdByName: extractName(row.created_by as NameEmbed),
    createdAt: row.created_at,
  }));
}

export type ActivityFeedItem = ActivityItem & {
  leadId: string;
  leadNo: string;
  customerName: string;
};

type LeadEmbed = { id: string; lead_no: string; customer_name: string } | { id: string; lead_no: string; customer_name: string }[] | null;

function extractLead(embed: LeadEmbed) {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

type FeedRow = {
  id: string;
  activity_type: string;
  visibility: string;
  title: string;
  description: string | null;
  occurred_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  created_by: NameEmbed;
  leads: LeadEmbed;
};

function mapFeedRow(row: FeedRow): ActivityFeedItem | null {
  const lead = extractLead(row.leads);
  if (!lead) return null;

  return {
    id: row.id,
    activityType: row.activity_type as ActivityType,
    visibility: row.visibility as ActivityVisibility,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
    nextFollowUpAt: row.next_follow_up_at,
    createdByName: extractName(row.created_by),
    createdAt: row.created_at,
    leadId: lead.id,
    leadNo: lead.lead_no,
    customerName: lead.customer_name,
  };
}

export async function getVisibleActivities(
  supabase: TypedSupabaseClient,
  limit = 50
): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `${ACTIVITY_SELECT}, leads(id, lead_no, customer_name)`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as unknown as FeedRow[]).flatMap((row) => mapFeedRow(row) ?? []);
}

/**
 * Haftalık ajanda görünümü için: bu tarih aralığında (genelde bir hafta,
 * [start, end) yarı açık) "sonraki takip" günü olan aktiviteler.
 * `created_at`e göre sıralanan getVisibleActivities'in sabit limitinin
 * dışında kalabilecek eski ama takibi bu haftaya düşen kayıtları
 * kaçırmamak için ayrı, tarih aralığına göre filtrelenen bir sorgu.
 */
export async function getActivitiesDueInRange(
  supabase: TypedSupabaseClient,
  startIso: string,
  endIso: string
): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `${ACTIVITY_SELECT}, leads(id, lead_no, customer_name)`
    )
    .gte("next_follow_up_at", startIso)
    .lt("next_follow_up_at", endIso)
    .order("next_follow_up_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as FeedRow[]).flatMap((row) => mapFeedRow(row) ?? []);
}

/**
 * Aktivite formunda "Partnerle paylaş" seçeneği yalnızca lead'in kabul
 * edilmiş (accepted) bir yönlendirmesi varsa gösterilir — henüz kabul
 * etmemiş/reddetmiş bir partnerle aktivite paylaşmanın anlamı yok.
 */
export async function getAcceptedReferralForLead(
  supabase: TypedSupabaseClient,
  leadId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "accepted")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
