import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * service_role istemcisi — RLS'i tamamen bypass eder. Yalnızca Auth Admin
 * API (auth.users hesabı oluşturma/silme) gibi normal client/RLS ile
 * yapılamayacak işlemler için kullanılmalı, hiçbir zaman normal veri
 * okuma/yazma yerine geçmemeli. Her çağıran önce kendi requireRole
 * kontrolünü yapmak zorundadır — bu istemci kendi başına yetki kontrolü
 * yapmaz.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY tanımlı değil — .env.local dosyasına eklenmeli (Supabase Dashboard > Project Settings > API > service_role)."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
