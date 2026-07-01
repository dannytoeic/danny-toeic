import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { OPERATING_YEAR_MONTH } from '../../../lib/operating-month';

type StudentAccountItem = {
  studentId: string;
  id: string;
  username?: string;
  name: string;
  password: string;
  contact?: string;
  classKey?: string;
  classKeys?: string[];
  classKeysByMonth?: Record<string, string[]>;
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
  createdAt?: string;
};

type StudentAccountRow = {
  student_id: string | null;
  username: string;
  password: string;
  name: string;
  contact: string | null;
  class_key: string | null;
  class_keys: string[] | null;
  class_keys_by_month?: Record<string, string[]> | null;
  month_key: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string | null;
};

type NormalizedStudentAccountRow = {
  student_id: string;
  username: string;
  password: string;
  name: string;
  contact: string;
  class_key: string;
  class_keys: string[];
  class_keys_by_month: Record<string, string[]>;
  month_key: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

function normalizeClassKeys(item: {
  classKey?: string | null;
  classKeys?: string[] | null;
}): string[] {
  if (Array.isArray(item.classKeys) && item.classKeys.length > 0) {
    return item.classKeys.filter(Boolean);
  }

  if (item.classKey) {
    return [item.classKey];
  }

  return [];
}

function normalizeClassKeysByMonth(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>(
    (acc, [month, classKeys]) => {
      const yearMonth = String(month ?? '').trim();
      const keys = Array.isArray(classKeys)
        ? classKeys.map((item) => String(item).trim()).filter(Boolean)
        : [];

      if (yearMonth && keys.length > 0) {
        acc[yearMonth] = Array.from(new Set(keys));
      }

      return acc;
    },
    {}
  );
}

function mapRowToItem(row: StudentAccountRow): StudentAccountItem {
  const classKeys = normalizeClassKeys({
    classKey: row.class_key,
    classKeys: row.class_keys,
  });
  const classKeysByMonth = normalizeClassKeysByMonth(row.class_keys_by_month);
  const legacyMonthKey = row.month_key || '';
  const effectiveClassKeysByMonth =
    Object.keys(classKeysByMonth).length > 0 || !legacyMonthKey || classKeys.length === 0
      ? classKeysByMonth
      : { [legacyMonthKey]: classKeys };

  return {
    studentId: row.student_id || '',
    id: row.username,
    username: row.username,
    name: row.name,
    password: row.password,
    contact: row.contact || '',
    classKey: row.class_key || classKeys[0] || '',
    classKeys,
    classKeysByMonth: effectiveClassKeysByMonth,
    monthKey: legacyMonthKey,
    expiresAt: row.expires_at || '',
    isActive: row.is_active,
    createdAt: row.created_at || '',
  };
}

export async function GET() {
  try {
    let { data, error } = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, password, name, contact, class_key, class_keys, class_keys_by_month, month_key, expires_at, is_active, created_at'
      )
      .order('created_at', { ascending: false });

    if (error?.code === '42703' || String(error?.message ?? '').includes('class_keys_by_month')) {
      const legacyResult = await supabaseAdmin
        .from('student_accounts')
        .select(
          'student_id, username, password, name, contact, class_key, class_keys, month_key, expires_at, is_active, created_at'
        )
        .order('created_at', { ascending: false });

      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }

    if (error) {
      console.error('save-student-accounts GET error:', error);

      return NextResponse.json(
        { success: false, message: '학생 계정을 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const items = Array.isArray(data)
      ? (data as StudentAccountRow[]).map(mapRowToItem)
      : [];

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('save-student-accounts GET catch error:', error);

    return NextResponse.json(
      { success: false, message: '학생 계정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: StudentAccountItem[] = Array.isArray(body?.items) ? body.items : [];

    const normalized: NormalizedStudentAccountRow[] = items.reduce<
      NormalizedStudentAccountRow[]
    >((acc, item, index) => {
      const classKeys = normalizeClassKeys({
        classKey: item.classKey,
        classKeys: item.classKeys ?? [],
      });
      const classKeysByMonth = normalizeClassKeysByMonth(item.classKeysByMonth);
      if (classKeys.length > 0 && Object.keys(classKeysByMonth).length === 0) {
        const monthKey = String(item.monthKey ?? '').trim();
        if (monthKey) {
          classKeysByMonth[monthKey] = classKeys;
        }
      }
      const representativeClassKey = String(item.classKey ?? '').trim();

      const username = String(item.username ?? item.id ?? '').trim();

      if (!username) {
        return acc;
      }

      acc.push({
        student_id:
          String(item.studentId ?? '').trim() || `stu${String(index + 1).padStart(3, '0')}`,
        username,
        password: String(item.password ?? '').trim(),
        name: String(item.name ?? '').trim(),
        contact: String(item.contact ?? '').trim(),
        class_key: representativeClassKey || classKeys[0] || '',
        class_keys: classKeys,
        class_keys_by_month: classKeysByMonth,
        month_key: String(item.monthKey ?? '').trim() || OPERATING_YEAR_MONTH,
        expires_at: String(item.expiresAt ?? '').trim() || null,
        is_active: Boolean(item.isActive),
        created_at: String(item.createdAt ?? '').trim() || new Date().toISOString(),
      });

      return acc;
    }, []);

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('student_accounts')
      .select('username');

    if (existingError) {
      console.error('save-student-accounts existing select error:', existingError);

      return NextResponse.json(
        { success: false, message: '학생 계정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const existingUsernames = Array.isArray(existingRows)
      ? existingRows.map((row) => String(row.username))
      : [];

    const nextUsernames = normalized.map((row) => String(row.username));

    if (normalized.length > 0) {
      let { error: upsertError } = await supabaseAdmin
        .from('student_accounts')
        .upsert(normalized, { onConflict: 'username' });

      if (
        upsertError?.code === '42703' ||
        String(upsertError?.message ?? '').includes('class_keys_by_month')
      ) {
        const legacyRows = normalized.map(({ class_keys_by_month, ...row }) => row);
        const legacyResult = await supabaseAdmin
          .from('student_accounts')
          .upsert(legacyRows, { onConflict: 'username' });

        upsertError = legacyResult.error;
      }

      if (upsertError) {
        console.error('save-student-accounts upsert error:', upsertError);

        return NextResponse.json(
          { success: false, message: '학생 계정 저장에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    const usernamesToDelete = existingUsernames.filter(
      (username) => !nextUsernames.includes(username)
    );

    if (usernamesToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('student_accounts')
        .delete()
        .in('username', usernamesToDelete);

      if (deleteError) {
        console.error('save-student-accounts delete error:', deleteError);

        return NextResponse.json(
          { success: false, message: '학생 계정 저장에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    let { data: finalRows, error: finalError } = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, password, name, contact, class_key, class_keys, class_keys_by_month, month_key, expires_at, is_active, created_at'
      )
      .order('created_at', { ascending: false });

    if (finalError?.code === '42703' || String(finalError?.message ?? '').includes('class_keys_by_month')) {
      const legacyResult = await supabaseAdmin
        .from('student_accounts')
        .select(
          'student_id, username, password, name, contact, class_key, class_keys, month_key, expires_at, is_active, created_at'
        )
        .order('created_at', { ascending: false });

      finalRows = legacyResult.data as typeof finalRows;
      finalError = legacyResult.error;
    }

    if (finalError) {
      console.error('save-student-accounts final select error:', finalError);

      return NextResponse.json(
        { success: false, message: '학생 계정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const finalItems = Array.isArray(finalRows)
      ? (finalRows as StudentAccountRow[]).map(mapRowToItem)
      : [];

    return NextResponse.json({
      success: true,
      items: finalItems,
    });
  } catch (error) {
    console.error('save-student-accounts POST catch error:', error);

    return NextResponse.json(
      { success: false, message: '학생 계정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
