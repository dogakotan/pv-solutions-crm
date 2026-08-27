import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyNotifications, getUnreadNotificationCount } from "@/lib/data/notifications";

/**
 * Header'daki bildirim kutusu client tarafından çağırıyor — Cache
 * Components altında server component prop'ları (App Shell) oturum
 * başına client'ta önbelleklendiği için router.refresh() bir mark-as-read
 * sonrasında güncel veriyi garanti etmiyordu. Düz bir fetch(no-store) ile
 * bu önbellek katmanının tamamen dışında kalınıyor.
 */
export async function GET() {
  const supabase = await createClient();
  const [unreadCount, notifications] = await Promise.all([
    getUnreadNotificationCount(supabase),
    getMyNotifications(supabase, 8),
  ]);

  return NextResponse.json(
    { unreadCount, notifications },
    { headers: { "Cache-Control": "no-store" } }
  );
}
