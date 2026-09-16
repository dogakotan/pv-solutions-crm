"use client";

import { useActionState } from "react";
import { updateSalesOutcomeFulfillment, type FulfillmentState } from "./actions";
import { MATERIAL_PURCHASE_STATUS_LABELS, type MaterialPurchaseStatus } from "@/types/sales-outcome";

const initialState: FulfillmentState = {};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function SalesOutcomeFulfillmentForm({
  leadId,
  materialPurchaseStatus,
  erpOrderNumber,
}: {
  leadId: string;
  materialPurchaseStatus: MaterialPurchaseStatus | null;
  erpOrderNumber: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateSalesOutcomeFulfillment, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-card-border pt-4">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Malzeme / ERP Takibi</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Malzeme Durumu</label>
          <select name="materialPurchaseStatus" defaultValue={materialPurchaseStatus ?? "pending"} className={inputClass}>
            {Object.entries(MATERIAL_PURCHASE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">ERP Sipariş No (opsiyonel)</label>
          <input name="erpOrderNumber" defaultValue={erpOrderNumber ?? ""} className={inputClass} />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
