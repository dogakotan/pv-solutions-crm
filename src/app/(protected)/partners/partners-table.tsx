"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Partner, PartnerStatus } from "@/types/partner";
import { PartnerStatusBadge, PARTNER_STATUS_STYLES } from "./partner-status-badge";

const PAGE_SIZE = 10;

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function PartnersTable({ partners }: { partners: Partner[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return partners.filter((partner) => {
      const matchesStatus = statusFilter === "all" || partner.status === statusFilter;
      const matchesQuery =
        query === "" ||
        partner.name.toLowerCase().includes(query) ||
        partner.partnerCode.toLowerCase().includes(query) ||
        partner.serviceRegions.some((region) => region.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [partners, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagePartners = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Satıra tıklandığında beklemeyi azaltmak için görünen sayfadaki
  // partnerleri önceden getir — mouseEnter'daki prefetch dokunmatik
  // cihazlarda (hover olayı yok) hiç tetiklenmiyordu.
  useEffect(() => {
    for (const partner of pagePartners) {
      router.prefetch(`/partners/${partner.id}`);
    }
  }, [pagePartners, router]);

  if (partners.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        Görüntülenecek partner bulunamadı.
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
          placeholder="Firma adı, kod veya bölge ara..."
          className={`${inputClass} sm:w-72`}
        />
        <select
          aria-label="Duruma göre filtrele"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as PartnerStatus | "all");
            setPage(1);
          }}
          className={`${inputClass} sm:w-48`}
        >
          <option value="all">Tüm durumlar</option>
          {Object.entries(PARTNER_STATUS_STYLES).map(([status, { label }]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Arama/filtre kriterlerine uyan partner bulunamadı.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Partner</th>
                  <th className="px-5 py-3 font-medium">Bölge</th>
                  <th className="px-5 py-3 font-medium">Toplam Lead</th>
                  <th className="px-5 py-3 font-medium">Aktif Lead</th>
                  <th className="px-5 py-3 font-medium">Satış</th>
                  <th className="px-5 py-3 font-medium">Dönüşüm</th>
                  <th className="px-5 py-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {pagePartners.map((partner) => (
                  <tr
                    key={partner.id}
                    onClick={() => router.push(`/partners/${partner.id}`)}
                    className="cursor-pointer border-b border-card-border last:border-0 hover:bg-background"
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{partner.name}</td>
                    <td className="px-5 py-3 text-muted">{partner.serviceRegions.join(", ")}</td>
                    <td className="px-5 py-3 text-muted">{partner.stats.totalLeads}</td>
                    <td className="px-5 py-3 text-muted">{partner.stats.activeLeads}</td>
                    <td className="px-5 py-3 text-muted">{partner.stats.sales}</td>
                    <td className="px-5 py-3 text-muted">%{partner.stats.conversionRate.toFixed(1)}</td>
                    <td className="px-5 py-3">
                      <PartnerStatusBadge status={partner.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Sayfa {currentPage} / {totalPages} — {filtered.length} partner
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
