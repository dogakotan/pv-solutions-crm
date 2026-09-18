import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger, correlationIdFromRequest } from "@/lib/logger";
import type { Json } from "@/types/database.types";

/**
 * Google Ads Lead Form webhook — Meta'nın aksine OAuth/imza gerektirmiyor,
 * Google Ads UI'da form başına tanımlanan tek bir paylaşımlı anahtar
 * (google_key) JSON body içinde düz metin olarak geliyor. Aynı
 * create_lead_from_webhook RPC'si (platform-agnostik, p_source parametreli)
 * Meta route'uyla paylaşılıyor.
 *
 * GOOGLE_ADS_WEBHOOK_KEY tanımlı değilken bu route sadece hata döner —
 * gerçek kimlik bilgisi bağlanmadan hiçbir gerçek trafik almaz, zararsızdır.
 */

type GoogleLeadColumn = {
  column_id?: string;
  column_name?: string;
  string_value?: string;
};

// Dokuzuncu tur inceleme: leads.webhook_raw_payload'a hiçbir üst sınır
// olmadan yazılıyordu — gerçek bir Google Ads Lead Form payload'ı birkaç
// KB'tır, bu yüzden 100 KB üzerindeki istekler baştan reddediliyor
// (Content-Length her zaman güvenilir olmasa da ucuz bir ilk savunma
// katmanı; global proxyClientMaxBodySize varsayılanı 10 MB'ı sessizce
// keserek zaten daha büyük bir tavan sağlıyor).
const MAX_BODY_BYTES = 100_000;

type GoogleLeadWebhookPayload = {
  lead_id?: string;
  google_key?: string;
  is_test?: boolean;
  user_column_data?: GoogleLeadColumn[];
};

function keysMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

function columnValue(columns: GoogleLeadColumn[], columnId: string): string | undefined {
  return columns.find((c) => c.column_id === columnId)?.string_value;
}

export async function POST(request: Request) {
  const { rateLimited } = await checkRateLimit(request, {
    key: "google-leads-webhook-post",
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const logger = createLogger(correlationIdFromRequest(request));
  const webhookKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;

  if (!webhookKey) {
    logger.error("GOOGLE_ADS_WEBHOOK_KEY tanımlı değil");
    return NextResponse.json(
      { message: "Not configured" },
      { status: 500, headers: { "x-correlation-id": logger.correlationId } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    logger.warn("Payload çok büyük", { contentLength });
    return NextResponse.json(
      { message: "Payload too large" },
      { status: 413, headers: { "x-correlation-id": logger.correlationId } }
    );
  }

  let payload: GoogleLeadWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    logger.warn("Geçersiz JSON payload");
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400, headers: { "x-correlation-id": logger.correlationId } }
    );
  }

  if (!payload.google_key || !keysMatch(payload.google_key, webhookKey)) {
    logger.warn("Geçersiz google_key");
    return NextResponse.json(
      { message: "Invalid key" },
      { status: 401, headers: { "x-correlation-id": logger.correlationId } }
    );
  }

  // "Send test data" doğrulama isteği — gerçek bir lead değil, havuzu
  // kirletmemek için oluşturmadan başarıyla yanıtlıyoruz.
  if (payload.is_test) {
    return NextResponse.json({}, { headers: { "x-correlation-id": logger.correlationId } });
  }

  if (!payload.lead_id) {
    logger.warn("lead_id eksik");
    return NextResponse.json(
      { message: "Missing lead_id" },
      { status: 400, headers: { "x-correlation-id": logger.correlationId } }
    );
  }

  const columns = payload.user_column_data ?? [];
  const customerName = columnValue(columns, "FULL_NAME") ?? "İsimsiz (Google Ads Lead Form)";
  const phone = columnValue(columns, "PHONE_NUMBER") ?? "";
  const city = columnValue(columns, "CITY") ?? "";

  // google_key paylaşımlı bir sır olduğundan ham payload'a dahil edilmiyor.
  const rawPayloadSafe: Record<string, unknown> = { ...payload };
  delete rawPayloadSafe.google_key;

  const admin = createAdminClient();
  const { error } = await admin.rpc("create_lead_from_webhook", {
    p_customer_name: customerName,
    p_phone: phone,
    p_city: city,
    p_source: "Google Ads Lead Form",
    p_external_ref: payload.lead_id,
    p_raw_payload: rawPayloadSafe as Json,
  });

  if (error) {
    logger.error("create_lead_from_webhook başarısız", { leadId: payload.lead_id, error: error.message });
    await admin.rpc("notify_admins_webhook_lead_failure", {
      p_source: "Google Ads Lead Form",
      p_external_ref: payload.lead_id,
      p_error_message: error.message,
    });
    return NextResponse.json(
      { message: "Internal error" },
      { status: 500, headers: { "x-correlation-id": logger.correlationId } }
    );
  }

  logger.info("Google Ads lead işlendi", { leadId: payload.lead_id });
  return NextResponse.json({}, { headers: { "x-correlation-id": logger.correlationId } });
}
