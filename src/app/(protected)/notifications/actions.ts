"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(notificationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return {};
}
