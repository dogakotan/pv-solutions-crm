import Link from "next/link";
import { Handshake } from "lucide-react";
import type { PartnerActivityItem } from "@/lib/data/partners";
import { ReferralStatusBadge } from "@/components/lead-badges";

export function PartnerActivityCard({ activity }: { activity: PartnerActivityItem[] }) {
  return (
    <div className="flex flex-col rounded-2xl border border-card-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
          <Handshake className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted">Partner Aktiviteleri</p>
          <p className="text-2xl font-semibold text-foreground">{activity.length}</p>
        </div>
      </div>

      {activity.length > 0 ? (
        <div className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto border-t border-card-border pt-4">
          {activity.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-foreground">{item.partnerName}</span>
                <span className="text-muted">→</span>
                <Link href={`/leads/${item.leadId}`} className="truncate text-brand hover:underline">
                  {item.customerName}
                </Link>
                <ReferralStatusBadge status={item.status} />
              </div>
              <span className="whitespace-nowrap text-muted">
                {new Date(item.updatedAt).toLocaleString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 border-t border-card-border pt-4 text-xs text-muted">
          Henüz bir partner yönlendirme aktivitesi yok.
        </p>
      )}
    </div>
  );
}
