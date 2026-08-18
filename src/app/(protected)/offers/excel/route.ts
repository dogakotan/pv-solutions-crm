import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import { getVisibleOffers } from "@/lib/data/offers";
import { buildOffersListWorkbook } from "@/lib/excel/offers-list-workbook";
import type { OfferStatus } from "@/types/offer";

const VALID_STATUSES: OfferStatus[] = ["open", "accepted", "rejected", "closed"];

/**
 * Yetkilendirme: ekstra bir rol kontrolüne gerek yok — RLS zaten offers'ın
 * görünürlüğünü offers_select politikası üzerinden sınırlıyor (bkz.
 * getVisibleOffers), bu route yalnızca zaten görebileceği teklifleri
 * Excel'e çeviriyor. q/status filtreleri OffersTable'daki client-side
 * filtreyle birebir aynı mantığı server tarafında tekrarlıyor.
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

  const supabase = await createClient();
  const offers = await getVisibleOffers(supabase, 200);

  const filtered = offers.filter((offer) => {
    const matchesStatus = status === null || offer.status === status;
    const matchesQuery =
      query === "" ||
      offer.offerNo.toLowerCase().includes(query) ||
      offer.leadNo.toLowerCase().includes(query) ||
      offer.customerName.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
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
