"use client";

import { useActionState } from "react";
import { createActivity, type CreateActivityState } from "./actions";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/types/activity";

const initialState: CreateActivityState = {};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];

export function ActivityForm({
  leadId,
  acceptedReferralId,
}: {
  leadId: string;
  acceptedReferralId: string | null;
}) {
  const [state, formAction, pending] = useActionState(createActivity, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="leadId" value={leadId} />
      {acceptedReferralId && <input type="hidden" name="referralId" value={acceptedReferralId} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Tür</label>
          <select name="activityType" defaultValue="call" className={inputClass}>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACTIVITY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Başlık</label>
          <input name="title" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-foreground">Açıklama</label>
          <textarea name="description" rows={2} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Sonraki takip tarihi</label>
          <input type="datetime-local" name="nextFollowUpAt" className={inputClass} />
        </div>
        {acceptedReferralId && (
          <div className="flex items-end gap-2 pb-2">
            <input type="checkbox" id="shareWithPartner" name="shareWithPartner" className="h-4 w-4" />
            <label htmlFor="shareWithPartner" className="text-sm text-foreground">
              Partnerle paylaş
            </label>
          </div>
        )}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Aktivite Ekle"}
      </button>
    </form>
  );
}
