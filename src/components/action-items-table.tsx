import Link from "next/link";
import type { ActionItem } from "@/lib/data/leads";
import { LeadStageBadge } from "@/components/lead-badges";
import { EmptyState } from "@/components/empty-state";
import { CheckCircle2 } from "lucide-react";

const REASON_STYLES: Record<ActionItem["reason"], { label: string; className: string }> = {
  follow_up_overdue: { label: "Takip Gecikmiş", className: "bg-red-50 text-red-700" },
  partner_response_overdue: { label: "Partner Yanıtı Gecikmiş", className: "bg-amber-50 text-amber-700" },
};

export function ActionItemsTable({ items }: { items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Aksiyon gerektiren bir şey yok"
        description="Şu an gecikmiş takip veya partner yanıtı bulunmuyor."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Lead No</th>
            <th className="px-4 py-3">Müşteri</th>
            <th className="px-4 py-3">Şehir</th>
            <th className="px-4 py-3">Aşama</th>
            <th className="px-4 py-3">Sorun</th>
            <th className="px-4 py-3">Tarih</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const reason = REASON_STYLES[item.reason];
            return (
              <tr key={item.id} className="border-b border-card-border last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/leads/${item.leadId}`} className="font-medium text-brand hover:underline">
                    {item.leadNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">{item.customerName}</td>
                <td className="px-4 py-3 text-muted">{item.city}</td>
                <td className="px-4 py-3">
                  <LeadStageBadge stage={item.stage} />
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${reason.className}`}>
                    {reason.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{new Date(item.dueAt).toLocaleDateString("tr-TR")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
