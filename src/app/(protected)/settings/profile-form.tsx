"use client";

import { useActionState } from "react";
import { updateProfile, type UpdateProfileState } from "./actions";

const initialState: UpdateProfileState = {};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function ProfileForm({
  email,
  fullName,
  phone,
}: {
  email: string;
  fullName: string;
  phone: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-email" className="text-sm font-medium text-foreground">E-posta</label>
        <input id="profile-email" value={email} disabled className={`${inputClass} bg-background text-muted`} />
        <p className="text-xs text-muted">E-posta değişikliği desteklenmiyor.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="profile-fullName" className="text-sm font-medium text-foreground">Ad Soyad</label>
        <input id="profile-fullName" name="fullName" defaultValue={fullName} required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="profile-phone" className="text-sm font-medium text-foreground">Telefon</label>
        <input id="profile-phone" name="phone" defaultValue={phone} className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Profil güncellendi.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
