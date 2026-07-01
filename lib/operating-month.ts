export const OPERATING_YEAR_MONTH = '2026-07';

export const SUPPORTED_CLASS_UPDATE_MONTHS = ['2026-07', '2026-06', '2026-05'];

export const MONTH_LABELS: Record<string, string> = {
  '2026-07': '2026년 7월',
  '2026-06': '2026년 6월',
  '2026-05': '2026년 5월',
};

export const CLASS_KEYS = [
  '600-monwed',
  '600-tuthu',
  '800-monwed',
  '800-tuthu',
] as const;

export type ClassKey = (typeof CLASS_KEYS)[number];

export function isClassKey(value: unknown): value is ClassKey {
  return typeof value === 'string' && CLASS_KEYS.includes(value as ClassKey);
}

export function normalizeYearMonth(value: unknown, fallback = OPERATING_YEAR_MONTH) {
  const yearMonth = String(value ?? '').trim();
  return /^\d{4}-\d{2}$/.test(yearMonth) ? yearMonth : fallback;
}
