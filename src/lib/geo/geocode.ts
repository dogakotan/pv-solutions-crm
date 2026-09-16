import "server-only";

type GeocodeResult = { lat: number; lon: number };

/**
 * OpenStreetMap Nominatim — ücretsiz, API key gerektirmez.
 * Serbest metin aramasında Türkçe "No:12" gibi bina numaralarını
 * tutarsız çözümlüyor (bazen bulur, bazen bulmaz — kamuya açık
 * instance'ın rate limit/parser sınırlaması). Bu yüzden en detaylı
 * sorgudan başlayıp bulunamazsa daha kaba bir sorguya (şehir seviyesi)
 * düşüyoruz; hiç bulunamazsa null dönüyoruz.
 */
async function tryGeocode(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "PVSolutionsCRM/1.0 (ic kullanim - partner konum gosterimi)",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) return null;

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = results[0];
  if (!first) return null;

  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

/**
 * `queries` en detaylıdan en kabaya doğru sıralı denenir
 * (örn. ["Mahalle, Cadde No:X, İlçe, Şehir, Türkiye", "Şehir, Türkiye"]).
 */
export async function geocodeAddress(queries: string[]): Promise<GeocodeResult | null> {
  for (const query of queries) {
    if (!query.trim()) continue;

    try {
      const result = await tryGeocode(query);
      if (result) return result;
    } catch {
      // bu sorgu başarısız oldu, sıradaki (daha kaba) sorguya geç
    }
  }

  return null;
}
