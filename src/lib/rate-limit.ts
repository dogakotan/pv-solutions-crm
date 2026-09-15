import "server-only";

/**
 * Basit, bellek içi sabit-pencere hız sınırlayıcı — public/unauthenticated
 * route'lar (webhook'lar) için (yol haritası 5.5). Uygulama tek bir Node
 * sürecinde çalıştığı sürece (bkz. AGENTS.md — next start, çoklu instance
 * yok) doğru çalışır; yatay ölçeklenme durumunda paylaşımlı bir store'a
 * (örn. Redis) taşınması gerekir.
 *
 * Next.js'in Backend for Frontend rehberindeki checkRateLimit(request)
 * deseniyle aynı imza (node_modules/next/dist/docs/01-app/02-guides/
 * backend-for-frontend.md#rate-limiting).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function checkRateLimit(
  request: Request,
  options: { limit: number; windowMs: number; key: string }
): Promise<{ rateLimited: boolean }> {
  const { limit, windowMs, key: routeKey } = options;
  const now = Date.now();
  const key = `${routeKey}:${getClientIp(request)}`;

  // Fırsatçı temizlik — süresi dolmuş kovaları haritadan atarak süresiz
  // büyümeyi önler (ayrı bir zamanlayıcı süreci gerektirmez).
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { rateLimited: false };
  }

  bucket.count += 1;
  return { rateLimited: bucket.count > limit };
}
