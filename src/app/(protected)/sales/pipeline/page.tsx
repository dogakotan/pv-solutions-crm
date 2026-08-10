import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getVisibleLeads } from "@/lib/data/leads";
import { LeadScoreBadge } from "@/components/lead-badges";
import type { LeadStage } from "@/types/lead";
import { setLeadStage } from "./actions";

const COLUMNS: { stage: LeadStage; label: string; next: LeadStage | null }[] = [
  { stage: "new", label: "Yeni", next: "contacted" },
  { stage: "contacted", label: "İletişime Geçildi", next: "survey_scheduled" },
  { stage: "survey_scheduled", label: "Keşif Planlandı", next: "survey_completed" },
  { stage: "survey_completed", label: "Keşif Tamamlandı", next: "proposal_preparing" },
  { stage: "proposal_preparing", label: "Teklif Hazırlanıyor", next: "proposal_sent" },
  { stage: "proposal_sent", label: "Teklif Gönderildi", next: "negotiation" },
  { stage: "negotiation", label: "Pazarlık", next: null },
  { stage: "won", label: "Kazanıldı", next: null },
  { stage: "lost", label: "Kaybedildi", next: null },
];

export default async function SalesPipelinePage() {
  const supabase = await createClient();
  const leads = await getVisibleLeads(supabase, 200);

  const leadsByStage = new Map<LeadStage, typeof leads>();
  for (const lead of leads) {
    const existing = leadsByStage.get(lead.stage) ?? [];
    existing.push(lead);
    leadsByStage.set(lead.stage, existing);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Satış Pipeline</h1>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((column) => {
          const columnLeads = leadsByStage.get(column.stage) ?? [];

          return (
            <div key={column.stage} className="flex w-72 shrink-0 flex-col gap-3">
              <h2 className="flex items-center justify-between text-sm font-medium text-foreground">
                {column.label}
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                  {columnLeads.length}
                </span>
              </h2>

              <div className="flex flex-col gap-2">
                {columnLeads.map((lead) => (
                  <div key={lead.id} className="rounded-xl border border-card-border bg-card p-3 shadow-sm">
                    <p className="text-sm font-medium text-foreground">{lead.customerName}</p>
                    <p className="text-xs text-muted">{lead.leadNo} — {lead.city}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <LeadScoreBadge score={lead.leadScore} />

                      {column.stage === "negotiation" ? (
                        <Link
                          href={`/leads/${lead.id}`}
                          className="rounded-lg border border-card-border px-2 py-1 text-xs text-foreground hover:bg-background"
                        >
                          Sonucu Kaydet →
                        </Link>
                      ) : column.next ? (
                        <form action={setLeadStage}>
                          <input type="hidden" name="leadId" value={lead.id} />
                          <input type="hidden" name="stage" value={column.next} />
                          <button
                            type="submit"
                            className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background"
                          >
                            İlerlet →
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
