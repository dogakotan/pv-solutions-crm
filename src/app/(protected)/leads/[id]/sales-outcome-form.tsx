"use client";

import { useActionState, useState } from "react";
import { recordSalesOutcome, type RecordOutcomeState } from "./actions";
import type { LeadOfferVersionOption } from "@/lib/data/offers";

const initialState: RecordOutcomeState = {};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function SalesOutcomeForm({
  leadId,
  offerVersions,
}: {
  leadId: string;
  offerVersions: LeadOfferVersionOption[];
}) {
  const [state, formAction, pending] = useActionState(recordSalesOutcome, initialState);
  const [outcome, setOutcome] = useState<"won" | "lost">("won");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="leadId" value={leadId} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOutcome("won")}
          className={
            outcome === "won"
              ? "rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
              : "rounded-lg border border-card-border px-4 py-2 text-sm text-foreground hover:bg-background"
          }
        >
          Kazanıldı
        </button>
        <button
          type="button"
          onClick={() => setOutcome("lost")}
          className={
            outcome === "lost"
              ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
              : "rounded-lg border border-card-border px-4 py-2 text-sm text-foreground hover:bg-background"
          }
        >
          Kaybedildi
        </button>
      </div>
      <input type="hidden" name="outcome" value={outcome} />

      {outcome === "won" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className="text-sm font-medium text-foreground">Kabul Edilen Teklif</label>
            {offerVersions.length === 0 ? (
              <p className="text-sm text-red-600">
                Bu lead için henüz bir teklif revizyonu yok — önce teklif oluşturulmalı.
              </p>
            ) : (
              <select name="offerVersionId" required className={inputClass}>
                {offerVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.offerNo} — Rev.{v.revisionNo} ({v.amount.toLocaleString("tr-TR")} {v.currency})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Nihai Tutar</label>
            <input type="number" name="finalAmount" min="0" step="0.01" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Para Birimi</label>
            <select name="currency" defaultValue="TRY" className={inputClass}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Kayıp Gerekçesi</label>
            <input name="lostReason" required placeholder="Fiyat, rakip teklifi, vazgeçti..." className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Detay (opsiyonel)</label>
            <input name="lostReasonDetail" className={inputClass} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">Not (opsiyonel)</label>
        <textarea name="notes" rows={2} className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || (outcome === "won" && offerVersions.length === 0)}
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Sonucu Kaydet"}
      </button>
    </form>
  );
}
