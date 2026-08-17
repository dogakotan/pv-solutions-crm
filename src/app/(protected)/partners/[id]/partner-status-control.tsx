"use client";

import { useActionState } from "react";
import type { PartnerStatus } from "@/types/partner";
import { PARTNER_STATUS_STYLES, PartnerStatusBadge } from "../partner-status-badge";
import { setPartnerStatus, type SetStatusState } from "./status-actions";

const initialState: SetStatusState = {};

const STATUS_OPTIONS: PartnerStatus[] = ["candidate", "active", "suspended", "inactive"];

export function PartnerStatusControl({
  partnerId,
  status,
}: {
  partnerId: string;
  status: PartnerStatus;
}) {
  const setStatusWithPartner = setPartnerStatus.bind(null, partnerId);
  const [state, formAction, pending] = useActionState(setStatusWithPartner, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <PartnerStatusBadge status={status} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-lg border border-card-border px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {PARTNER_STATUS_STYLES[s].label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background disabled:opacity-50"
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
