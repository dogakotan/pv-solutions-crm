import { z } from "zod";

export const INTEREST_VALUES = ["yes", "no", "considering"] as const;
export const COMPETITOR_STATUS_VALUES = ["none", "exists", "unknown"] as const;
export const LEAD_SCORE_VALUES = ["hot", "warm", "mid", "cold"] as const;

/**
 * emptyValue is `null` for update paths (an explicit null clears the column)
 * and `undefined` for insert/create paths (an omitted key just falls back to
 * the RPC's own default) — the two call sites need different "empty" values,
 * not just different schemas.
 */
export function optionalText<E extends null | undefined>(max: number, emptyValue: E) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((v): string | E => (v ? v : emptyValue));
}

export function optionalNumber<E extends null | undefined>(emptyValue: E) {
  return z
    .string()
    .trim()
    .transform((v): number | E => (v ? Number(v) : emptyValue))
    .refine(
      (v) => (v as unknown) === emptyValue || (typeof v === "number" && Number.isFinite(v) && v >= 0),
      "Sayı negatif olamaz."
    );
}

export function optionalEnum<T extends readonly [string, ...string[]], E extends null | undefined>(
  values: T,
  emptyValue: E
) {
  return z
    .string()
    .trim()
    .transform((v): T[number] | E => (v ? (v as T[number]) : emptyValue))
    .refine(
      (v) => (v as unknown) === emptyValue || (values as readonly string[]).includes(v as string),
      "Geçersiz değer."
    );
}
