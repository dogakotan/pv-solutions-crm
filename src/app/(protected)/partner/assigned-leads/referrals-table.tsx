"use client";

import { startTransition, useMemo, useState } from "react";
import type { PartnerReferralListItem } from "@/lib/data/leads";
import { LeadStageBadge, ReferralStatusBadge } from "@/components/lead-badges";
import type { PartnerReferralStatus } from "@/types/lead";

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

const STATUS_OPTIONS: { value: PartnerReferralStatus; label: string }[] = [
  { value: "pending", label: "Yönlendirildi" },
  { value: "accepted", label: "Kabul Edildi" },
  { value: "rejected", label: "Reddedildi" },
  { value: "cancelled", label: "İptal Edildi" },
  { value: "completed", label: "Tamamlandı" },
  { value: "expired", label: "Süresi Doldu" },
];

export function ReferralsTable({
  referrals,
  acceptAction,
  rejectAction,
}: {
  referrals: PartnerReferralListItem[];
  acceptAction: (formData: FormData) => Promise<{ error?: string }>;
  rejectAction: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PartnerReferralStatus | "all">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return referrals.filter((r) => {
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesQuery =
        query === "" ||
        r.customerName.toLowerCase().includes(query) ||
        r.leadNo.toLowerCase().includes(query) ||
        r.city.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [referrals, search, statusFilter]);

  function handleAccept(referralId: string) {
    setPendingId(referralId);
    setRowError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("referralId", referralId);
        const result = await acceptAction(fd);
        if (result.error) {
          setRowError({ id: referralId, message: result.error });
        }
      } catch (err) {
        setRowError({ id: referralId, message: err instanceof Error ? err.message : "İşlem başarısız oldu." });
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleReject(referralId: string) {
    const reason = (reasonDrafts[referralId] ?? "").trim();
    if (!reason) {
      setRowError({ id: referralId, message: "Ret için bir gerekçe girilmelidir." });
      return;
    }
    setPendingId(referralId);
    setRowError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("referralId", referralId);
        fd.set("reason", reason);
        const result = await rejectAction(fd);
        if (result.error) {
          setRowError({ id: referralId, message: result.error });
        }
      } catch (err) {
        setRowError({ id: referralId, message: err instanceof Error ? err.message : "İşlem başarısız oldu." });
      } finally {
        setPendingId(null);
      }
    });
  }

  if (referrals.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        Henüz size yönlendirilmiş bir müşteri bulunmuyor.
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
          aria-label="Duruma göre filtrele"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as PartnerReferralStatus | "all")}
          className={`${inputClass} sm:ml-auto sm:w-56`}
        >
          <option value="all">Tüm durumlar</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Arama/filtre kriterlerine uyan yönlendirme bulunamadı.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Lead No</th>
                <th className="px-4 py-3">Müşteri</th>
                <th className="px-4 py-3">Şehir</th>
                <th className="px-4 py-3">Süreç Aşaması</th>
                <th className="px-4 py-3">Yönlendirme Durumu</th>
                <th className="px-4 py-3">Yanıt Süresi</th>
                <th className="px-4 py-3">Yanıt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((referral) => (
                <tr key={referral.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{referral.leadNo}</td>
                  <td className="px-4 py-3 text-foreground">{referral.customerName}</td>
                  <td className="px-4 py-3 text-muted">{referral.city}</td>
                  <td className="px-4 py-3">
                    <LeadStageBadge stage={referral.stage} />
                  </td>
                  <td className="px-4 py-3">
                    <ReferralStatusBadge status={referral.status} />
                  </td>
                  <td className={referral.isOverdue ? "px-4 py-3 font-medium text-red-600" : "px-4 py-3 text-muted"}>
                    {new Date(referral.responseDueAt).toLocaleDateString("tr-TR")}
                    {referral.isOverdue && " (gecikti)"}
                  </td>
                  <td className="px-4 py-3">
                    {referral.status === "pending" ? (
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAccept(referral.id)}
                            disabled={pendingId === referral.id}
                            className="rounded-lg border border-card-border px-2 py-1 text-xs text-green-700 hover:bg-background disabled:opacity-50"
                          >
                            Kabul Et
                          </button>
                          <input
                            value={reasonDrafts[referral.id] ?? ""}
                            onChange={(event) =>
                              setReasonDrafts((prev) => ({ ...prev, [referral.id]: event.target.value }))
                            }
                            placeholder="Ret gerekçesi"
                            className="w-32 rounded-lg border border-card-border px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleReject(referral.id)}
                            disabled={pendingId === referral.id}
                            className="rounded-lg border border-card-border px-2 py-1 text-xs text-red-700 hover:bg-background disabled:opacity-50"
                          >
                            Reddet
                          </button>
                        </div>
                        {rowError?.id === referral.id && (
                          <span className="text-xs text-red-600">{rowError.message}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
