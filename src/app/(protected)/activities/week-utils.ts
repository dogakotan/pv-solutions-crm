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

export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * `week` query param'ı UTC olarak yorumlanırsa gün kayması olabilir
 * (negatif UTC ofsetli saat dilimlerinde bir gün geriye kayar) — bu
 * yüzden "YYYY-MM-DD" elle, yerel saat bileşenleriyle parse ediliyor.
 */
export function parseWeekParam(weekParam: string | undefined): Date {
  const match = weekParam ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekParam) : null;
  if (match) {
    const [, y, m, d] = match;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(parsed.getTime())) return getMonday(parsed);
  }
  return getMonday(new Date());
}

export function formatWeekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const startLabel = monday.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: sameMonth ? undefined : "long",
  });
  const endLabel = sunday.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const WEEKDAY_LABELS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
