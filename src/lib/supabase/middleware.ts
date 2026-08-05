import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware içinde oturum (session) cookie'lerini tazeleyen yardımcı.
 *
 * Bu fonksiyon her istekte çalışarak süresi dolmuş access token'ları
 * yeniler ve güncel cookie'leri response'a yazar. Faz 1'de gerçek
 * route koruması (korumalı layout + rol kontrolü) burada değil,
 * ilgili layout/page içinde supabase.auth.getUser() ile yapılacaktır;
 * middleware yalnızca cookie senkronizasyonundan sorumludur.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Token yenilemesini tetiklemek için kullanıcıyı Auth sunucusundan
  // doğrulatıyoruz. Dönen değer bu fazda kullanılmıyor; Faz 1'de
  // korumalı route mantığı buraya eklenecek.
  await supabase.auth.getUser();

  return supabaseResponse;
}
