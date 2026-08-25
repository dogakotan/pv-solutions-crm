/**
 * DB'deki gerçek app_role enum değerleri (pv_admin/pv_sales/partner_admin/
 * partner_employee mevcut Faz 1 tasarımından; first_call sonradan eklendi).
 * Bunlar hiçbir migration'da yeniden adlandırılmadı — RLS politikalarının
 * tamamı bu isimlere gömülü.
 */
export type DbRole = "pv_admin" | "pv_sales" | "partner_admin" | "partner_employee" | "first_call";

/**
 * Uygulama/UI tarafında kullanılan rol tipi. partner_admin ve
 * partner_employee DB'de ayrı roller olarak kalır (RLS'te çalışan bazlı
 * görünürlük farkı için); burada ikisi de "partner" olarak görünür.
 */
export type AppRole = "admin" | "first_call" | "sales" | "partner";

const DB_TO_APP_ROLE: Record<DbRole, AppRole> = {
  pv_admin: "admin",
  pv_sales: "sales",
  partner_admin: "partner",
  partner_employee: "partner",
  first_call: "first_call",
};

export function toAppRole(dbRole: DbRole): AppRole {
  return DB_TO_APP_ROLE[dbRole];
}

export function getDefaultRouteForRole(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "first_call":
      return "/first-call/lead-pool";
    case "sales":
      return "/sales";
    case "partner":
      return "/partner/assigned-leads";
  }
}
