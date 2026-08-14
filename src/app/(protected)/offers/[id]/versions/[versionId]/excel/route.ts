import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/current-user";
import { getOfferVersionForExport } from "@/lib/data/offers";
import { buildOfferWorkbook } from "@/lib/excel/offer-workbook";

/**
 * Yetkilendirme: burada ekstra bir rol kontrolüne gerek yok — RLS zaten
 * offer_versions/offer_version_items'ın görünürlüğünü offers_select
 * politikası üzerinden sınırlıyor (bkz. getOfferVersionForExport), bu
 * route yalnızca zaten görebileceği bir revizyonu Excel'e çeviriyor.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const { versionId } = await params;
  const supabase = await createClient();
  const offerVersion = await getOfferVersionForExport(supabase, versionId);

  if (!offerVersion) {
    return NextResponse.json({ error: "Teklif revizyonu bulunamadı." }, { status: 404 });
  }

  const workbook = await buildOfferWorkbook(offerVersion);
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${offerVersion.offerNo}-Rev${offerVersion.revisionNo}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
