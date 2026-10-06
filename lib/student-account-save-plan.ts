export type StudentAccountDraft = {
  studentId: string;
  id: string;
  username?: string;
  name: string;
  password: string;
  contact?: string;
  classKey?: string;
  classKeys?: string[];
  classKeysByMonth?: Record<string, string[]>;
  classAccessRanges?: Record<string, Record<string, {
    startCardId?: string | null;
    startOrder?: number | null;
  }>>;
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
  createdAt?: string;
};

function username(item: StudentAccountDraft) {
  return (item.username ?? item.id).trim();
}

function accountFields(item: StudentAccountDraft) {
  return {
    studentId: item.studentId, id: item.id, username: username(item),
    name: item.name, password: item.password, contact: item.contact ?? '',
    classKey: item.classKey ?? '', classKeys: item.classKeys ?? [],
    monthKey: item.monthKey, expiresAt: item.expiresAt,
    isActive: item.isActive, createdAt: item.createdAt,
  };
}

function sameKeys(left: string[], right: string[]) {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
}

export function buildStudentSavePlan(
  items: StudentAccountDraft[], saved: StudentAccountDraft[], yearMonth: string
) {
  const previous = new Map(saved.map((item) => [username(item), item]));
  const accountItems = items.filter((item) => {
    const before = previous.get(username(item));
    return !before || JSON.stringify(accountFields(item)) !== JSON.stringify(accountFields(before));
  }).map(accountFields);
  const deletedUsernames = saved.filter((item) => !items.some((next) => username(next) === username(item)))
    .map(username);
  const permissions = items.flatMap((item) => {
    const keys = item.classKeysByMonth?.[yearMonth] ?? [];
    const oldKeys = previous.get(username(item))?.classKeysByMonth?.[yearMonth] ?? [];
    return sameKeys(keys, oldKeys) ? [] : [{ username: username(item), classKeys: keys }];
  });
  const ranges = items.flatMap((item) => Object.entries(item.classAccessRanges?.[yearMonth] ?? {})
    .flatMap(([classKey, range]) => {
      const before = previous.get(username(item))?.classAccessRanges?.[yearMonth]?.[classKey];
      const current = { startCardId: range.startCardId ?? null, startOrder: range.startOrder ?? null };
      const old = { startCardId: before?.startCardId ?? null, startOrder: before?.startOrder ?? null };
      return JSON.stringify(current) === JSON.stringify(old) ? [] : [{
        studentId: item.studentId, yearMonth, classKey, ...current,
      }];
    }));
  return { accountItems, deletedUsernames, permissions, ranges };
}
