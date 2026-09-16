import ExcelJS from "exceljs";
import type { OfferVersionForExport } from "@/lib/data/offers";
import { COMPANY_PROFILE, VAT_RATE } from "./company-profile";

const CURRENCY_FORMATS: Record<string, string> = {
  TRY: '#,##0.00 "₺"',
  USD: '"$"#,##0.00',
  EUR: '"€"#,##0.00',
};

function currencyFormat(currency: string): string {
  return CURRENCY_FORMATS[currency] ?? "#,##0.00";
}

const THIN_BORDER = { style: "thin" as const, color: { argb: "FFB0B0B0" } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

type ExportRow = {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

/**
 * offer.amount + offer.vatIncluded, teklifin tek gerçek sözleşme değeri —
 * offer-form.tsx'te kalem satırlarından tamamen bağımsız, serbest bir
 * girdi (create_offer/revise_offer/record_sales_outcome da hep bunu
 * kullanır, kalemlerden yeniden türetmez). Önceden kalem satırları varsa
 * TOPLAM/KDV/GENEL TOPLAM kalem fiyatlarının toplamından yeniden
 * hesaplanıyordu — bu, kalem birim fiyatları KDV dahil girildiğinde (ör.
 * "KDV dahil" işaretli bir teklifte) KDV'nin ikinci kez eklenmesine yol
 * açıyordu. Toplamlar artık her durumda amount/vatIncluded'dan türetiliyor;
 * kalem satırları yalnızca bilgilendirici bir döküm.
 */
function resolveRowsAndTotals(offer: OfferVersionForExport) {
  const subtotal = offer.vatIncluded ? offer.amount / (1 + VAT_RATE) : offer.amount;
  const vat = subtotal * VAT_RATE;
  const grandTotal = subtotal + vat;

  if (offer.items.length > 0) {
    const rows: ExportRow[] = offer.items.map((item) => ({
      productCode: item.productCode ?? "",
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
    return { rows, subtotal, vat, grandTotal };
  }

  const productName = offer.scopeSummary?.trim() || "Güneş Enerji Sistemi Kurulumu";
  const rows: ExportRow[] = [{ productCode: "", productName, quantity: 1, unitPrice: subtotal }];
  return { rows, subtotal, vat, grandTotal };
}

export async function buildOfferWorkbook(offer: OfferVersionForExport): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PV Solutions CRM";
  workbook.created = new Date(offer.createdAt);

  const sheet = workbook.addWorksheet("Teklif", {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { key: "code", width: 16 },
    { key: "name", width: 42 },
    { key: "qty", width: 12 },
    { key: "unitPrice", width: 18 },
    { key: "total", width: 18 },
  ];

  const numberFormat = currencyFormat(offer.currency);

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = COMPANY_PROFILE.name;
  sheet.getCell("A1").font = { bold: true, size: 12 };

  COMPANY_PROFILE.addressLines.forEach((line, index) => {
    const rowNo = 2 + index;
    sheet.mergeCells(`A${rowNo}:E${rowNo}`);
    sheet.getCell(`A${rowNo}`).value = line;
  });

  const phoneRowNo = 2 + COMPANY_PROFILE.addressLines.length;
  sheet.mergeCells(`A${phoneRowNo}:E${phoneRowNo}`);
  sheet.getCell(`A${phoneRowNo}`).value = `Mobile: ${COMPANY_PROFILE.phone}`;

  let row = phoneRowNo + 2;

  sheet.mergeCells(`A${row}:E${row}`);
  const titleCell = sheet.getCell(`A${row}`);
  titleCell.value = "FİYAT TEKLİFİ";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center" };
  row += 2;

  sheet.getCell(`A${row}`).value = new Date(offer.createdAt).toLocaleDateString("tr-TR");
  row += 2;

  sheet.getCell(`A${row}`).value = "FİRMA";
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = offer.customerName;
  row += 1;

  sheet.getCell(`A${row}`).value = "TEKLİF NO";
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = `${offer.offerNo} — Rev.${offer.revisionNo}`;
  row += 2;

  const headerRowNo = row;
  const headers = ["Ürün Kodu", "Ürün", "Adet/Metre", "Birim Fiyat", "Toplam"];
  headers.forEach((label, index) => {
    const cell = sheet.getRow(headerRowNo).getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = CELL_BORDER;
    cell.alignment = { horizontal: index >= 2 ? "right" : "left" };
  });
  row += 1;

  const { rows: itemRows, subtotal, vat, grandTotal } = resolveRowsAndTotals(offer);

  itemRows.forEach((item) => {
    const excelRow = sheet.getRow(row);
    excelRow.getCell(1).value = item.productCode;
    excelRow.getCell(2).value = item.productName;
    excelRow.getCell(3).value = item.quantity;
    excelRow.getCell(4).value = item.unitPrice;
    excelRow.getCell(4).numFmt = numberFormat;
    excelRow.getCell(5).value = { formula: `C${row}*D${row}`, result: item.quantity * item.unitPrice };
    excelRow.getCell(5).numFmt = numberFormat;
    for (let col = 1; col <= 5; col++) {
      excelRow.getCell(col).border = CELL_BORDER;
    }
    row += 1;
  });

  row += 1;

  const totalsLabelCol = "D";
  const totalsValueCol = "E";

  sheet.getCell(`${totalsLabelCol}${row}`).value = "TOPLAM";
  sheet.getCell(`${totalsLabelCol}${row}`).font = { bold: true };
  sheet.getCell(`${totalsValueCol}${row}`).value = subtotal;
  sheet.getCell(`${totalsValueCol}${row}`).numFmt = numberFormat;
  row += 1;

  sheet.getCell(`${totalsLabelCol}${row}`).value = "KDV";
  sheet.getCell(`${totalsValueCol}${row}`).value = vat;
  sheet.getCell(`${totalsValueCol}${row}`).numFmt = numberFormat;
  row += 1;

  sheet.getCell(`${totalsLabelCol}${row}`).value = "GENEL TOPLAM";
  sheet.getCell(`${totalsLabelCol}${row}`).font = { bold: true };
  sheet.getCell(`${totalsValueCol}${row}`).value = grandTotal;
  sheet.getCell(`${totalsValueCol}${row}`).numFmt = numberFormat;
  sheet.getCell(`${totalsValueCol}${row}`).font = { bold: true };
  row += 2;

  sheet.getCell(`A${row}`).value = "SATICI";
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = "ALICI";
  sheet.getCell(`C${row}`).font = { bold: true };
  row += 1;

  sheet.getCell(`A${row}`).value = COMPANY_PROFILE.name;
  sheet.getCell(`C${row}`).value = offer.customerName;
  row += 2;

  sheet.getCell(`A${row}`).value = "Ödeme Şekli";
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = offer.paymentMethod || "—";
  row += 1;

  sheet.getCell(`A${row}`).value = "Nakliye";
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = offer.shippingTerms || "—";
  row += 2;

  // Şirket profilinde şu an yalnızca TRY IBAN'ı tanımlı — döviz cinsinden
  // tekliflerde "HESAP NUMARASI - USD: <TRY IBAN>" gibi yanıltıcı bir etiket
  // basmamak için hesap her zaman kendi para birimiyle (TRY) etiketleniyor.
  sheet.getCell(`A${row}`).value = `HESAP NUMARASI - TRY: ${COMPANY_PROFILE.ibanTry}`;
  sheet.getCell(`A${row}`).font = { bold: true };
  row += 1;
  sheet.getCell(`A${row}`).value = COMPANY_PROFILE.bankName;
  sheet.getCell(`A${row}`).font = { bold: true };
  row += 1;
  sheet.getCell(`A${row}`).value = COMPANY_PROFILE.accountHolder;
  sheet.getCell(`A${row}`).font = { bold: true };

  return workbook;
}
