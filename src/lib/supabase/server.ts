import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * Server (Server Component / Server Action / Route Handler) Supabase istemcisi.
 *
 * Next.js cookie tabanlı oturum yönetimi için @supabase/ssr'nin güncel
 * resmi yaklaşımı kullanılır. Server Component içinden çağrıldığında
 * cookie set/remove işlemleri sessizce yok sayılır (Next.js kısıtlaması);
 * gerçek cookie yazımı yalnızca Server Action veya Route Handler
 * içerisinde gerçekleşir — middleware bu senkronizasyonu tamamlar.
 *
 * ÖNEMLİ: Route/erişim korumasında yalnızca cookie varlığına veya
 * getSession() içindeki kullanıcı nesnesine güvenilmemelidir.
 * Yetki gereken her noktada supabase.auth.getUser() ile sunucu
 * tarafında doğrulama yapılmalıdır (getUser() her çağrıda Supabase
 * Auth sunucusuna gidip token'ı doğrular).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component içinden çağrıldığında set işlemi başarısız
            // olabilir; middleware oturum yenilemesini üstlendiği için
            // bu durum güvenle yok sayılabilir.
          }
        },
      },
    }
  );
}
