"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OfferListItem } from "@/lib/data/offers";
import type { OfferStatus } from "@/types/offer";
import { OfferStatusBadge } from "@/components/offer-badges";

const PAGE_SIZE = 10;

const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  open: "Açık",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  closed: "Kapandı",
};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function OffersTable({ offers }: { offers: OfferListItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OfferStatus | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return offers.filter((offer) => {
      const matchesStatus = statusFilter === "all" || offer.status === statusFilter;
      const matchesQuery =
        query === "" ||
        offer.offerNo.toLowerCase().includes(query) ||
        offer.leadNo.toLowerCase().includes(query) ||
        offer.customerName.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [offers, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageOffers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Teklif no, lead no veya müşteri ara..."
          className={`${inputClass} sm:w-72`}
        />
        <select
          aria-label="Duruma göre filtrele"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as OfferStatus | "all");
            setPage(1);
          }}
          className={`${inputClass} sm:w-48`}
        >
          <option value="all">Tüm durumlar</option>
          {Object.entries(OFFER_STATUS_LABELS).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Arama/filtre kriterlerine uyan teklif bulunamadı.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Teklif No</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Oluşturulma</th>
                </tr>
              </thead>
              <tbody>
                {pageOffers.map((offer) => (
                  <tr key={offer.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/offers/${offer.id}`} className="font-medium text-brand hover:underline">
                        {offer.offerNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{offer.leadNo}</td>
                    <td className="px-4 py-3 text-foreground">{offer.customerName}</td>
                    <td className="px-4 py-3">
                      <OfferStatusBadge status={offer.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(offer.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Sayfa {currentPage} / {totalPages} — {filtered.length} teklif
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
