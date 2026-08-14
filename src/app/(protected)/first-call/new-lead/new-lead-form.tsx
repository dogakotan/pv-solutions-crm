"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createLead, type NewLeadState } from "./actions";
import { LeadStageBadge } from "@/components/lead-badges";
import type { LeadStage } from "@/types/lead";

const initialState: NewLeadState = {};

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function NewLeadForm() {
  const [state, formAction, pending] = useActionState(createLead, initialState);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function handleConfirmAnyway() {
    setConfirmDuplicate(true);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="confirmDuplicate" value={confirmDuplicate ? "true" : "false"} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Müşteri tipi</label>
          <select name="customerType" defaultValue="individual" className={inputClass}>
            <option value="individual">Bireysel</option>
            <option value="company">Kurumsal</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Müşteri adı</label>
          <input name="customerName" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Telefon</label>
          <input
            name="phone"
            required
            className={inputClass}
            onChange={() => setConfirmDuplicate(false)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Şehir</label>
          <input name="city" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-foreground">Kaynak</label>
          <input name="source" required placeholder="Web formu, referans, reklam..." className={inputClass} />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.duplicates && state.duplicates.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">
            Bu telefon numarasıyla zaten kayıtlı {state.duplicates.length} lead bulundu:
          </p>
          <div className="flex flex-col gap-2">
            {state.duplicates.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-3 py-2">
                <div>
                  <Link href={`/leads/${d.id}`} target="_blank" className="font-medium text-brand hover:underline">
                    {d.leadNo}
                  </Link>
                  <span className="ml-2 text-amber-900">{d.customerName}</span>
                </div>
                <LeadStageBadge stage={d.stage as LeadStage} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleConfirmAnyway}
            disabled={pending}
            className="w-fit rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Yine de yeni lead oluştur
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Lead Oluştur"}
      </button>
    </form>
  );
}
