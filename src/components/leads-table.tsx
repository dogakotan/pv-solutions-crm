"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadListItem } from "@/lib/data/leads";
import type { LeadStage } from "@/types/lead";
import { LeadStageBadge, LeadScoreBadge, STAGE_STYLES } from "@/components/lead-badges";

const PAGE_SIZE = 10;

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function LeadsTable({
  leads,
  emptyMessage = "Görüntülenecek lead bulunamadı.",
}: {
  leads: LeadListItem[];
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageLeads = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Müşteri, lead no veya şehir ara..."
          className={`${inputClass} sm:w-72`}
        />
        <select
          aria-label="Aşamaya göre filtrele"
          value={stageFilter}
          onChange={(event) => {
            setStageFilter(event.target.value as LeadStage | "all");
            setPage(1);
          }}
          className={`${inputClass} sm:w-56`}
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
        <>
          <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Lead No</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Şehir</th>
                  <th className="px-4 py-3">Aşama</th>
                  <th className="px-4 py-3">Puan</th>
                  <th className="px-4 py-3">Sonraki Takip</th>
                </tr>
              </thead>
              <tbody>
                {pageLeads.map((lead) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Sayfa {currentPage} / {totalPages} — {filtered.length} lead
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-card-border px-3 py-1.5 hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-card-border px-3 py-1.5 hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
