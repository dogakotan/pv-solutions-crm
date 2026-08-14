"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";

export type DuplicateLeadMatch = {
  id: string;
  leadNo: string;
  customerName: string;
  stage: string;
};

export type NewLeadState = {
  error?: string;
  duplicates?: DuplicateLeadMatch[];
};

const newLeadSchema = z.object({
  customerType: z.enum(["individual", "company"]),
  customerName: z.string().trim().min(2, "Müşteri adı en az 2 karakter olmalıdır.").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]{7,20}$/, "Telefon numarası geçersiz."),
  city: z.string().trim().min(2, "Şehir en az 2 karakter olmalıdır.").max(100),
  source: z.string().trim().min(2, "Kaynak en az 2 karakter olmalıdır.").max(200),
  idempotencyKey: z.string().trim().uuid().optional(),
});

const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function createLead(
  _prevState: NewLeadState,
  formData: FormData
): Promise<NewLeadState> {
  const parsed = newLeadSchema.safeParse({
    customerType: String(formData.get("customerType") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    city: String(formData.get("city") ?? ""),
    source: String(formData.get("source") ?? ""),
    idempotencyKey: String(formData.get("idempotencyKey") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girilen bilgiler geçersiz." };
  }

  const { customerType, customerName, phone, city, source, idempotencyKey } = parsed.data;
  const confirmDuplicate = formData.get("confirmDuplicate") === "true";

  const userId = await getVerifiedUserId();

  if (!userId) {
    return { error: "Oturum bulunamadı." };
  }

  const supabase = await createClient();

  if (!confirmDuplicate) {
    const { data: matches, error: dupError } = await supabase.rpc("find_duplicate_leads_by_phone", {
      p_phone: phone,
    });

    if (dupError) {
      return { error: "Tekrar kontrolü yapılamadı: " + dupError.message };
    }

    if (matches && matches.length > 0) {
      return {
        duplicates: matches.map((m) => ({
          id: m.id,
          leadNo: m.lead_no ?? "",
          customerName: m.customer_name,
          stage: m.stage,
        })),
      };
    }
  }

  /**
   * Bu isteğin ağ seviyesinde tekrarlanması (çift tıklama değil — o
   * client'ta disabled={pending} ile zaten engelleniyor) durumunda
   * aynı lead'in iki kez oluşmasını önler: anahtar zaten kullanılmışsa
   * bu isteğin bir tekrarı olduğunu varsayıp işlemi tekrarlamadan
   * doğrudan başarı sonucuna yönlendiriyoruz. Bilerek insert'ten hemen
   * önce tüketiliyor — duplicate-check aşamasında tüketilse, "yine de
   * oluştur" ile aynı token'la yapılan asıl gönderim yanlışlıkla
   * tekrar sayılıp lead hiç oluşturulmadan başarılı görünürdü.
   */
  if (idempotencyKey) {
    const { error: keyError } = await supabase.from("idempotency_keys").insert({ key: idempotencyKey });
    if (keyError) {
      if (keyError.code === POSTGRES_UNIQUE_VIOLATION) {
        redirect("/first-call/lead-pool");
      }
      // Anahtar tablosuna yazılamaması işlemi engellemez — bu yalnızca
      // ek bir koruma katmanı, ana akışın güvenilirliği ona bağlı değil.
    }
  }

  const { error } = await supabase.from("leads").insert({
    customer_type: customerType,
    customer_name: customerName,
    phone,
    city,
    source,
    owner_id: userId,
    created_by: userId,
    first_call_user_id: userId,
  });

  if (error) {
    // Anahtar tüketildi ama lead oluşmadı — kullanıcı tekrar denediğinde
    // (aynı form, aynı token) gerçek bir tekrar denemesi olarak işlensin
    // diye anahtarı geri alıyoruz; aksi halde bir sonraki deneme "zaten
    // işlendi" sayılıp lead hiç oluşturulmadan başarılı görünürdü.
    if (idempotencyKey) {
      await supabase.rpc("release_idempotency_key", { p_key: idempotencyKey });
    }
    return { error: "Lead oluşturulamadı: " + error.message };
  }

  redirect("/first-call/lead-pool");
}
