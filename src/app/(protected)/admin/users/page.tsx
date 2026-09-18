import { createClient } from "@/lib/supabase/server";
import { getStaffUsers } from "@/lib/data/users";
import { updateUserRole, updateUserActive } from "./actions";
import { AddStaffUserForm } from "./add-staff-user-form";
import { UsersTable } from "./users-table";
import { SetHeaderContent } from "@/components/page-header-slot";
import type { DbRole } from "@/lib/auth/roles";

// Dokuzuncu tur inceleme: partner_admin/partner_employee bu listede
// duruyordu ama bu sayfa yalnızca staff hesaplarını (profiles.partner_id
// olmayan) listeliyor — set_user_role bu iki rolü partner_id'siz bir
// kullanıcı için her zaman reddediyor. Seçilebilir ama her zaman
// başarısız olan ölü seçenekler kaldırıldı.
const ROLE_LABELS: Record<Extract<DbRole, "pv_admin" | "pv_sales" | "first_call">, string> = {
  pv_admin: "Admin",
  pv_sales: "Satış",
  first_call: "First Call",
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [DbRole, string][];

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const users = await getStaffUsers(supabase);

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

      <UsersTable
        users={users}
        roleOptions={ROLE_OPTIONS}
        updateRoleAction={updateUserRole}
        updateActiveAction={updateUserActive}
      />
    </div>
  );
}
