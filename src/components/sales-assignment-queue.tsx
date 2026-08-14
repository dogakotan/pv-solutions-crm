import { LeadStageBadge } from "@/components/lead-badges";
import type { AssignableLead, ActiveUserOption } from "@/lib/data/assignments";

export function SalesAssignmentQueue({
  leads,
  salesUsers,
  assignAction,
  title = "Satış Çalışanına Atama Bekleyen Leadler",
  emptyMessage = "Satışa atama bekleyen lead yok.",
}: {
  leads: AssignableLead[];
  salesUsers: ActiveUserOption[];
  assignAction: (formData: FormData) => Promise<void>;
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground">
        {title} ({leads.length})
      </h2>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-8 text-center text-sm text-muted shadow-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Lead No</th>
                <th className="px-4 py-3">Müşteri</th>
                <th className="px-4 py-3">Şehir</th>
                <th className="px-4 py-3">Aşama</th>
                <th className="px-4 py-3">Ata</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{lead.leadNo}</td>
                  <td className="px-4 py-3 text-foreground">{lead.customerName}</td>
                  <td className="px-4 py-3 text-muted">{lead.city}</td>
                  <td className="px-4 py-3">
                    <LeadStageBadge stage={lead.stage} />
                  </td>
                  <td className="px-4 py-3">
                    <form action={assignAction} className="flex items-center gap-2">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <select
                        name="salesUserId"
                        defaultValue=""
                        required
                        className="rounded-lg border border-card-border px-2 py-1 text-sm"
                      >
                        <option value="" disabled>
                          Satış çalışanı seç
                        </option>
                        {salesUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background"
                      >
                        Ata
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
