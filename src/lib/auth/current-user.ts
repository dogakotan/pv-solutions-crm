import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Oturum + profil doğrulaması. Faz 1'de yalnız (protected) layout ve
 * dashboard tarafından kullanılıyor; ileriki fazlarda her korumalı
 * sayfa/route handler burada çağrılacak (Next.js DAL önerisi).
 *
 * Pasif kullanıcı (`is_active = false`) oturum açmış olsa bile CRM'e
 * erişemez: burada login sayfasına geri gönderilir.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});

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
