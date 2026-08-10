import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, requireActiveUser } from "./current-user";
import { toAppRole, type AppRole, type DbRole } from "./roles";

/**
 * requireActiveUser() (auth + is_active) üzerine rol bilgisini ekler.
 * user_role_assignments kendi satırını okumak RLS ile zaten serbest
 * (role_assignments_select_own_or_admin), bu yüzden ayrı bir RPC gerekmez.
 *
 * profile ve role sorguları ikisi de yalnızca user.id'ye bağlı olduğu için
 * (birbirine değil), requireActiveUser() ile paralel çalıştırılır — sırayla
 * çalıştırmak her sayfa geçişinde gereksiz bir round trip daha eklerdi.
 *
 * Rol ataması hiç yoksa (yeni oluşturulmuş, henüz rol verilmemiş kullanıcı)
 * güvenli tarafta kalıp /unauthorized'a yönlendirilir.
 */
export const getCurrentUserRole = cache(async () => {
  const user = await getAuthUser();
  const supabase = await createClient();

  const [{ user: activeUser, profile }, { data: assignment }] = await Promise.all([
    requireActiveUser(),
    supabase.from("user_role_assignments").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!assignment) {
    redirect("/unauthorized");
  }

  const dbRole = assignment.role as DbRole;
  return { user: activeUser, profile, dbRole, appRole: toAppRole(dbRole), supabase };
});

/**
 * Her rol bazlı layout/page bunu çağırır. Middleware'e güvenilmez:
 * asıl rol kontrolü burada (server) ve RLS'te yapılır.
 */
export async function requireRole(allowedRoles: AppRole[]) {
  const result = await getCurrentUserRole();

  if (!allowedRoles.includes(result.appRole)) {
    redirect("/unauthorized");
  }

  return result;
}
