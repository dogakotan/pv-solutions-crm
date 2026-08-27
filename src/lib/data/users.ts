import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

export type StaffUser = {
  id: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  role: string | null;
};

type RoleEmbed = { role: string } | { role: string }[] | null;

function extractRole(embed: RoleEmbed): string | null {
  if (!embed) return null;
  if (Array.isArray(embed)) return embed[0]?.role ?? null;
  return embed.role;
}

export async function getStaffUsers(supabase: TypedSupabaseClient): Promise<StaffUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, partner_id, user_role_assignments!user_role_assignments_user_id_fkey(role)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    isActive: row.is_active,
    role: extractRole(row.user_role_assignments as RoleEmbed),
  }));
}

export type OwnProfile = {
  fullName: string;
  email: string | null;
  phone: string | null;
};

export async function getOwnProfile(supabase: TypedSupabaseClient, userId: string): Promise<OwnProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", userId)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
  };
}
