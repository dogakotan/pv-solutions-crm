/**
 * `next`/`redirect_to` gibi kullanıcı girdisinden gelen hedefleri yalnızca
 * aynı origin'deki göreli yollarla sınırlar (open redirect önleme).
 * `//evil.com` gibi protocol-relative girdiler de reddedilir.
 */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
