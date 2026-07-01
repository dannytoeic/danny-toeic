import { supabaseAdmin } from './supabase-admin';

export type ClassKeysByMonth = Record<string, string[]>;

export type StudentMonthPermissionRow = {
  student_id: string | null;
  username: string | null;
  year_month: string | null;
  class_keys: string[] | null;
};

type FallbackPermissionsRow = {
  notice_key: string;
  content_text: string | null;
  updated_at: string | null;
};

export type PermissionOwner = {
  studentId?: string | null;
  username?: string | null;
  classKeysByMonth?: ClassKeysByMonth | null;
};

const FALLBACK_NOTICE_KEY = 'student_month_permissions';

function mapPermissionRows(rows: StudentMonthPermissionRow[]) {
  const byUsername = new Map<string, ClassKeysByMonth>();
  const byStudentId = new Map<string, ClassKeysByMonth>();

  for (const row of rows) {
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

  return { byUsername, byStudentId };
}

function parseFallbackPermissionRows(value: unknown): StudentMonthPermissionRow[] {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value;
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(obj.rows) ? obj.rows : [];

  return rows.reduce<StudentMonthPermissionRow[]>((acc, item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const username = String(row.username ?? '').trim();
    const yearMonth = String(row.year_month ?? row.yearMonth ?? '').trim();

    if (!username || !yearMonth) return acc;

    acc.push({
      student_id: String(row.student_id ?? row.studentId ?? '').trim() || null,
      username,
      year_month: yearMonth,
      class_keys: normalizeClassKeyArray(row.class_keys ?? row.classKeys),
    });

    return acc;
  }, []);
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function rowKey(row: StudentMonthPermissionRow) {
  return `${String(row.username ?? '').trim()}__${String(row.year_month ?? '').trim()}`;
}

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
  const fallbackResult = await fetchFallbackStudentMonthPermissions();
  const { data, error } = await supabaseAdmin
    .from('student_month_permissions')
    .select('student_id, username, year_month, class_keys');

  if (error) {
    if (isMissingPermissionsTableError(error)) {
      if (fallbackResult.error) {
        return {
          available: false,
          byUsername: new Map<string, ClassKeysByMonth>(),
          byStudentId: new Map<string, ClassKeysByMonth>(),
          error: fallbackResult.error,
        };
      }

      return {
        available: fallbackResult.available,
        byUsername: fallbackResult.byUsername,
        byStudentId: fallbackResult.byStudentId,
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

  const fallbackRows = fallbackResult.rows ?? [];
  const tableRows = (data ?? []) as StudentMonthPermissionRow[];
  const { byUsername, byStudentId } = mapPermissionRows([...fallbackRows, ...tableRows]);

  return { available: true, byUsername, byStudentId, error: null };
}

export async function fetchFallbackStudentMonthPermissions() {
  const { data, error } = await supabaseAdmin
    .from('site_notices')
    .select('notice_key, content_text, updated_at')
    .eq('notice_key', FALLBACK_NOTICE_KEY)
    .maybeSingle();

  if (error) {
    return {
      available: false,
      rows: [] as StudentMonthPermissionRow[],
      byUsername: new Map<string, ClassKeysByMonth>(),
      byStudentId: new Map<string, ClassKeysByMonth>(),
      error,
    };
  }

  const rows = parseFallbackPermissionRows((data as FallbackPermissionsRow | null)?.content_text);
  const { byUsername, byStudentId } = mapPermissionRows(rows);

  return {
    available: true,
    rows,
    byUsername,
    byStudentId,
    error: null,
  };
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
      return upsertFallbackStudentMonthPermissions(rows);
    }

    return { available: false, error, rowsWritten: 0 };
  }

  const fallbackWrite = await upsertFallbackStudentMonthPermissions(rows);
  if (fallbackWrite.error) {
    console.error('student_month_permissions fallback sync error:', fallbackWrite.error);
  }

  return { available: true, error: null, rowsWritten: rows.length };
}

async function upsertFallbackStudentMonthPermissions(rows: StudentMonthPermissionRow[]) {
  const existing = await fetchFallbackStudentMonthPermissions();

  if (existing.error) {
    return { available: false, error: existing.error, rowsWritten: 0 };
  }

  const merged = new Map<string, StudentMonthPermissionRow>();

  for (const row of existing.rows ?? []) {
    merged.set(rowKey(row), row);
  }

  for (const row of rows) {
    merged.set(rowKey(row), {
      student_id: row.student_id,
      username: row.username,
      year_month: row.year_month,
      class_keys: normalizeClassKeyArray(row.class_keys),
    });
  }

  const mergedRows = Array.from(merged.values()).filter((row) => {
    return String(row.username ?? '').trim() && String(row.year_month ?? '').trim();
  });
  const updatedAt = new Date().toISOString();

  const { error } = await supabaseAdmin.from('site_notices').upsert(
    {
      notice_key: FALLBACK_NOTICE_KEY,
      title: 'Student month permissions',
      content_text: JSON.stringify({
        rows: mergedRows,
        updatedAt,
      }),
      updated_at: updatedAt,
    },
    { onConflict: 'notice_key' }
  );

  if (error) {
    return { available: false, error, rowsWritten: 0 };
  }

  return { available: true, error: null, rowsWritten: rows.length };
}
