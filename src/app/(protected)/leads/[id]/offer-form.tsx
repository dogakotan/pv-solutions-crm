"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendOffer, reviseOffer, type OfferFormState } from "./actions";
import type { OfferLineItem, OfferVersionItem } from "@/lib/data/offers";

const initialState: OfferFormState = {};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

type DraftItemRow = {
  key: string;
  productCode: string;
  productName: string;
  quantity: string;
  unitPrice: string;
};

let draftRowCounter = 0;

function nextDraftKey(): string {
  draftRowCounter += 1;
  return `row-${draftRowCounter}`;
}

function emptyDraftRow(): DraftItemRow {
  return { key: nextDraftKey(), productCode: "", productName: "", quantity: "1", unitPrice: "" };
}

function draftRowsFromItems(items: OfferLineItem[]): DraftItemRow[] {
  if (items.length === 0) return [emptyDraftRow()];
  return items.map((item) => ({
    key: nextDraftKey(),
    productCode: item.productCode ?? "",
    productName: item.productName,
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
  }));
}

export function OfferForm({
  leadId,
  offerId,
  latestVersion,
}: {
  leadId: string;
  offerId: string | null;
  latestVersion: OfferVersionItem | null;
}) {
  const isRevision = offerId !== null;
  const action = isRevision ? reviseOffer : sendOffer;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DraftItemRow[]>(() => draftRowsFromItems(latestVersion?.items ?? []));
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  function updateRow(key: string, field: keyof Omit<DraftItemRow, "key">, value: string) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyDraftRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  const itemsSubtotal = rows.reduce((sum, row) => {
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    if (!row.productName.trim() || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return sum;
    return sum + quantity * unitPrice;
  }, 0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        {isRevision ? "Revize Et" : "Teklif Gönder"}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-card-border p-4">
      <input type="hidden" name="leadId" value={leadId} />
      {offerId && <input type="hidden" name="offerId" value={offerId} />}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Ürün Kalemleri</label>
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-card-border p-2"
            >
              <input
                type="text"
                name="itemProductCode"
                placeholder="Ürün Kodu"
                value={row.productCode}
                onChange={(e) => updateRow(row.key, "productCode", e.target.value)}
                className={`${inputClass} w-24 min-w-0 grow-[1] basis-24`}
              />
              <input
                type="text"
                name="itemProductName"
                placeholder="Ürün"
                value={row.productName}
                onChange={(e) => updateRow(row.key, "productName", e.target.value)}
                className={`${inputClass} min-w-[140px] grow-[3] basis-40`}
              />
              <input
                type="number"
                name="itemQuantity"
                placeholder="Adet"
                step="0.01"
                min="0"
                value={row.quantity}
                onChange={(e) => updateRow(row.key, "quantity", e.target.value)}
                className={`${inputClass} w-20 min-w-0 grow-[1] basis-20`}
              />
              <input
                type="number"
                name="itemUnitPrice"
                placeholder="Birim Fiyat"
                step="0.01"
                min="0"
                value={row.unitPrice}
                onChange={(e) => updateRow(row.key, "unitPrice", e.target.value)}
                className={`${inputClass} w-28 min-w-0 grow-[1] basis-28`}
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="shrink-0 rounded-lg border border-card-border px-3 py-2 text-sm text-muted hover:bg-background"
              >
                Sil
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            className="w-fit rounded-lg border border-card-border px-3 py-1.5 text-xs hover:bg-background"
          >
            + Satır Ekle
          </button>
          {itemsSubtotal > 0 && (
            <p className="text-xs text-muted">Kalemler Toplamı: {itemsSubtotal.toLocaleString("tr-TR")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Tutar</label>
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0"
            required
            defaultValue={latestVersion?.amount}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Para Birimi</label>
          <select name="currency" defaultValue={latestVersion?.currency ?? "TRY"} className={inputClass}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Geçerlilik Tarihi</label>
          <input
            type="date"
            name="validUntil"
            defaultValue={toDateInputValue(latestVersion?.validUntil ?? null)}
            className={inputClass}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            id="vatIncluded"
            name="vatIncluded"
            defaultChecked={latestVersion?.vatIncluded ?? false}
            className="h-4 w-4"
          />
          <label htmlFor="vatIncluded" className="text-sm text-foreground">
            KDV dahil
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Ödeme Şekli</label>
          <input
            type="text"
            name="paymentMethod"
            placeholder="Örn. Nakit, Kredi Kartı, Taksitli"
            defaultValue={latestVersion?.paymentMethod ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Nakliye</label>
          <input
            type="text"
            name="shippingTerms"
            placeholder="Örn. Dahil, Hariç"
            defaultValue={latestVersion?.shippingTerms ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-foreground">Kapsam Özeti</label>
          <textarea
            name="scopeSummary"
            rows={2}
            defaultValue={latestVersion?.scopeSummary ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : isRevision ? "Revizyonu Gönder" : "Teklifi Gönder"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-fit rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background"
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
