import type { PartnerEmployee } from "@/types/partner";
import { AddEmployeeForm } from "./add-employee-form";
import { setPartnerEmployeeActive } from "./employees-actions";

const ROLE_LABELS = {
  partner_admin: "Partner Yönetici",
  partner_employee: "Partner Çalışanı",
} as const;

export function PartnerEmployeesTab({
  partnerId,
  employees,
}: {
  partnerId: string;
  employees: PartnerEmployee[];
}) {
  const toggleActive = setPartnerEmployeeActive.bind(null, partnerId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Çalışanlar</span>
      </div>

      <AddEmployeeForm partnerId={partnerId} />

      {employees.length === 0 ? (
        <p className="text-sm text-muted">Bu partnerin henüz kayıtlı çalışanı yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-card-border text-muted">
              <tr>
                <th className="py-2 font-medium">Ad Soyad</th>
                <th className="py-2 font-medium">Rol</th>
                <th className="py-2 font-medium">Telefon</th>
                <th className="py-2 font-medium">Durum</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-card-border last:border-0">
                  <td className="py-2 text-foreground">{employee.fullName}</td>
                  <td className="py-2 text-muted">{ROLE_LABELS[employee.role]}</td>
                  <td className="py-2 text-muted">{employee.phone}</td>
                  <td className="py-2">
                    <span
                      className={
                        employee.isActive
                          ? "rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                      }
                    >
                      {employee.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <form action={toggleActive}>
                      <input type="hidden" name="userId" value={employee.id} />
                      <input type="hidden" name="isActive" value={(!employee.isActive).toString()} />
                      <button
                        type="submit"
                        className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background"
                      >
                        {employee.isActive ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
