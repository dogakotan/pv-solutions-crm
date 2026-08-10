import { geocodeAddress } from "@/lib/geo/geocode";

export async function PartnerMap({ queries }: { queries: string[] }) {
  const location = await geocodeAddress(queries);

  if (!location) {
    return (
      <p className="text-sm text-muted">
        Adres haritada bulunamadı. Açık adresi kontrol edin.
      </p>
    );
  }

  const { lat, lon } = location;
  const delta = 0.01;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lon}&layer=mapnik`;

  return (
    <div className="overflow-hidden rounded-lg border border-card-border">
      <iframe title="Partner konumu" src={src} className="h-64 w-full" loading="lazy" />
    </div>
  );
}
