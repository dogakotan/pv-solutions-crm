"use client";

import { useMemo, useState } from "react";
import type { SiteVisitItem } from "@/lib/data/leads";

function formatDateKey(iso: string | null): string {
  if (!iso) return "Tarih belirtilmemiş";
  return new Date(iso).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatAddress(visit: SiteVisitItem): string {
  return [visit.district, visit.address].filter(Boolean).join(", ") || "Adres girilmemiş";
}

function mapsHref(visit: SiteVisitItem): string {
  const query = [visit.address, visit.district, visit.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function SiteVisitsList({ visits }: { visits: SiteVisitItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return visits;
    return visits.filter(
      (v) =>
        v.customerName.toLowerCase().includes(query) ||
        v.leadNo.toLowerCase().includes(query) ||
        v.phone.toLowerCase().includes(query) ||
        formatAddress(v).toLowerCase().includes(query)
    );
  }, [visits, search]);

  const groups = new Map<string, SiteVisitItem[]>();
  for (const visit of filtered) {
    const key = formatDateKey(visit.scheduledAt);
    const existing = groups.get(key) ?? [];
    existing.push(visit);
    groups.set(key, existing);
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Müşteri, lead no, telefon veya adres ara..."
        className="rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:w-80"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Arama kriterine uyan bir keşif ziyareti bulunamadı.
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
                      <th className="px-4 py-3">Telefon</th>
                      <th className="px-4 py-3">Adres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayVisits.map((visit) => (
                      <tr key={visit.referralId} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-3 font-medium text-foreground">{visit.leadNo}</td>
                        <td className="px-4 py-3 text-foreground">{visit.customerName}</td>
                        <td className="px-4 py-3">
                          <a href={`tel:${visit.phone}`} className="text-brand hover:underline">
                            {visit.phone}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          <div className="flex flex-col gap-0.5">
                            <span>{formatAddress(visit)}</span>
                            <a
                              href={mapsHref(visit)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand hover:underline"
                            >
                              Haritada Aç
                            </a>
                          </div>
                        </td>
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
