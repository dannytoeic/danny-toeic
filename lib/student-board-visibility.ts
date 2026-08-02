import { CLASS_KEYS, type ClassKey, OPERATING_YEAR_MONTH } from './operating-month';

export const JULY_BOARD_YEAR_MONTH = '2026-07';
export const JULY_BOARD_HIDE_AT = '2026-08-10T00:00:00+09:00';

const CLASS_LABELS: Record<ClassKey, string> = {
  '600-monwed': '600 월수반',
  '600-tuthu': '600 화목반',
  '800-monwed': '800 월수반',
  '800-tuthu': '800 화목반',
};

const CLASS_PATHS: Record<ClassKey, string> = {
  '600-monwed': '/student/class-600-monwed',
  '600-tuthu': '/student/class-600-tuthu',
  '800-monwed': '/student/class-800-monwed',
  '800-tuthu': '/student/class-800-tuthu',
};

export type StudentBoardLink = {
  yearMonth: string;
  classKey: ClassKey;
  label: string;
  href: string;
};

export function getStudentVisibleYearMonths(now = new Date()) {
  return now.getTime() < Date.parse(JULY_BOARD_HIDE_AT)
    ? [JULY_BOARD_YEAR_MONTH, OPERATING_YEAR_MONTH]
    : [OPERATING_YEAR_MONTH];
}

export function isStudentBoardMonthVisible(yearMonth: string, now = new Date()) {
  return getStudentVisibleYearMonths(now).includes(yearMonth);
}

export function buildStudentBoardLinks(
  classKeysByMonth: Record<string, string[]>,
  now = new Date()
): StudentBoardLink[] {
  return getStudentVisibleYearMonths(now).flatMap((yearMonth) => {
    const monthNumber = Number(yearMonth.slice(5));
    const classKeys = Array.isArray(classKeysByMonth[yearMonth])
      ? classKeysByMonth[yearMonth]
      : [];

    return CLASS_KEYS.filter((classKey) => classKeys.includes(classKey)).map((classKey) => ({
      yearMonth,
      classKey,
      label: `${monthNumber}월 ${CLASS_LABELS[classKey]}`,
      href: `${CLASS_PATHS[classKey]}?yearMonth=${encodeURIComponent(yearMonth)}`,
    }));
  });
}
