"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadListItem } from "@/lib/data/leads";
import type { LeadStage } from "@/types/lead";
import { LeadStageBadge, LeadScoreBadge, STAGE_STYLES } from "@/components/lead-badges";

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function LeadsTable({
  leads,
  emptyMessage = "Görüntülenecek lead bulunamadı.",
  onClaim,
}: {
  leads: LeadListItem[];
  emptyMessage?: string;
  onClaim?: (leadId: string) => void | Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  async function handleClaim(leadId: string) {
    if (!onClaim) return;
    setClaimingId(leadId);
    try {
      await onClaim(leadId);
    } finally {
      setClaimingId(null);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
      const matchesQuery =
        query === "" ||
        lead.customerName.toLowerCase().includes(query) ||
        lead.leadNo.toLowerCase().includes(query) ||
        lead.city.toLowerCase().includes(query);
      return matchesStage && matchesQuery;
    });
  }, [leads, search, stageFilter]);

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Müşteri, lead no veya şehir ara..."
          className={`${inputClass} sm:w-72`}
        />
        <select
          aria-label="Aşamaya göre filtrele"
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value as LeadStage | "all")}
          className={`${inputClass} sm:ml-auto sm:w-56`}
        >
          <option value="all">Tüm aşamalar</option>
          {Object.entries(STAGE_STYLES).map(([stage, { label }]) => (
            <option key={stage} value={stage}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Arama/filtre kriterlerine uyan lead bulunamadı.
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
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Sonraki Takip</th>
                {onClaim && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-brand hover:underline">
                      {lead.leadNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{lead.customerName}</td>
                  <td className="px-4 py-3 text-muted">{lead.city}</td>
                  <td className="px-4 py-3">
                    <LeadStageBadge stage={lead.stage} />
                  </td>
                  <td className="px-4 py-3">
                    <LeadScoreBadge score={lead.leadScore} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString("tr-TR") : "—"}
                  </td>
                  {onClaim && (
                    <td className="px-4 py-3">
                      {lead.firstCallUserId === null && (
                        <button
                          type="button"
                          onClick={() => handleClaim(lead.id)}
                          disabled={claimingId === lead.id}
                          className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background disabled:opacity-50"
                        >
                          {claimingId === lead.id ? "Atanıyor..." : "Bana Ata"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
