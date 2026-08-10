"use client";

import { useActionState, useState } from "react";
import { createPartnerEmployee, type CreateEmployeeState } from "./employees-actions";

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

const initialState: CreateEmployeeState = {};

export function AddEmployeeForm({ partnerId }: { partnerId: string }) {
  const createWithPartner = createPartnerEmployee.bind(null, partnerId);
  const [state, formAction, pending] = useActionState(createWithPartner, initialState);
  const [open, setOpen] = useState(false);

  if (state.tempPassword) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-medium">Hesap oluşturuldu: {state.createdEmail}</p>
        <p className="mt-1">
          Geçici şifre: <span className="font-mono font-semibold">{state.tempPassword}</span>
        </p>
        <p className="mt-1 text-xs text-green-700">
          Bu şifre bir daha gösterilmeyecek — çalışana iletin, ilk girişte değiştirmesini isteyin.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-sm hover:bg-background"
      >
        + Çalışan Ekle
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-card-border p-4">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Ad Soyad</label>
          <input name="fullName" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">E-posta</label>
          <input name="email" type="email" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Telefon</label>
          <input name="phone" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Rol</label>
          <select name="role" defaultValue="partner_employee" className={inputClass}>
            <option value="partner_admin">Partner Yönetici</option>
            <option value="partner_employee">Partner Çalışanı</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Oluşturuluyor..." : "Hesap Oluştur"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-card-border px-3 py-1.5 text-sm hover:bg-background"
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
