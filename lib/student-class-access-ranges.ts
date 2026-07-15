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

export async function fetchStudentClassAccessRanges(studentId?: string) {
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
        available: false,
        ranges: [] as StudentClassAccessRange[],
        byKey: new Map<string, StudentClassAccessRange>(),
        error: null,
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
  const byKey = new Map(
    ranges.map((range) => [
      accessRangeKey(range.studentId, range.yearMonth, range.classKey),
      range,
    ])
  );

  return { available: true, ranges, byKey, error: null };
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
      return { available: false, error: null, rowsWritten: 0 };
    }

    return { available: false, error, rowsWritten: 0 };
  }

  return { available: true, error: null, rowsWritten: rows.length };
}
