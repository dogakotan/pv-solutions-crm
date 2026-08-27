import { createClient } from "@/lib/supabase/server";
import { getPartnerSiteVisits } from "@/lib/data/leads";
import { SetHeaderContent } from "@/components/page-header-slot";

function formatDateKey(iso: string | null): string {
  if (!iso) return "Tarih belirtilmemiş";
  return new Date(iso).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PartnerSiteVisitsPage() {
  const supabase = await createClient();
  const visits = await getPartnerSiteVisits(supabase);

  const groups = new Map<string, typeof visits>();
  for (const visit of visits) {
    const key = formatDateKey(visit.scheduledAt);
    const existing = groups.get(key) ?? [];
    existing.push(visit);
    groups.set(key, existing);
  }

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Keşif Ziyaretleri</h1>
      </SetHeaderContent>

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Planlanmış bir keşif ziyareti bulunmuyor.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groups.entries()).map(([dateLabel, dayVisits]) => (
            <div key={dateLabel} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-foreground">{dateLabel}</h2>
              <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Lead No</th>
                      <th className="px-4 py-3">Müşteri</th>
                      <th className="px-4 py-3">Şehir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayVisits.map((visit) => (
                      <tr key={visit.referralId} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-3 font-medium text-foreground">{visit.leadNo}</td>
                        <td className="px-4 py-3 text-foreground">{visit.customerName}</td>
                        <td className="px-4 py-3 text-muted">{visit.city}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
