import { supabaseAdmin } from './supabase-admin';

export type ClassKeysByMonth = Record<string, string[]>;

export type StudentMonthPermissionRow = {
  student_id: string | null;
  username: string | null;
  year_month: string | null;
  class_keys: string[] | null;
};

export type PermissionOwner = {
  studentId?: string | null;
  username?: string | null;
  classKeysByMonth?: ClassKeysByMonth | null;
};

export function normalizeClassKeyArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))
  );
}

export function normalizeClassKeysByMonth(value: unknown): ClassKeysByMonth {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<ClassKeysByMonth>(
    (acc, [month, classKeys]) => {
      const yearMonth = String(month ?? '').trim();

      if (yearMonth && Array.isArray(classKeys)) {
        acc[yearMonth] = normalizeClassKeyArray(classKeys);
      }

      return acc;
    },
    {}
  );
}

export function isMissingPermissionsTableError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code ?? '');
  const message = String((error as { message?: string } | null)?.message ?? '');

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('student_month_permissions')
  );
}

export function isMissingClassKeysByMonthColumnError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code ?? '');
  const message = String((error as { message?: string } | null)?.message ?? '');

  return code === '42703' || code === 'PGRST204' || message.includes('class_keys_by_month');
}

export async function fetchStudentMonthPermissions() {
  const { data, error } = await supabaseAdmin
    .from('student_month_permissions')
    .select('student_id, username, year_month, class_keys');

  if (error) {
    if (isMissingPermissionsTableError(error)) {
      return {
        available: false,
        byUsername: new Map<string, ClassKeysByMonth>(),
        byStudentId: new Map<string, ClassKeysByMonth>(),
        error: null,
      };
    }

    return {
      available: false,
      byUsername: new Map<string, ClassKeysByMonth>(),
      byStudentId: new Map<string, ClassKeysByMonth>(),
      error,
    };
  }

  const byUsername = new Map<string, ClassKeysByMonth>();
  const byStudentId = new Map<string, ClassKeysByMonth>();

  for (const row of (data ?? []) as StudentMonthPermissionRow[]) {
    const yearMonth = String(row.year_month ?? '').trim();
    if (!yearMonth) continue;

    const classKeys = normalizeClassKeyArray(row.class_keys);
    const username = String(row.username ?? '').trim();
    const studentId = String(row.student_id ?? '').trim();

    if (username) {
      byUsername.set(username, {
        ...(byUsername.get(username) ?? {}),
        [yearMonth]: classKeys,
      });
    }

    if (studentId) {
      byStudentId.set(studentId, {
        ...(byStudentId.get(studentId) ?? {}),
        [yearMonth]: classKeys,
      });
    }
  }

  return { available: true, byUsername, byStudentId, error: null };
}

export function getPermissionMapForOwner(
  owner: PermissionOwner,
  permissions: Awaited<ReturnType<typeof fetchStudentMonthPermissions>>
): ClassKeysByMonth {
  const username = String(owner.username ?? '').trim();
  const studentId = String(owner.studentId ?? '').trim();

  return {
    ...(studentId ? permissions.byStudentId.get(studentId) ?? {} : {}),
    ...(username ? permissions.byUsername.get(username) ?? {} : {}),
  };
}

export async function upsertStudentMonthPermissions(items: PermissionOwner[]) {
  const rows = items.flatMap((item) => {
    const username = String(item.username ?? '').trim();
    const studentId = String(item.studentId ?? '').trim();
    const classKeysByMonth = normalizeClassKeysByMonth(item.classKeysByMonth);

    if (!username) return [];

    return Object.entries(classKeysByMonth).map(([yearMonth, classKeys]) => ({
      student_id: studentId || null,
      username,
      year_month: yearMonth,
      class_keys: classKeys,
      updated_at: new Date().toISOString(),
    }));
  });

  if (rows.length === 0) {
    return { available: true, error: null, rowsWritten: 0 };
  }

  const { error } = await supabaseAdmin
    .from('student_month_permissions')
    .upsert(rows, { onConflict: 'username,year_month' });

  if (error) {
    if (isMissingPermissionsTableError(error)) {
      return { available: false, error: null, rowsWritten: 0 };
    }

    return { available: false, error, rowsWritten: 0 };
  }

  return { available: true, error: null, rowsWritten: rows.length };
}
