"use client";

import { useActionState } from "react";

export type ActionFormState = { error?: string };

/**
 * Tek butonlu, gizli alanlı basit onay formları için (aşama ilerlet, partnere
 * ata, yeniden aç vb.) — useActionState kullanıyor çünkü bu action'lar
 * cacheComponents altında production build'de throw yerine dönüş değeriyle
 * hata bildirmesi gerektiği için değiştirildi: sade bir `<form action={fn}>`
 * hata durumunda hiçbir görünür geri bildirim vermiyordu (yalnızca genel
 * error.tsx sınırına düşüyordu), useActionState ile artık satırda görünür.
 */
export function ActionForm({
  action,
  hiddenFields,
  label,
  className,
}: {
  action: (prevState: ActionFormState, formData: FormData) => Promise<ActionFormState>;
  hiddenFields: Record<string, string>;
  label: string;
  className: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
        {label}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
