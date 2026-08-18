import ExcelJS from "exceljs";
import type { OfferListItem } from "@/lib/data/offers";
import type { OfferStatus } from "@/types/offer";

const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  open: "Açık",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  closed: "Kapandı",
};

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEFEFEF" } };
const THIN_BORDER = { style: "thin" as const, color: { argb: "FFB0B0B0" } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

/**
 * buildOfferWorkbook (tekil teklif/fiyat teklifi belgesi) ile karıştırılmamalı
 * — bu, Teklifler listesindeki (filtrelenmiş) satırların düz bir özet
 * tablosu. Kullanıcı onaylı tekil teklif şablonuna dokunmuyor.
 */
export async function buildOffersListWorkbook(offers: OfferListItem[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PV Solutions CRM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Teklifler", {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { key: "offerNo", width: 24 },
    { key: "leadNo", width: 18 },
    { key: "customerName", width: 28 },
    { key: "status", width: 16 },
    { key: "createdAt", width: 14 },
  ];

  const headers = ["Teklif No", "Lead", "Müşteri", "Durum", "Oluşturulma"];
  headers.forEach((label, index) => {
    const cell = sheet.getRow(1).getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = CELL_BORDER;
  });

  offers.forEach((offer, index) => {
    const row = sheet.getRow(index + 2);
    row.getCell(1).value = offer.offerNo;
    row.getCell(2).value = offer.leadNo;
    row.getCell(3).value = offer.customerName;
    row.getCell(4).value = OFFER_STATUS_LABELS[offer.status] ?? offer.status;
    row.getCell(5).value = new Date(offer.createdAt);
    row.getCell(5).numFmt = "dd.mm.yyyy";
    for (let col = 1; col <= 5; col++) {
      row.getCell(col).border = CELL_BORDER;
    }
  });

  return workbook;
}
