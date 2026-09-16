/**
 * `next`/`redirect_to` gibi kullanıcı girdisinden gelen hedefleri yalnızca
 * aynı origin'deki göreli yollarla sınırlar (open redirect önleme).
 * `//evil.com` gibi protocol-relative girdiler de reddedilir — tarayıcılar
 * `\` karakterini de `/` gibi yorumladığından (`/\evil.com` → `//evil.com`),
 * ikinci karakter olarak `/` VEYA `\` gelen hiçbir değer kabul edilmiyor.
 */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!/^\/(?!\/|\\)/.test(value)) return fallback;
  return value;
}
