"use client";

import { useActionState } from "react";
import { qualifyLead, type QualifyLeadState } from "./actions";
import type { LeadDetail } from "@/lib/data/leads";
import {
  inputClass,
  SCORE_OPTIONS,
  COMPETITOR_OPTIONS,
  InterestField,
} from "@/components/lead-qualification-fields";

const initialState: QualifyLeadState = {};

export function QualificationForm({ lead }: { lead: LeadDetail }) {
  const [state, formAction, pending] = useActionState(qualifyLead, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="leadId" value={lead.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Durum (Puan)</label>
          <select name="leadScore" defaultValue={lead.leadScore ?? ""} className={inputClass}>
            {SCORE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Bina Tipi</label>
          <input
            name="buildingType"
            defaultValue={lead.buildingType ?? ""}
            placeholder="Müstakil, apartman, işyeri..."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Semt / İlçe</label>
          <input name="district" defaultValue={lead.district ?? ""} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Açık Adres</label>
          <input name="address" defaultValue={lead.address ?? ""} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Alternatif Telefon</label>
          <input name="alternatePhone" defaultValue={lead.alternatePhone ?? ""} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">E-posta</label>
          <input type="email" name="email" defaultValue={lead.email ?? ""} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Çatı Alanı (m²)</label>
          <input
            type="number"
            step="0.01"
            name="roofAreaM2"
            defaultValue={lead.roofAreaM2 ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Tahmini Kapasite (kWp)</label>
          <input
            type="number"
            step="0.01"
            name="estimatedCapacityKwp"
            defaultValue={lead.estimatedCapacityKwp ?? ""}
            className={inputClass}
          />
        </div>

        <InterestField name="heatPumpInterest" label="Isı Pompası İlgisi" defaultValue={lead.heatPumpInterest} />
        <InterestField name="poolInterest" label="Havuz İlgisi" defaultValue={lead.poolInterest} />
        <InterestField name="evInterest" label="Elektrikli Araç İlgisi" defaultValue={lead.evInterest} />
        <InterestField name="batteryInterest" label="Batarya İlgisi" defaultValue={lead.batteryInterest} />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Rakip Teklifi</label>
          <select
            name="competitorOfferStatus"
            defaultValue={lead.competitorOfferStatus ?? ""}
            className={inputClass}
          >
            {COMPETITOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Rakip Teklifi Notu</label>
          <input
            name="competitorOfferNote"
            defaultValue={lead.competitorOfferNote ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-foreground">Genel Not</label>
          <textarea
            name="generalNotes"
            rows={3}
            defaultValue={lead.generalNotes ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Kaydediliyor..." : "Görüşme Sonucunu Kaydet"}
      </button>
    </form>
  );
}
