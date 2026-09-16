"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { OfferOverviewItem } from "@/lib/data/offers";
import type { OfferStatus } from "@/types/offer";
import { OffersOverviewTable } from "./offers-overview-table";

const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  open: "Açık",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  closed: "Kapandı",
};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function OffersListFilters({ offers }: { offers: OfferOverviewItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OfferStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minAmount = amountMin.trim() === "" ? null : Number(amountMin);
    const maxAmount = amountMax.trim() === "" ? null : Number(amountMax);
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    return offers.filter((offer) => {
      const matchesStatus = statusFilter === "all" || offer.status === statusFilter;
      const matchesQuery =
        query === "" ||
        offer.offerNo.toLowerCase().includes(query) ||
        offer.leadNo.toLowerCase().includes(query) ||
        offer.customerName.toLowerCase().includes(query);
      const createdAt = new Date(offer.createdAt);
      const matchesDateFrom = !fromDate || createdAt >= fromDate;
      const matchesDateTo = !toDate || createdAt <= toDate;
      const matchesAmountMin = minAmount === null || (offer.amount !== null && offer.amount >= minAmount);
      const matchesAmountMax = maxAmount === null || (offer.amount !== null && offer.amount <= maxAmount);
      return matchesStatus && matchesQuery && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
    });
  }, [offers, search, statusFilter, dateFrom, dateTo, amountMin, amountMax]);

  // Excel export, ekrandaki tabloyla aynı filtreleri görsün diye burada
  // uygulanan arama/durum/tarih/tutar kriterlerinin tamamı query param
  // olarak forward ediliyor — önceden yalnızca q/status gidiyordu, tarih ve
  // tutar filtreleriyle daraltılmış bir görünümü export etmek beklenenden
  // farklı (filtrelenmemiş) bir dosya indiriyordu.
  const exportParams = new URLSearchParams();
  if (search.trim()) exportParams.set("q", search.trim());
  if (statusFilter !== "all") exportParams.set("status", statusFilter);
  if (dateFrom) exportParams.set("from", dateFrom);
  if (dateTo) exportParams.set("to", dateTo);
  if (amountMin.trim()) exportParams.set("amountMin", amountMin.trim());
  if (amountMax.trim()) exportParams.set("amountMax", amountMax.trim());
  const exportHref = `/offers/excel${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Teklif no, lead no veya müşteri ara..."
            className={`${inputClass} sm:w-64`}
          />
          <select
            aria-label="Duruma göre filtrele"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as OfferStatus | "all")}
            className={`${inputClass} sm:w-44`}
          >
            <option value="all">Tüm durumlar</option>
            {Object.entries(OFFER_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>

          <a
            href={exportHref}
            className="flex items-center justify-center gap-2 rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background sm:ml-auto"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Excel&apos;e Aktar
          </a>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-xs text-muted">
            Tarih
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className={inputClass}
              aria-label="Başlangıç tarihi"
            />
          </label>
          <span className="text-xs text-muted">—</span>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className={inputClass}
              aria-label="Bitiş tarihi"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-muted">
            Tutar
            <input
              type="number"
              inputMode="decimal"
              value={amountMin}
              onChange={(event) => setAmountMin(event.target.value)}
              placeholder="Min"
              className={`${inputClass} w-28`}
              aria-label="Minimum tutar"
            />
          </label>
          <span className="text-xs text-muted">—</span>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="number"
              inputMode="decimal"
              value={amountMax}
              onChange={(event) => setAmountMax(event.target.value)}
              placeholder="Max"
              className={`${inputClass} w-28`}
              aria-label="Maksimum tutar"
            />
          </label>
        </div>
      </div>

      <OffersOverviewTable offers={filtered} emptyMessage="Arama/filtre kriterlerine uyan teklif bulunamadı." />
    </div>
  );
}
