import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { LeadStage } from "@/types/lead";

type TypedSupabaseClient = SupabaseClient<Database>;

export type AssignableLead = {
  id: string;
  leadNo: string;
  customerName: string;
  city: string;
  stage: LeadStage;
};

export type ActiveUserOption = {
  id: string;
  fullName: string;
};

export type ActivePartnerOption = {
  id: string;
  name: string;
};

export async function getLeadsNeedingSalesAssignment(
  supabase: TypedSupabaseClient,
  limit = 50
): Promise<AssignableLead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, lead_no, customer_name, city, stage")
    .is("sales_user_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    leadNo: row.lead_no ?? "",
    customerName: row.customer_name,
    city: row.city,
    stage: row.stage as LeadStage,
  }));
}

export async function getLeadsNeedingPartnerAssignment(
  supabase: TypedSupabaseClient,
  limit = 50
): Promise<AssignableLead[]> {
  const { data: candidates, error } = await supabase
    .from("leads")
    .select("id, lead_no, customer_name, city, stage")
    .not("sales_user_id", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!candidates || candidates.length === 0) return [];

  const { data: activeReferrals, error: referralError } = await supabase
    .from("partner_referrals")
    .select("lead_id")
    .is("closed_at", null)
    .in("lead_id", candidates.map((lead) => lead.id));

  if (referralError) throw referralError;

  const leadIdsWithActiveReferral = new Set((activeReferrals ?? []).map((r) => r.lead_id));

  return candidates
    .filter((lead) => !leadIdsWithActiveReferral.has(lead.id))
    .map((row) => ({
      id: row.id,
      leadNo: row.lead_no ?? "",
      customerName: row.customer_name,
      city: row.city,
      stage: row.stage as LeadStage,
    }));
}

export async function getActiveSalesUsers(supabase: TypedSupabaseClient): Promise<ActiveUserOption[]> {
  const { data, error } = await supabase.rpc("list_active_sales_users");

  if (error) throw error;

  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
}

export async function getActivePvOwnerOptions(supabase: TypedSupabaseClient): Promise<ActiveUserOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, user_role_assignments!user_role_assignments_user_id_fkey!inner(role)")
    .eq("is_active", true)
    .in("user_role_assignments.role", ["pv_admin", "pv_sales"]);

  if (error) throw error;

  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
}

export async function getActivePartners(supabase: TypedSupabaseClient): Promise<ActivePartnerOption[]> {
  const { data, error } = await supabase
    .from("partners")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}
