import { createClient } from "@/lib/supabase/server";
import { updateUserRole, updateUserActive } from "./actions";
import { AddStaffUserForm } from "./add-staff-user-form";
import { SetHeaderContent } from "@/components/page-header-slot";
import type { DbRole } from "@/lib/auth/roles";

const ROLE_LABELS: Record<DbRole, string> = {
  pv_admin: "Admin",
  pv_sales: "Satış",
  first_call: "First Call",
  partner_admin: "Partner Yöneticisi",
  partner_employee: "Partner Çalışanı",
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [DbRole, string][];

type RoleEmbed = { role: string } | { role: string }[] | null;

function extractRole(embed: RoleEmbed): string | null {
  if (!embed) return null;
  if (Array.isArray(embed)) return embed[0]?.role ?? null;
  return embed.role;
}

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, partner_id, user_role_assignments!user_role_assignments_user_id_fkey(role)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const users = (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    isActive: row.is_active,
    role: extractRole(row.user_role_assignments as RoleEmbed),
  }));

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Kullanıcılar</h1>
      </SetHeaderContent>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted">
          pv_admin, pv_sales ve first_call hesapları burada oluşturulur ve rolleri
          yönetilir. Partner hesapları için ilgili partnerin sayfasındaki
          &quot;Çalışan Ekle&quot; formu kullanılır.
        </p>
        <AddStaffUserForm />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Ad Soyad</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-card-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{user.fullName || "—"}</td>
                <td className="px-4 py-3 text-muted">{user.email}</td>
                <td className="px-4 py-3">
                  <form action={updateUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <select
                      name="role"
                      defaultValue={user.role ?? ""}
                      className="rounded-lg border border-card-border px-2 py-1 text-sm"
                    >
                      <option value="" disabled>
                        Rol seç
                      </option>
                      {ROLE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background"
                    >
                      Kaydet
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <form action={updateUserActive} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="isActive" value={String(!user.isActive)} />
                    <span
                      className={
                        user.isActive
                          ? "inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                          : "inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                      }
                    >
                      {user.isActive ? "Aktif" : "Pasif"}
                    </span>
                    <button
                      type="submit"
                      className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background"
                    >
                      {user.isActive ? "Pasif yap" : "Aktif yap"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
