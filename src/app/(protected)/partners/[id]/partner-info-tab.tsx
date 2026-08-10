import { Suspense } from "react";
import type { Partner } from "@/types/partner";
import { PartnerMap } from "./partner-map";

function PartnerMapSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-lg border border-card-border bg-card" />;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PartnerInfoTab({ partner }: { partner: Partner }) {
  const detailedQuery = [partner.address, partner.city, "Türkiye"].filter(Boolean).join(", ");
  const cityQuery = [partner.city, "Türkiye"].filter(Boolean).join(", ");
  const mapQueries = [detailedQuery, cityQuery];

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Firma Kodu" value={partner.partnerCode} />
        <Field label="Vergi Numarası" value={partner.taxNumber ?? "—"} />
        <Field label="Vergi Dairesi" value={partner.taxOffice ?? "—"} />
        <Field label="Telefon" value={partner.phone} />
        <Field label="E-posta" value={partner.email} />
        <Field label="Şehir" value={partner.city} />
        <Field label="Açık Adres" value={partner.address ?? "—"} />
        <Field label="Hizmet Bölgeleri" value={partner.serviceRegions.join(", ")} />
        <Field label="Yetkinlikler" value={partner.capabilities.join(", ")} />
        <Field label="Uygulama Alanı" value={partner.applicationAreas.join(", ") || "—"} />
        <Field label="PV Sorumlusu" value={partner.pvOwnerName} />
        <Field label="Oluşturulma Tarihi" value={partner.createdAt} />
      </dl>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">Konum</h3>
        <Suspense fallback={<PartnerMapSkeleton />}>
          <PartnerMap queries={mapQueries} />
        </Suspense>
        <p className="text-xs text-muted">
          Açık adresten OpenStreetMap (Nominatim) ile otomatik konumlandırılır — ücretsiz, API
          anahtarı gerektirmez.
        </p>
      </div>
    </div>
  );
}
