import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware'in bu istekte doğruladığı kullanıcının id'sini taşıyan
 * request header'ı. `lib/auth/current-user.ts#getAuthUser` bunu okuyarak
 * supabase.auth.getUser()'ı (Auth sunucusuna network round-trip) sayfa
 * render aşamasında TEKRAR çağırmaktan kaçınır — middleware zaten her
 * eşleşen istekte bunu bir kez yapıyor (bkz. matcher, proxy.ts).
 *
 * Güvenlik: bu header'a yalnızca BURADA, middleware'in kendi
 * getUser() sonucuna göre yazılır ve her istekte üzerine yazılır —
 * istemcinin gönderdiği herhangi bir aynı-adlı header, middleware bu
 * satırı çalıştırdığı anda ezilir, hiçbir zaman geçmez. Kullanıcı
 * geçersizse boş string yazılır (yokluk = kimliksiz, "fail closed").
 */
export const VERIFIED_USER_ID_HEADER = "x-pv-verified-user-id";

/**
 * Middleware içinde oturum (session) cookie'lerini tazeleyen ve
 * doğrulanmış kullanıcı id'sini downstream'e taşıyan yardımcı.
 */
export async function updateSession(request: NextRequest) {
  let cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];

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
          cookiesToApply = cookiesToSet;
        },
      },
    }
  );

  // Token yenilemesini tetiklemek ve kullanıcıyı doğrulamak için Auth
  // sunucusuna gidiyoruz — bu artık istek başına TEK Auth round-trip'i.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  request.headers.set(VERIFIED_USER_ID_HEADER, user?.id ?? "");

  const response = NextResponse.next({ request });
  cookiesToApply.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}
