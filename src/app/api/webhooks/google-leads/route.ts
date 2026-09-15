import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const webhookKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;

  if (!webhookKey) {
    console.error("GOOGLE_ADS_WEBHOOK_KEY tanımlı değil");
    return NextResponse.json({ message: "Not configured" }, { status: 500 });
  }

  let payload: GoogleLeadWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  if (!payload.google_key || !keysMatch(payload.google_key, webhookKey)) {
    return NextResponse.json({ message: "Invalid key" }, { status: 401 });
  }

  // "Send test data" doğrulama isteği — gerçek bir lead değil, havuzu
  // kirletmemek için oluşturmadan başarıyla yanıtlıyoruz.
  if (payload.is_test) {
    return NextResponse.json({});
  }

  if (!payload.lead_id) {
    return NextResponse.json({ message: "Missing lead_id" }, { status: 400 });
  }

  const columns = payload.user_column_data ?? [];
  const customerName = columnValue(columns, "FULL_NAME") ?? "İsimsiz (Google Ads Lead Form)";
  const phone = columnValue(columns, "PHONE_NUMBER") ?? "";
  const city = columnValue(columns, "CITY") ?? "";

  const admin = createAdminClient();
  const { error } = await admin.rpc("create_lead_from_webhook", {
    p_customer_name: customerName,
    p_phone: phone,
    p_city: city,
    p_source: "Google Ads Lead Form",
    p_external_ref: payload.lead_id,
  });

  if (error) {
    console.error("create_lead_from_webhook başarısız, lead_id=", payload.lead_id, error);
    await admin.rpc("notify_admins_webhook_lead_failure", {
      p_source: "Google Ads Lead Form",
      p_external_ref: payload.lead_id,
      p_error_message: error.message,
    });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({});
}
