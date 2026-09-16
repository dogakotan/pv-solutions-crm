import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import { getOffersOverview } from "@/lib/data/offers";
import { buildOffersListWorkbook } from "@/lib/excel/offers-list-workbook";
import type { OfferStatus } from "@/types/offer";

const VALID_STATUSES: OfferStatus[] = ["open", "accepted", "rejected", "closed"];

/**
 * Yetkilendirme: ekstra bir rol kontrolüne gerek yok — RLS zaten offers'ın
 * görünürlüğünü offers_select politikası üzerinden sınırlıyor, bu route
 * yalnızca zaten görebileceği teklifleri Excel'e çeviriyor.
 *
 * q/status/from/to/amountMin/amountMax filtreleri OffersListFilters'daki
 * client-side filtreyle birebir aynı mantığı server tarafında tekrarlıyor —
 * bu yüzden ekrandaki tabloyla AYNI veri kaynağı (getOffersOverview, 500
 * satır) kullanılıyor. Önceden getVisibleOffers (200 satır, amount/tarih
 * filtresi için gereken alanlar bile yoktu) kullanılıyordu — hem tarih/tutar
 * filtreleri hiç forward edilmiyordu hem de export ekrandakinden daha dar
 * bir kesim üzerinden çalışıyordu.
 */
export async function GET(request: Request) {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const statusParam = searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam as OfferStatus) ? (statusParam as OfferStatus) : null;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const fromDate = fromParam ? new Date(fromParam) : null;
  const toDate = toParam ? new Date(toParam) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);
  const amountMin = searchParams.get("amountMin");
  const amountMax = searchParams.get("amountMax");
  const minAmount = amountMin ? Number(amountMin) : null;
  const maxAmount = amountMax ? Number(amountMax) : null;

  const supabase = await createClient();
  const offers = await getOffersOverview(supabase, 500);

  const filtered = offers.filter((offer) => {
    const matchesStatus = status === null || offer.status === status;
    const matchesQuery =
      query === "" ||
      offer.offerNo.toLowerCase().includes(query) ||
      offer.leadNo.toLowerCase().includes(query) ||
      offer.customerName.toLowerCase().includes(query);
    const createdAt = new Date(offer.createdAt);
    const matchesDateFrom = !fromDate || createdAt >= fromDate;
    const matchesDateTo = !toDate || createdAt <= toDate;
    const matchesAmountMin = minAmount === null || (offer.amount !== null && offer.amount >= minAmount);
    const matchesAmountMax = maxAmount === null || (offer.amount !== null && offer.amount <= maxAmount);
    return matchesStatus && matchesQuery && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
  });

  const workbook = await buildOffersListWorkbook(filtered);
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Teklifler-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
