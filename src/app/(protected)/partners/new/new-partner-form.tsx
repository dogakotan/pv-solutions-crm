"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { createPartner, type CreatePartnerState } from "./actions";
import { APPLICATION_AREAS } from "@/types/partner";
import type { ActiveUserOption } from "@/lib/data/assignments";

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

const initialState: CreatePartnerState = {};

export function NewPartnerForm({ pvOwners }: { pvOwners: ActiveUserOption[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createPartner, initialState);
  const [showUploadNotice, setShowUploadNotice] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  function toggleArea(area: string) {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Firma adı</label>
          <input name="name" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Kısa kod</label>
          <input name="partnerCode" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Telefon</label>
          <input name="phone" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Vergi numarası</label>
          <input name="taxNumber" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Bağlı olduğu vergi dairesi</label>
          <input name="taxOffice" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">E-posta</label>
          <input name="email" type="email" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Şehir</label>
          <input name="city" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className="text-sm font-medium text-foreground">Açık adres</label>
          <input name="address" className={inputClass} placeholder="Mahalle, cadde/sokak, no, ilçe" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Hizmet bölgeleri</label>
          <input name="serviceRegions" placeholder="virgülle ayırın" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Yetkinlikler</label>
          <input name="capabilities" placeholder="virgülle ayırın" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">PV sorumlusu</label>
          <select name="pvOwnerId" defaultValue="" className={inputClass}>
            <option value="">Seçilmedi</option>
            {pvOwners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Durum</label>
          <select name="status" className={inputClass} defaultValue="candidate">
            <option value="candidate">Aday</option>
            <option value="active">Aktif</option>
            <option value="suspended">Askıda</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Vergi levhası</label>
        <button
          type="button"
          onClick={() => setShowUploadNotice(true)}
          className="flex w-fit items-center gap-2 rounded-lg border border-dashed border-card-border px-4 py-2 text-sm text-muted hover:border-brand hover:text-brand"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          Dosya yükle
        </button>
        {showUploadNotice && (
          <p className="text-xs text-amber-700">
            Dosya yükleme özelliği ilerleyen bir fazda (Faz 2 sonrası) eklenecek.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          Uygulama alanı <span className="font-normal text-muted">(birden fazla seçilebilir)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {APPLICATION_AREAS.map((area) => {
            const isSelected = selectedAreas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? "rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white"
                    : "rounded-full border border-card-border px-4 py-1.5 text-sm text-muted hover:border-brand hover:text-brand"
                }
              >
                {area}
              </button>
            );
          })}
        </div>
        {selectedAreas.map((area) => (
          <input key={area} type="hidden" name="applicationAreas" value={area} />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">İç not (yalnız PV görür)</label>
        <textarea name="internalNotes" rows={3} className={inputClass} />
      </div>

      <p className="rounded-lg bg-brand-light px-3 py-2 text-xs text-brand-dark">
        Partner kaydedildikten sonra çalışan hesaplarını partner detay sayfasındaki
        &quot;Çalışanlar&quot; sekmesinden ekleyebilirsiniz.
      </p>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/partners")}
          className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background"
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
