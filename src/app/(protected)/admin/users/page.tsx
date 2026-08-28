import { createClient } from "@/lib/supabase/server";
import { getStaffUsers } from "@/lib/data/users";
import { updateUserRole, updateUserActive } from "./actions";
import { AddStaffUserForm } from "./add-staff-user-form";
import { UsersTable } from "./users-table";
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
