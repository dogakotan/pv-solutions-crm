"use client";

import { useActionState } from "react";
import { setPartnerRating, type SetRatingState } from "./rating-actions";

const initialState: SetRatingState = {};

export function PartnerRatingForm({
  partnerId,
  currentRating,
}: {
  partnerId: string;
  currentRating: number | null;
}) {
  const setRatingWithPartner = setPartnerRating.bind(null, partnerId);
  const [state, formAction, pending] = useActionState(setRatingWithPartner, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="number"
        name="rating"
        min={0}
        max={5}
        step={0.1}
        defaultValue={currentRating ?? ""}
        placeholder="—"
        className="w-20 rounded-lg border border-card-border px-2 py-1 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <span className="text-xs text-muted">/ 5</span>
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
