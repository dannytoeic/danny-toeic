import { supabaseAdmin } from './supabase-admin';

export type StudentClassAccessRange = {
  studentId: string;
  yearMonth: string;
  classKey: string;
  startCardId: string | null;
  startOrder: number | null;
};

type StudentClassAccessRangeRow = {
  student_id: string | null;
  year_month: string | null;
  class_key: string | null;
  start_card_id: string | null;
  start_order: number | null;
};

type FallbackAccessRangeRow = {
  notice_key: string;
  content_text: string | null;
  updated_at: string | null;
};

const FALLBACK_NOTICE_KEY = 'student_class_access_ranges';

export function accessRangeKey(studentId: string, yearMonth: string, classKey: string) {
  return `${studentId}__${yearMonth}__${classKey}`;
}

export function isMissingAccessRangesTableError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code ?? '');
  const message = String((error as { message?: string } | null)?.message ?? '');

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('student_class_access_ranges')
  );
}

function mapRow(row: StudentClassAccessRangeRow): StudentClassAccessRange | null {
  const studentId = String(row.student_id ?? '').trim();
  const yearMonth = String(row.year_month ?? '').trim();
  const classKey = String(row.class_key ?? '').trim();

  if (!studentId || !yearMonth || !classKey) return null;

  return {
    studentId,
    yearMonth,
    classKey,
    startCardId: String(row.start_card_id ?? '').trim() || null,
    startOrder: Number.isFinite(Number(row.start_order)) ? Number(row.start_order) : null,
  };
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseFallbackAccessRangeRows(value: unknown): StudentClassAccessRange[] {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value;
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(obj.rows) ? obj.rows : [];

  return rows.reduce<StudentClassAccessRange[]>((acc, item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const mapped = mapRow({
      student_id: String(row.student_id ?? row.studentId ?? '').trim() || null,
      year_month: String(row.year_month ?? row.yearMonth ?? '').trim() || null,
      class_key: String(row.class_key ?? row.classKey ?? '').trim() || null,
      start_card_id: String(row.start_card_id ?? row.startCardId ?? '').trim() || null,
      start_order: Number.isFinite(Number(row.start_order ?? row.startOrder))
        ? Number(row.start_order ?? row.startOrder)
        : null,
    });

    if (mapped) {
      acc.push(mapped);
    }

    return acc;
  }, []);
}

function mapRangesByKey(ranges: StudentClassAccessRange[]) {
  return new Map(
    ranges.map((range) => [
      accessRangeKey(range.studentId, range.yearMonth, range.classKey),
      range,
    ])
  );
}

export async function fetchStudentClassAccessRanges(studentId?: string) {
  const fallbackResult = await fetchFallbackStudentClassAccessRanges(studentId);
  let query = supabaseAdmin
    .from('student_class_access_ranges')
    .select('student_id, year_month, class_key, start_card_id, start_order');

  const normalizedStudentId = String(studentId ?? '').trim();
  if (normalizedStudentId) {
    query = query.eq('student_id', normalizedStudentId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingAccessRangesTableError(error)) {
      return {
        available: fallbackResult.available,
        ranges: fallbackResult.ranges,
        byKey: fallbackResult.byKey,
        error: fallbackResult.error,
      };
    }

    return {
      available: false,
      ranges: [] as StudentClassAccessRange[],
      byKey: new Map<string, StudentClassAccessRange>(),
      error,
    };
  }

  const ranges = Array.isArray(data)
    ? (data as StudentClassAccessRangeRow[])
        .map((row) => mapRow(row))
        .filter((row): row is StudentClassAccessRange => Boolean(row))
    : [];
  const mergedByKey = mapRangesByKey([...(fallbackResult.ranges ?? []), ...ranges]);
  const mergedRanges = Array.from(mergedByKey.values());

  return { available: true, ranges: mergedRanges, byKey: mergedByKey, error: null };
}

export async function upsertStudentClassAccessRanges(ranges: StudentClassAccessRange[]) {
  const rows = ranges
    .map((range) => ({
      student_id: String(range.studentId ?? '').trim(),
      year_month: String(range.yearMonth ?? '').trim(),
      class_key: String(range.classKey ?? '').trim(),
      start_card_id: String(range.startCardId ?? '').trim() || null,
      start_order: Number.isFinite(Number(range.startOrder)) ? Number(range.startOrder) : null,
      updated_at: new Date().toISOString(),
    }))
    .filter((row) => row.student_id && row.year_month && row.class_key);

  if (rows.length === 0) {
    return { available: true, error: null, rowsWritten: 0 };
  }

  const { error } = await supabaseAdmin
    .from('student_class_access_ranges')
    .upsert(rows, { onConflict: 'student_id,year_month,class_key' });

  if (error) {
    if (isMissingAccessRangesTableError(error)) {
      return upsertFallbackStudentClassAccessRanges(ranges);
    }

    return { available: false, error, rowsWritten: 0 };
  }

  const fallbackWrite = await upsertFallbackStudentClassAccessRanges(ranges);
  if (fallbackWrite.error) {
    console.error('student_class_access_ranges fallback sync error:', fallbackWrite.error);
  }

  return { available: true, error: null, rowsWritten: rows.length };
}

async function fetchFallbackStudentClassAccessRanges(studentId?: string) {
  const { data, error } = await supabaseAdmin
    .from('site_notices')
    .select('notice_key, content_text, updated_at')
    .eq('notice_key', FALLBACK_NOTICE_KEY)
    .maybeSingle();

  if (error) {
    return {
      available: false,
      ranges: [] as StudentClassAccessRange[],
      byKey: new Map<string, StudentClassAccessRange>(),
      error,
    };
  }

  const normalizedStudentId = String(studentId ?? '').trim();
  const ranges = parseFallbackAccessRangeRows(
    (data as FallbackAccessRangeRow | null)?.content_text
  ).filter((range) => !normalizedStudentId || range.studentId === normalizedStudentId);
  const byKey = mapRangesByKey(ranges);

  return {
    available: true,
    ranges,
    byKey,
    error: null,
  };
}

async function upsertFallbackStudentClassAccessRanges(ranges: StudentClassAccessRange[]) {
  const existing = await fetchFallbackStudentClassAccessRanges();

  if (existing.error) {
    return { available: false, error: existing.error, rowsWritten: 0 };
  }

  const merged = mapRangesByKey(existing.ranges ?? []);

  for (const range of ranges) {
    const studentId = String(range.studentId ?? '').trim();
    const yearMonth = String(range.yearMonth ?? '').trim();
    const classKey = String(range.classKey ?? '').trim();

    if (!studentId || !yearMonth || !classKey) continue;

    merged.set(accessRangeKey(studentId, yearMonth, classKey), {
      studentId,
      yearMonth,
      classKey,
      startCardId: String(range.startCardId ?? '').trim() || null,
      startOrder: Number.isFinite(Number(range.startOrder)) ? Number(range.startOrder) : null,
    });
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from('site_notices').upsert(
    {
      notice_key: FALLBACK_NOTICE_KEY,
      title: 'Student class access ranges',
      content_text: JSON.stringify({
        rows: Array.from(merged.values()).map((range) => ({
          student_id: range.studentId,
          year_month: range.yearMonth,
          class_key: range.classKey,
          start_card_id: range.startCardId,
          start_order: range.startOrder,
        })),
        updatedAt,
      }),
      updated_at: updatedAt,
    },
    { onConflict: 'notice_key' }
  );

  if (error) {
    return { available: false, error, rowsWritten: 0 };
  }

  return { available: true, error: null, rowsWritten: ranges.length };
}
