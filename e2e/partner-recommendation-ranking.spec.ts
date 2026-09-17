import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { loginAs } from "./helpers/auth";
import { createTestReferral, deleteLead, deletePartner, findUserIdByEmail, hasCleanupCredentials } from "./helpers/cleanup";
import { getCredentials } from "./helpers/credentials";

const { email: TEST_EMAIL, password: TEST_PASSWORD } = getCredentials("admin");

function adminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function insertHistoryLead(admin: ReturnType<typeof adminClient>, ownerId: string, label: string) {
  const { data, error } = await admin
    .from("leads")
    .insert({
      customer_type: "individual",
      customer_name: label,
      phone: `05${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`,
      city: "İstanbul",
      source: "e2e-test",
      owner_id: ownerId,
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// Beşinci tur, önceden bilinçli atlanmış madde: get_recommended_partners_for_lead
// sadece partners.rating'e (manuel puan) göre sıralıyordu, gerçek yönlendirme
// geçmişine hiç bakmıyordu. Bu test, hiç yönlendirme geçmişi olmayan ama
// manuel puanı daha yüksek bir partnerin, kanıtlanmış performansı (yüksek
// kabul oranı + hızlı yanıt) olan ama manuel puanı çok daha düşük bir
// partnerin ARKASINDA sıralandığını doğrular — eski davranışta tam tersi olurdu.
test.describe("Partner önerisi artık gerçek performansa göre sıralanıyor", () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD || !hasCleanupCredentials(), "E2E_TEST_EMAIL/PASSWORD veya SUPABASE_SERVICE_ROLE_KEY tanımlı değil");

  test("geçmişsiz manuel puanı yüksek partner, kanıtlanmış performansı yüksek düşük puanlı partnerin gerisinde önerilir", async ({
    page,
  }) => {
    const adminId = await findUserIdByEmail(TEST_EMAIL!);
    expect(adminId).not.toBeNull();

    const ts = Date.now();
    const testCity = `RecRankCity${ts}`;
    const admin = adminClient();

    const { data: highManualPartner, error: highErr } = await admin
      .from("partners")
      .insert({ name: `E2E RecRank Manuel-Yüksek ${ts}`, city: testCity, status: "active", rating: 3.0 })
      .select("id")
      .single();
    if (highErr) throw highErr;

    const { data: lowManualPartner, error: lowErr } = await admin
      .from("partners")
      .insert({ name: `E2E RecRank Performans-Yüksek ${ts}`, city: testCity, status: "active", rating: 1.0 })
      .select("id")
      .single();
    if (lowErr) throw lowErr;

    // "Performans-Yüksek" partner için: iki ayrı lead üzerinden, ikisi de
    // kabul edilmiş ve anında yanıtlanmış bir yönlendirme geçmişi kur
    // (%100 kabul oranı + ~0 saat yanıt süresi).
    const historyLeadIds = [
      await insertHistoryLead(admin, adminId!, `E2E RecRank History A ${ts}`),
      await insertHistoryLead(admin, adminId!, `E2E RecRank History B ${ts}`),
    ];
    for (const leadId of historyLeadIds) {
      const referralId = await createTestReferral({ leadId, partnerId: lowManualPartner.id, referredBy: adminId! });
      const { error: updateReferralErr } = await admin
        .from("partner_referrals")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", referralId);
      if (updateReferralErr) throw updateReferralErr;
    }

    // Test edilecek asıl lead — iki test partnerinin de şehrine düşüyor,
    // hiçbir aktif referral'ı yok.
    const subjectLeadId = await insertHistoryLead(admin, adminId!, `E2E RecRank Subject ${ts}`);
    await admin.from("leads").update({ city: testCity }).eq("id", subjectLeadId);

    try {
      await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
      await page.goto(`/leads/${subjectLeadId}`);

      await expect(page.getByText("Partner Ataması")).toBeVisible();
      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(2, { timeout: 10_000 });

      const rowTexts = await rows.allTextContents();
      const highIndex = rowTexts.findIndex((t) => t.includes("Manuel-Yüksek"));
      const lowIndex = rowTexts.findIndex((t) => t.includes("Performans-Yüksek"));
      expect(highIndex).toBeGreaterThanOrEqual(0);
      expect(lowIndex).toBeGreaterThanOrEqual(0);

      // Eski davranışta (manuel puana göre sıralama) Manuel-Yüksek (3.0) ilk,
      // Performans-Yüksek (1.0) ikinci sırada olurdu — artık tersi doğru.
      expect(lowIndex).toBeLessThan(highIndex);

      // Gösterilen puan artık manuel değil, hesaplanan performans puanı:
      // Performans-Yüksek'in satırında "1,0" değil, daha yüksek bir puan görünmeli.
      expect(rowTexts[lowIndex]).not.toMatch(/1[.,]0\/5/);
    } finally {
      await deleteLead(subjectLeadId);
      for (const leadId of historyLeadIds) {
        await deleteLead(leadId);
      }
      await deletePartner(highManualPartner.id);
      await deletePartner(lowManualPartner.id);
    }
  });
});
