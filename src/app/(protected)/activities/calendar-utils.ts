export function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffFromMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diffFromMonday);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Tam adların .slice(0,3)'ü çakışıyor: "Pazartesi"/"Pazar" ikisi de "Paz",
// "Cuma"/"Cumartesi" ikisi de "Cum" olur — bu yüzden elle kısaltılmış.
export const WEEKDAY_SHORT_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function getMonthStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  return getMonthStart(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

export function toMonthParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * `month` query param'ı yerel tarih bileşenleriyle elle parse edilir —
 * `new Date("YYYY-MM-DD")` UTC olarak yorumlanıp negatif ofsetli saat
 * dilimlerinde bir gün geriye kayabiliyor.
 */
export function parseMonthParam(monthParam: string | undefined): Date {
  const match = monthParam ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null;
  if (match) {
    const [, y, m] = match;
    const parsed = new Date(Number(y), Number(m) - 1, 1);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return getMonthStart(new Date());
}

export function formatMonthLabel(monthStart: Date): string {
  const label = monthStart.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Ayın tüm günlerini kapsayan, Pazartesi başlangıçlı tam haftalar ızgarası. */
export function getMonthGrid(monthStart: Date): Date[] {
  const gridStart = getMonday(monthStart);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const gridEnd = addDays(getMonday(monthEnd), 6);
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  return Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i));
}
