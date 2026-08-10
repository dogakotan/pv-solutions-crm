import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Browser (client component) Supabase istemcisi.
 *
 * Yalnızca NEXT_PUBLIC_ ile başlayan, tarayıcıya çıkması güvenli olan
 * URL ve publishable/anon key kullanılır. Service role key bu dosyada
 * ASLA kullanılmamalıdır.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
