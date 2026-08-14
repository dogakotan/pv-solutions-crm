import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VERIFIED_USER_ID_HEADER } from "@/lib/supabase/middleware";

/**
 * Oturum doğrulaması. Kullanıcı id'si middleware'de (proxy.ts →
 * updateSession) YAPILMIŞ olan supabase.auth.getUser() doğrulamasının
 * sonucunu taşıyan request header'ından okunur — middleware zaten her
 * eşleşen istekte (matcher, favicon/statikler hariç hepsi) bu kontrolü
 * yapıyor; burada AYNI isteği ikinci kez Auth sunucusuna göndermek
 * (önceden böyleydi) her sayfa geçişine gereksiz bir network round-trip
 * daha ekliyordu.
 *
 * Header her istekte middleware tarafından kendi doğrulamasına göre
 * baştan yazılır (bkz. lib/supabase/middleware.ts) — istemcinin
 * gönderdiği bir değer asla buraya sızamaz. Header yoksa/boşsa
 * (middleware'den geçmemiş bir istek, ya da kullanıcı doğrulanamamış)
 * güvenli tarafta kalıp login'e yönlendirilir — "fail closed".
 *
 * Pasif kullanıcı (`is_active = false`) oturum açmış olsa bile CRM'e
 * erişemez: bkz. requireActiveUser (login sayfasına geri gönderilir).
 */
export const getAuthUser = cache(async () => {
  const userId = await getVerifiedUserId();

  if (!userId) {
    redirect("/login");
  }

  return { id: userId };
});

/**
 * `getAuthUser`'ın yönlendirmeyen hâli — form action'ları (Server
 * Action) için: oturum düşmüşse kullanıcıyı sessizce `/login`'e atmak
 * yerine forma "Oturum bulunamadı" gibi bir hata döndürebilsinler diye.
 * Aynı header'ı okur, aynı "fail closed" garantisi geçerlidir (yoksa/
 * boşsa null döner).
 */
export async function getVerifiedUserId(): Promise<string | null> {
  const requestHeaders = await headers();
  return requestHeaders.get(VERIFIED_USER_ID_HEADER) || null;
}

export const requireActiveUser = cache(async () => {
  const user = await getAuthUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    redirect("/account-disabled");
  }

  return { user, profile };
});
