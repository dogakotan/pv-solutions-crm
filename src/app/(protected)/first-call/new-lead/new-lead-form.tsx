"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createLead, type NewLeadState } from "./actions";
import { LeadStageBadge } from "@/components/lead-badges";
import type { LeadStage } from "@/types/lead";
import {
  inputClass,
  SCORE_OPTIONS,
  COMPETITOR_OPTIONS,
  InterestField,
} from "@/components/lead-qualification-fields";

const initialState: NewLeadState = {};

const SOURCE_OPTIONS = [
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta / Instagram Reklamı" },
  { value: "web_form", label: "Web Formu" },
  { value: "referral", label: "Referans" },
  { value: "inbound_call", label: "Gelen Çağrı" },
  { value: "other", label: "Diğer" },
];

export function NewLeadForm() {
  const [state, formAction, pending] = useActionState(createLead, initialState);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [sourceOption, setSourceOption] = useState("");
  const [sourceOther, setSourceOther] = useState("");
  const [showQualification, setShowQualification] = useState(false);

  function handleConfirmAnyway() {
    setConfirmDuplicate(true);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="confirmDuplicate" value={confirmDuplicate ? "true" : "false"} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Kaynak</label>
          <select
            value={sourceOption}
            onChange={(e) => setSourceOption(e.target.value)}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Seçiniz
            </option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {sourceOption === "other" && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Kaynak (belirtin)</label>
            <input
              value={sourceOther}
              onChange={(e) => setSourceOther(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        )}
        <input
          type="hidden"
          name="source"
          value={
            sourceOption === "other"
              ? sourceOther
              : (SOURCE_OPTIONS.find((o) => o.value === sourceOption)?.label ?? "")
          }
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Görüşme Detayları (opsiyonel)</p>
          <button
            type="button"
            onClick={() => setShowQualification((v) => !v)}
            className="text-xs font-medium text-brand hover:underline"
          >
            {showQualification ? "Gizle" : "Nitelendirme Ekle"}
          </button>
        </div>
        {!showQualification && (
          <p className="text-xs text-muted">
            Hızlı kayıt için bu bölümü atlayabilirsiniz — lead oluşturulduktan sonra lead detay
            sayfasından da nitelendirebilirsiniz.
          </p>
        )}
        <div
          className={
            showQualification
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "hidden"
          }
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Durum (Puan)</label>
            <select name="leadScore" defaultValue="" className={inputClass}>
              {SCORE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Bina Tipi</label>
            <input name="buildingType" placeholder="Müstakil, apartman, işyeri..." className={inputClass} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Semt / İlçe</label>
            <input name="district" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Açık Adres</label>
            <input name="address" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Alternatif Telefon</label>
            <input name="alternatePhone" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">E-posta</label>
            <input type="email" name="email" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Çatı Alanı (m²)</label>
            <input type="number" step="0.01" name="roofAreaM2" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Tahmini Kapasite (kWp)</label>
            <input type="number" step="0.01" name="estimatedCapacityKwp" className={inputClass} />
          </div>

          <InterestField name="heatPumpInterest" label="Isı Pompası İlgisi" />
          <InterestField name="poolInterest" label="Havuz İlgisi" />
          <InterestField name="evInterest" label="Elektrikli Araç İlgisi" />
          <InterestField name="batteryInterest" label="Batarya İlgisi" />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Rakip Teklifi</label>
            <select name="competitorOfferStatus" defaultValue="" className={inputClass}>
              {COMPETITOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Rakip Teklifi Notu</label>
            <input name="competitorOfferNote" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-sm font-medium text-foreground">Genel Not</label>
            <textarea name="generalNotes" rows={3} className={inputClass} />
          </div>
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
