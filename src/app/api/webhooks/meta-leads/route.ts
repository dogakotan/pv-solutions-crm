import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger, correlationIdFromRequest } from "@/lib/logger";

/**
 * Meta Lead Ads webhook — reklam formundan gelen leadleri otomatik
 * create_lead_from_webhook RPC'si üzerinden oluşturur (bkz. o RPC'nin
 * migration dosyasındaki not: auth.uid() gerektiren normal create_lead
 * yerine, service_role'e özel bu yol kullanılıyor çünkü webhook'un
 * gerçek bir kullanıcı oturumu yok).
 *
 * META_WEBHOOK_VERIFY_TOKEN / META_WEBHOOK_APP_SECRET / META_PAGE_ACCESS_TOKEN
 * tanımlı değilken bu route sadece hata döner — gerçek Meta kimlik
 * bilgileri bağlanmadan hiçbir gerçek trafik almaz, zararsızdır.
 */

const META_GRAPH_VERSION = "v21.0";

export async function GET(request: Request) {
  const { rateLimited } = await checkRateLimit(request, {
    key: "meta-leads-webhook-get",
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

type MetaLeadgenChange = {
  field: string;
  value?: { leadgen_id?: string; [key: string]: unknown };
};

type MetaWebhookPayload = {
  entry?: { changes?: MetaLeadgenChange[] }[];
};

type MetaFieldDatum = { name: string; values: string[] };

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function fieldValue(fields: MetaFieldDatum[], name: string): string | undefined {
  return fields.find((f) => f.name === name)?.values?.[0];
}

async function fetchLeadFieldData(leadgenId: string, pageAccessToken: string): Promise<MetaFieldDatum[]> {
  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?fields=field_data&access_token=${pageAccessToken}`
  );
  if (!res.ok) {
    throw new Error(`Graph API hatası (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return (data.field_data ?? []) as MetaFieldDatum[];
}

export async function POST(request: Request) {
  const { rateLimited } = await checkRateLimit(request, {
    key: "meta-leads-webhook-post",
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const logger = createLogger(correlationIdFromRequest(request));
  const appSecret = process.env.META_WEBHOOK_APP_SECRET;
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!appSecret || !pageAccessToken) {
    logger.error("META_WEBHOOK_APP_SECRET veya META_PAGE_ACCESS_TOKEN tanımlı değil");
    return new NextResponse("Not configured", { status: 500, headers: { "x-correlation-id": logger.correlationId } });
  }

  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    logger.warn("Geçersiz imza");
    return new NextResponse("Invalid signature", { status: 401, headers: { "x-correlation-id": logger.correlationId } });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logger.warn("Geçersiz JSON payload");
    return new NextResponse("Invalid payload", { status: 400, headers: { "x-correlation-id": logger.correlationId } });
  }

  const leadgenChanges = (payload.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .filter(
      (change): change is MetaLeadgenChange & { value: { leadgen_id: string } } =>
        change.field === "leadgen" && Boolean(change.value?.leadgen_id)
    );

  logger.info("Meta webhook alındı", { leadgenCount: leadgenChanges.length });
  const admin = createAdminClient();

  for (const change of leadgenChanges) {
    const leadgenId = change.value.leadgen_id;
    try {
      const fields = await fetchLeadFieldData(leadgenId, pageAccessToken);
      const customerName = fieldValue(fields, "full_name") ?? "İsimsiz (Meta Lead Ads)";
      const phone = fieldValue(fields, "phone_number") ?? "";
      const city = fieldValue(fields, "city") ?? "";

      const { error } = await admin.rpc("create_lead_from_webhook", {
        p_customer_name: customerName,
        p_phone: phone,
        p_city: city,
        p_source: "Meta Lead Ads",
        p_external_ref: leadgenId,
        p_raw_payload: { ...change.value, field_data: fields },
      });

      if (error) {
        logger.error("create_lead_from_webhook başarısız", { leadgenId, error: error.message });
        await admin.rpc("notify_admins_webhook_lead_failure", {
          p_source: "Meta Lead Ads",
          p_external_ref: leadgenId,
          p_error_message: error.message,
        });
      } else {
        logger.info("Meta lead işlendi", { leadgenId });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("Meta lead işlenemedi", { leadgenId, error: errorMessage });
      await admin.rpc("notify_admins_webhook_lead_failure", {
        p_source: "Meta Lead Ads",
        p_external_ref: leadgenId,
        p_error_message: errorMessage,
      });
    }
  }

  // Meta başarısız (non-2xx) yanıtları tekrar dener — kalıcı hatalarda
  // (örn. o leadgen_id için Graph API kalıcı olarak başarısız oluyorsa)
  // sonsuz retry istemiyoruz, bu yüzden hata durumunda bile 200 dönüyoruz;
  // asıl hata (correlationId ile) sunucu loguna yazılıyor.
  return new NextResponse("OK", { status: 200, headers: { "x-correlation-id": logger.correlationId } });
}
